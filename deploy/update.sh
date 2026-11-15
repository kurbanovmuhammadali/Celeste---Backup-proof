#!/bin/bash
# Run on the VM by push.sh: copies the new files in place and restarts. The database and .env are never touched.
set -euo pipefail
rsync -a --exclude data --exclude .env --exclude certs /tmp/hmsc-server/ /opt/hmsc/server/
cd /opt/hmsc/server && npm ci --omit=dev
chown -R hmsc:hmsc /opt/hmsc
cp /tmp/deploy/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy
systemctl restart hmsc
sleep 2 && systemctl is-active hmsc && curl -s localhost:4000/api/health | head -c 200 && echo
