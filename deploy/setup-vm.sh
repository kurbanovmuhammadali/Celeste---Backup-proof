#!/bin/bash
# One-time setup of a fresh Ubuntu 24.04 VM. Run as root:  sudo bash /tmp/deploy/setup-vm.sh
# Before: copy the server folder to /tmp/hmsc-server and this deploy folder to /tmp/deploy (see DEPLOY.md, step 5).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }
[ -d /tmp/hmsc-server ] || { echo "/tmp/hmsc-server is missing: upload the server folder first."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg ufw rsync sqlite3 unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

# Node 24 (the server needs node:sqlite, Node 22.13 or newer)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

# Caddy (automatic https)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y && apt-get install -y caddy
fi

# app user and files
id hmsc >/dev/null 2>&1 || useradd --system --home /opt/hmsc --shell /usr/sbin/nologin hmsc
mkdir -p /opt/hmsc/server/data
rsync -a --exclude data --exclude .env --exclude certs /tmp/hmsc-server/ /opt/hmsc/server/
if [ ! -f /opt/hmsc/server/.env ]; then
  cp /tmp/deploy/env.production.example /opt/hmsc/server/.env
  KEY=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48)
  sed -i "s|^TOKEN_ENC_KEY=.*|TOKEN_ENC_KEY=$KEY|" /opt/hmsc/server/.env
  echo ">>> Created /opt/hmsc/server/.env : fill in the passwords/keys (nano /opt/hmsc/server/.env) before starting."
fi
cd /opt/hmsc/server && npm ci --omit=dev
chown -R hmsc:hmsc /opt/hmsc && chmod 600 /opt/hmsc/server/.env

cp /tmp/deploy/hmsc.service /etc/systemd/system/hmsc.service
cp /tmp/deploy/Caddyfile /etc/caddy/Caddyfile
cp /tmp/deploy/backup.sh /usr/local/bin/hmsc-backup && chmod +x /usr/local/bin/hmsc-backup
echo "17 3 * * * root /usr/local/bin/hmsc-backup" > /etc/cron.d/hmsc-backup

# firewall (the Azure network rules must allow the same ports)
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

systemctl daemon-reload
systemctl enable hmsc caddy
systemctl restart caddy
echo
echo "Done. Next: nano /opt/hmsc/server/.env   then:   sudo systemctl start hmsc   and watch:   journalctl -u hmsc -f"
