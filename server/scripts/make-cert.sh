#!/bin/sh
# Creates a self-signed certificate for local https (needed so a phone can use the camera).
# It covers localhost, 127.0.0.1 and this computer's current LAN addresses. Re-run it if your Wi-Fi address changes.
# On the phone: open https://<this-computer-ip>:4443 once and accept the warning (Advanced > Continue).
set -e
cd "$(dirname "$0")/.."
mkdir -p certs
IPS=$(ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2}')
CNF=$(mktemp)
{
  echo "[req]"; echo "distinguished_name=dn"; echo "x509_extensions=v3"; echo "prompt=no"
  echo "[dn]"; echo "CN=HMSC local"
  echo "[v3]"; echo "subjectAltName=@alt"; echo "basicConstraints=CA:FALSE"; echo "keyUsage=digitalSignature,keyEncipherment"; echo "extendedKeyUsage=serverAuth"
  echo "[alt]"; echo "DNS.1=localhost"; echo "IP.1=127.0.0.1"
  n=2; for ip in $IPS; do echo "IP.$n=$ip"; n=$((n+1)); done
} > "$CNF"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout certs/key.pem -out certs/cert.pem -config "$CNF" 2>/dev/null
rm -f "$CNF"
chmod 600 certs/key.pem
echo "Certificate written to server/certs (valid 365 days) for: localhost 127.0.0.1 $IPS"
echo "Restart the server, then open https://<one of the addresses above>:4443"
