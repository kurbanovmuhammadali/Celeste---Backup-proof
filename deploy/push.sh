#!/bin/bash
# Run on YOUR computer to publish an update:  bash deploy/push.sh azureuser@<VM-IP> [path-to-key.pem]
set -euo pipefail
TARGET="${1:?usage: bash deploy/push.sh azureuser@VM_IP [key.pem]}"
KEY="${2:+-i $2}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
echo "1/3 building the web app"; (cd "$HERE/mobile" && npm run build:web >/dev/null)
echo "2/3 uploading"
rsync -az --delete -e "ssh $KEY" --exclude node_modules --exclude data --exclude .env --exclude certs "$HERE/server/" "$TARGET:/tmp/hmsc-server/"
rsync -az -e "ssh $KEY" "$HERE/deploy/" "$TARGET:/tmp/deploy/"
echo "3/3 restarting"; ssh $KEY "$TARGET" "sudo bash /tmp/deploy/update.sh"
