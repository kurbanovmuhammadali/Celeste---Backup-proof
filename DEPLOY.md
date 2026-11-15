# Deploy guide: HMSC on Azure at celestasoft.health

Goal: `https://celestasoft.health` serves HMSC (app, API, live alerts, calls) on one small Azure Linux VM, with automatic https, backups, WHOOP and email sign-in working.

**Why a VM and not "App Service"?** HMSC keeps its data in one SQLite file, uses WebSockets (alerts, calls, live video) and can run a call relay (TURN). A VM does all of that with the fewest surprises. You do not need Speech services, Foundry, SQL or Storage from the portal list.

Time: about 45 minutes the first time. Cost: roughly **$20 to $40 per month** (VM + disk + fixed IP). Always read the monthly estimate the portal shows before you press Create.

> **Credit warning.** The "$200 credit" on a new Azure free account normally lasts **30 days**. After that, resources are stopped until you press **Upgrade to pay-as-you-go**. Upgrading does not remove the free credit that is left, and you only pay for what you use. Set a budget alert (step 9) so there are no surprises.

---

## 0. What you need
| Item | Where |
|---|---|
| Azure account with the credit | portal.azure.com |
| Domain `celestasoft.health` | Porkbun |
| This project | `~/Desktop/ASTRA/merged` on your Mac |
| A gmail address (or Resend) for sign-in codes | step 6 |
| WHOOP Client ID/Secret | already created (rotate the secret, it was shared in chat) |
| Gemini API key (new one) | aistudio.google.com |

## 1. Create the VM (Azure portal)
1. **Create a resource → Virtual machines → Create → Azure virtual machine.**
2. **Basics**
   - Resource group: *Create new* → `hmsc-rg`
   - Virtual machine name: `hmsc-vm`
   - Region: one near your users (for Central Asia: UAE North, Germany West Central or Poland Central are good; pick whichever allows the size below).
   - Availability options: *No infrastructure redundancy required*
   - Image: **Ubuntu Server 24.04 LTS – x64 Gen2**
   - Size: **Standard_B2s** (2 vCPU, 4 GB) is comfortable. A smaller one (B1ms, 2 GB) also works; the AI runs in people's browsers, not on the server. If a size is greyed out, click *See all sizes* or change the region.
   - Authentication type: **SSH public key**, username `azureuser`, *Generate new key pair*, key pair name `hmsc-vm_key`.
   - Public inbound ports: *Allow selected ports* → tick **SSH (22), HTTP (80), HTTPS (443)**.
3. **Disks:** OS disk *Standard SSD*, default size (30 GB) is enough.
4. **Networking:** keep the defaults (a new public IP and a network security group are created).
5. **Review + create → Create.** A window offers to **download the private key** (`hmsc-vm_key.pem`). Download it, you cannot get it again.
6. When it is done: **Go to resource**. Note the **Public IP address**. Open the Public IP resource → *Configuration* and make sure *Assignment* is **Static** (new Standard IPs already are).

On your Mac, protect the key:
```bash
mv ~/Downloads/hmsc-vm_key.pem ~/.ssh/ && chmod 400 ~/.ssh/hmsc-vm_key.pem
ssh -i ~/.ssh/hmsc-vm_key.pem azureuser@<PUBLIC-IP>      # first connection: type yes
exit
```

## 2. Point the domain at the VM (Porkbun)
Porkbun → Domain Management → `celestasoft.health` → **DNS Records**:
1. Delete the default parking records (an `ALIAS`/`CNAME` on `celestasoft.health` and `*`).
2. Add: **A** record, host empty (the root), answer `<PUBLIC-IP>`, TTL 600.
3. Add: **A** record, host `www`, answer `<PUBLIC-IP>`.

Check from your Mac (can take a few minutes):
```bash
dig +short celestasoft.health      # must print your VM's IP
```
Do not continue until it does: Caddy needs the DNS to get the https certificate.

## 3. Build the web app on your Mac
```bash
cd ~/Desktop/ASTRA/merged/mobile && npm install && npm run build:web     # fills ../server/public (about 110 MB incl. the AI models)
```

## 4. Upload the project
```bash
cd ~/Desktop/ASTRA/merged
KEY=~/.ssh/hmsc-vm_key.pem; VM=azureuser@<PUBLIC-IP>
rsync -az -e "ssh -i $KEY" --exclude node_modules --exclude data --exclude .env --exclude certs server/ $VM:/tmp/hmsc-server/
rsync -az -e "ssh -i $KEY" deploy/ $VM:/tmp/deploy/
```
(`data`, `.env` and `certs` stay on your Mac: the VM starts with a clean database and its own secrets.)

## 5. Install everything (on the VM)
```bash
ssh -i ~/.ssh/hmsc-vm_key.pem azureuser@<PUBLIC-IP>
sudo bash /tmp/deploy/setup-vm.sh
```
This installs Node 24, Caddy (https), creates the `hmsc` service user, installs the server, sets up the firewall, a daily database backup, and creates `/opt/hmsc/server/.env` with a random `TOKEN_ENC_KEY`.

