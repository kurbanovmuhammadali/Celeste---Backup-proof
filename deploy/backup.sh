#!/bin/bash
# Daily consistent copy of the database (safe while the server runs). Keeps 14 days in /var/backups/hmsc.
set -euo pipefail
mkdir -p /var/backups/hmsc && chmod 700 /var/backups/hmsc
sqlite3 /opt/hmsc/server/data/perigee.db ".backup '/var/backups/hmsc/perigee-$(date +%F).db'"
find /var/backups/hmsc -name 'perigee-*.db' -mtime +14 -delete
