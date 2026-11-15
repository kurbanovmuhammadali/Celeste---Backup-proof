#!/bin/bash
# Optional: a TURN relay on the same VM so calls and live video work behind strict firewalls / mobile networks.
# Run as root on the VM:  sudo bash /tmp/deploy/turn/setup-turn.sh celestasoft.health
set -euo pipefail
HOST="${1:?usage: setup-turn.sh your.domain}"
apt-get install -y coturn
SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)
PUB=$(curl -s -H Metadata:true "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text")
PRIV=$(hostname -I | awk '{print $1}')
cat > /etc/turnserver.conf <<CONF
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=$SECRET
realm=$HOST
server-name=$HOST
external-ip=$PUB/$PRIV
min-port=49152
max-port=49200
total-quota=100
no-multicast-peers
no-cli
no-tls
no-dtls
# never let a caller reach the VM's own network
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
CONF
sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
ufw allow 3478 && ufw allow 49152:49200/udp
sed -i "s|^TURN_HOST=.*|TURN_HOST=$HOST|; s|^TURN_SECRET=.*|TURN_SECRET=$SECRET|" /opt/hmsc/server/.env
systemctl enable --now coturn && systemctl restart coturn && systemctl restart hmsc
echo "TURN is on. In the Azure portal open these inbound ports for the VM: 3478 (TCP and UDP) and 49152-49200 (UDP)."