## 6. Fill in the settings
```bash
sudo nano /opt/hmsc/server/.env        # Ctrl+O Enter to save, Ctrl+X to exit
```
Set at least:
| Setting | Value |
|---|---|
| `NODE_ENV` | `production` (turns the demo shortcuts off) |
| `APP_URL` | `https://celestasoft.health` |
| `EMAIL_VERIFICATION` | `on` |
| `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail: Google Account → Security → 2-Step Verification → **App passwords** → create one; `SMTP_PASS` is that 16-letter password. (Or use Resend with `RESEND_API_KEY` and add the DNS records it shows at Porkbun.) |
| `ADMIN_EMAILS` | your email: you become a flight surgeon after you sign up with it |
| `WHOOP_CLIENT_SECRET` | the **new** secret (regenerate it in the WHOOP dashboard first) |
| `GEMINI_API_KEY` | a **new** key |

Then start it:
```bash
sudo systemctl start hmsc
sudo systemctl status hmsc --no-pager          # should say active (running)
journalctl -u hmsc -n 30 --no-pager            # look for "HMSC API on http://localhost:4000 (WHOOP configured)"
curl -s localhost:4000/api/health
```
Open **https://celestasoft.health** in a browser. The first visit may take a few seconds while the certificate is issued.

## 7. First account, first surgeon
1. On the site, **Get started** and sign up with the email you put in `ADMIN_EMAILS` (the 4-digit code arrives by email).
2. You are now an admin: the flight surgeon console is at `https://celestasoft.health/admin` (and gets emergency alerts).
   Alternative: after signing up, `cd /opt/hmsc/server && sudo -u hmsc node --env-file=.env scripts/make-surgeon.js you@example.com`.
3. Other people sign up themselves, then join a crew with its code.

## 8. WHOOP
Already registered with `https://celestasoft.health/api/integrations/whoop/callback`. Test: Settings → WHOOP → **Connect** → log in at WHOOP → Allow → you land back in HMSC with "Imported N values". Sandbox limit: 10 connected people.

## 9. Spend control (do this today)
Portal → **Cost Management → Budgets → Add**: monthly budget (for example $40) with an email alert at 80%.
To pause paying for the VM while you are not demoing: VM → **Stop** (it shows *Stopped (deallocated)*). Disk and IP still cost a little; start it again before the demo.

## 10. Optional but recommended: call relay (TURN)
Without it, calls and live video can fail on some phone networks and strict Wi-Fi. On the VM:
```bash
sudo bash /tmp/deploy/turn/setup-turn.sh celestasoft.health
```
Then in the portal: VM → **Networking → Add inbound port rule**: `3478` (TCP and UDP) and `49152-49200` (UDP). Test: `curl -s https://celestasoft.health/api/ice` shows `"turn":true`.

## 11. Update later
From your Mac, after changing code:
```bash
cd ~/Desktop/ASTRA/merged && bash deploy/push.sh azureuser@<PUBLIC-IP> ~/.ssh/hmsc-vm_key.pem
```
It rebuilds the web app, uploads only what changed, installs, restarts, and prints the health check. The database and `.env` are never overwritten.

## 12. Backups
A copy of the database is made every night at 03:17 in `/var/backups/hmsc` (14 days kept). To download one:
```bash
scp -i ~/.ssh/hmsc-vm_key.pem azureuser@<PUBLIC-IP>:/var/backups/hmsc/perigee-$(date +%F).db ~/Desktop/
```
For safety also use Azure Backup for the VM (portal → VM → Backup) once the free credit allows.

---

## Check list after deploy
- [ ] `https://celestasoft.health` loads with the padlock and `/api/health` shows `"whoop":true`
- [ ] Sign-up email arrives, you can log in, `/admin` opens
- [ ] WHOOP Connect works and numbers appear
- [ ] Two devices: call each other (family link `/f/<token>` too), press SOS and see the alert on the other device
- [ ] Phone: camera and microphone prompts appear (they only work on https)
- [ ] Face sign-in: Settings → Face sign-in, then sign out and back in with your face

## The camera station in production
`/camera` (scan the room) is a demo page and is **off when `NODE_ENV=production`** because it has no sign-in. For a judges' demo you have two choices:
- Run the station on your Mac (`http://localhost:4000/camera`) pointed at a local server, or
- Run the VM in demo mode behind one shared password: set `NODE_ENV=demo`, `DEMO_LOGIN=on`, `CAMERA_STATION=on` in `.env`, replace the Caddyfile with `deploy/Caddyfile.demo-password` (it asks for a user/password first), restart. Switch back to `production` right after the demo.

## Troubleshooting
| Symptom | Check |
|---|---|
| Browser says certificate error / site not reachable | `dig +short celestasoft.health` must be the VM IP; ports 80 and 443 open in the Azure network rule; `sudo journalctl -u caddy -n 50` |
| `502 Bad Gateway` | the app is not running: `sudo systemctl status hmsc`, `journalctl -u hmsc -n 50` |
| No sign-in email | `.env` SMTP values; Gmail needs an *App password*, not your normal one; `journalctl -u hmsc` shows the mail error |
| WHOOP "error" after Allow | `WHOOP_REDIRECT_URI` identical to the dashboard; `WHOOP_CLIENT_SECRET` set; `journalctl -u hmsc` |
| Calls connect on Wi-Fi but not on mobile data | set up TURN (step 10) |
| Alerts do not reach you | you must be signed in as admin (`ADMIN_EMAILS`) and keep the tab open |
| Lost access to `.env` secrets | rotate: WHOOP secret, Gemini key, SMTP password, then restart `sudo systemctl restart hmsc` |

## What lives where on the VM
```
/opt/hmsc/server          code, built web app (public/), .env, data/perigee.db (the database)
/etc/caddy/Caddyfile      https and reverse proxy
/etc/systemd/system/hmsc.service
/var/backups/hmsc         nightly database copies
```
Logs: `journalctl -u hmsc -f` (app), `journalctl -u caddy -f` (web server).
