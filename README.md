# HMSC — Health Monitoring System Cometa (NASA Space Apps 2026)

Health monitoring for astronauts: WHOOP + manual vitals + labs → personal-baseline evaluation → clickable 3D body map → **adaptive mission plan** → flight-surgeon report.

Read **[docs/CONCEPT.md](docs/CONCEPT.md)** first — it explains the challenge and how the app helps astronauts.

```
claude version/
├── server/   Node 22+ API · SQLite · auth/sessions · consents · WHOOP OAuth · health engine · serves the web build
├── mobile/   Expo (React Native) app → iOS App Store build AND the web version (same code)
└── docs/     CONCEPT · APP_STORE · INTEGRATIONS
```

## Run it locally

Terminal 1 — API (port 4000):

```bash
cd server && npm install && npm run dev
```

Terminal 2 — app in the browser with hot reload (port 8082):

```bash
cd mobile && npm install && npm run web
```

Open http://localhost:8082. Create an account (age gate → profile → consents). Every new account gets a clearly-labelled 30-day **demo dataset** so all screens have data; remove it under Profile → Data sources.

Local test account used during development (exists only in your local `server/data/perigee.db`): `ada@crew.test` / `orbit2026`.

### Web version (backup plan) — one server

```bash
cd mobile && npm run build:web     # exports into server/public
cd ../server && npm start          # http://localhost:4000 serves app + API, same origin
```

Deploy `server/` anywhere that runs Node 22+ or Docker (Render, Fly.io, Railway, a VPS). See `server/Dockerfile`. Set `NODE_ENV=production`, `APP_URL=https://your-domain`, `TOKEN_ENC_KEY`, and mount a volume for `server/data/`.

### iPhone

- **Fastest:** install *Expo Go* on the iPhone, run `cd mobile && EXPO_PUBLIC_API_URL=http://<your-mac-LAN-IP>:4000 npx expo start`, scan the QR code.
- **Simulator:** needs full Xcode (this Mac currently only has Command Line Tools). Install Xcode from the App Store, then `sudo xcode-select -s /Applications/Xcode.app` and `npm run ios`.
- **App Store / TestFlight:** cloud build with EAS — no local Xcode required. See [docs/APP_STORE.md](docs/APP_STORE.md).

## Tests

```bash
cd server && npm test        # auth, age gate, consent, CSRF, plan adaptation, ingest, account deletion
cd mobile && npm run typecheck
```

## What's implemented

| Area | Details |
|---|---|
| Onboarding | 3-slide intro with real-time 3D copper biometric ring (three.js / react-three-fiber) |
| Age gate | DOB check on device (18+); blocked users' DOB is never sent; server re-validates |
| Registration | name, email, password policy, role (astronaut / analog crew / flight surgeon), mission, environment (station, spacecraft, lunar, Mars, analog) |
| Consent | Terms + Privacy acceptance and **separate explicit health-data consent**, versioned & stored per user |
| Sessions | web: HttpOnly SameSite=Lax cookie (+ custom-header CSRF guard); iOS: bearer token in Keychain (expo-secure-store) |
| Password reset | token flow (dev mode shows link; plug an SMTP provider for production) |
| Cookies | essential-only banner + cookie policy; no analytics/trackers |
| Legal | Terms of Use, Privacy Policy, Cookie Policy screens |
| Account | export all data (JSON), delete account with password (App Store guideline 5.1.1(v)) |
| Today | readiness score, recovery, sleep, strain, colour-coded alerts, daily metric tiles with charts, check-in CTA |
| Body map | clickable 3D body, 6 systems with pulsing status hotspots |
| Plan | mission plan kept as prescribed + HMSC adaptations with "why", surgeon-approval flags, XP, levels, streaks, mission patches |
| Trends | dot-matrix charts per metric, week/month, baseline |
| Check-in | draggable mood dial + symptoms (red symptoms escalate) |
| Logging | BP, glucose, temp, mass, bone NTx, vitamin D, radiation, CO₂ — each with "how to measure" |
| Education | every metric: what it is, why it matters in space, how to measure |
| Report | flight-surgeon summary, copy/share (store-and-forward) |
| Integrations | WHOOP v2 OAuth + sync, demo dataset, `/api/ingest` for NASA labs / dosimeters / other wearables |

## Merged from the HMSC prototype
- **NASA astronaut 3D** on Home (`mobile/src/three/AstronautScene.tsx`): heart beats at resting HR, risk areas glow on the body. Credit: NASA (see `mobile/assets/models/NOTICE`).
- **Mission risk report** on Home (`mobile/src/data/risk.ts`): cardio, sleep, immune, bone & muscle, mind, radiation + actions for today.
- **Active data source switch** in Profile (`mobile/src/kit/SourceSwitch.tsx`): Sample data ↔ WHOOP.

## HMSC product flow (signal → explanation → action → handoff)
Mission Briefing → daily check / data sources with freshness labels → **one attention card** → explain (trend, baseline, source, why) → one action → **offline medical handoff queue**.

| Feature | Where |
|---|---|
| Mission Briefing → five-hazard profile (radiation, isolation, distance, gravity, environment) | `mobile/app/briefing.tsx`, `mobile/src/data/mission.ts` |
| Source labels: demo / received / stale / missing / error / queued | `mobile/src/data/freshness.ts`, Home "Data sources" strip |
| Daily Crew Health Check (manual sleep, resting HR, mood, exercise, radiation, symptoms) | `mobile/app/daily.tsx` |
| Attention card + "explain, then act" screen (personal baseline, same-method HRV only, no fake green) | `mobile/src/data/attention.ts`, `mobile/app/attention.tsx` |
| Radiation module: rate · interval · cumulative (only with full history, else "Cumulative dose unavailable") + NASA DONKI context | `mobile/app/radiation.tsx`, `mobile/src/data/radiation.ts`, `donki.ts` |
| Offline handoff queue DRAFT → QUEUED → SENT → ACKNOWLEDGED (**simulated**) | `mobile/app/(tabs)/handoff.tsx`, `mobile/src/data/handoff.ts` |
| Real research data: Inspiration4 CBC (NASA OSDR OSD-569) | `mobile/app/research.tsx`, `mobile/src/data/inspiration4.ts` |
| Judge demo mode: one synthetic Mars case, one real dataset, one DONKI event, one action, one handoff | `mobile/app/judge.tsx`, `mobile/src/data/scenario.ts` |

Data labels used everywhere: **real astronaut research data** (Inspiration4), **real NASA space-weather context** (DONKI, not a personal dose), **synthetic demo scenario** (invented Mars replay crew), **simulated** handoff queue. WHOOP is the only wearable (an Earth testing input, not flight hardware); the alternative is manual entry.
The AI assistant tab is hidden from the main flow (code kept in `mobile/app/(tabs)/assistant.tsx`). Internal identifiers (URL scheme `perigee`, storage keys, bundle id) were left unchanged on purpose.

## Personalised plan and WHOOP-only data
- **Sign-up now asks** sex, height, weight, mission goal and spacewalk (EVA) frequency (steps 4-5), and **requires a data source** (step 8): connect **WHOOP** or enter data **by hand**. Apple Watch / Apple Health were removed; WHOOP is the only wearable.
- **Data by hand** (`dataMode: 'manual'`): only numbers typed into the Daily crew health check are used (sleep, resting HR, HRV, stress, exercise, radiation, symptoms). No sample or demo values are filled in.
- **My mission plan** (`mobile/app/mission-plan.tsx`, `mobile/src/data/plan.ts`): training loads and heart-rate zones from height, weight, age and sex; energy, protein and water targets; a **radiation protocol** (before / during / after, higher for Moon/Mars and frequent EVA); an EVA / exposure log that starts a **72-hour post-exposure checklist**; sleep and isolation steps. All numbers are starting estimates (Tanaka max HR, Mifflin-St Jeor).
- **Stress load** (`mobile/src/data/stress.ts`): the WHOOP developer API does not expose WHOOP's Stress Monitor score (recovery, sleep, cycles, workouts and body measurements only; not confirmed otherwise), so stress is **derived** from WHOOP HRV, resting HR, sleep and recovery against your own baseline, or typed in (1-5). Three or more high days feed the attention card.

## Email verification (on) and the training demo note
- **Email verification** sends the 4-digit code to the user's inbox (`server/src/mail.js`). `EMAIL_VERIFICATION=on` in `server/.env` makes it mandatory: if no provider is configured the API answers 503 with a clear message and **never shows the code**. Fill in ONE provider in `server/.env` (Gmail SMTP with an App Password, or Resend), then restart `npm run dev`. `EMAIL_VERIFICATION=auto` (or removing the line) restores the demo fallback where an unconfigured dev server auto-fills the code. The seeded demo crew login always uses the dev fallback outside production.
- **Training is a demo, and says so.** In orbit crews do not do push-ups or pull-ups: they use ARED, CEVIS and the T2 treadmill. HMSC is not integrated with that hardware, so a notice on Training and on every session explains that tracking here is a phone-based demo.

## Flight surgeon console, astronaut background file, temporary demo sign-in
- **Console** (`mobile/app/admin/`, `server/src/admin.js`): role `surgeon` (or an email in `ADMIN_EMAILS`) sees every astronaut: readiness, alerts, metrics with trends, plan completion, the astronaut app's own report (body numbers, stress, radiation, exposures, sessions), the background file, and can **send a ready plan**: message, resistance sessions / Zone 2 targets, intensity, a **week schedule** (3 ready templates or build your own) and extra tasks. The astronaut sees it at once on Training, Home "today's session" and My mission plan. Prototype note: every surgeon sees every astronaut; a real deployment must assign crew to surgeons and record consent.
- **Background file** (`mobile/app/background.tsx`, `server/src/background.js`): CV, characteristics, health conditions, allergies, medications and up to 5 files (PDF/Word/text/image, 700 KB each). Surgeons also keep **private notes** the astronaut cannot see. Conditions add cautious "Health considerations" to the personal plan. If the astronaut ticks the consent box, a short summary (characteristics, condition names, background) is given to the companion AI so replies are gentler and more relevant. The AI never diagnoses and does not raise conditions unless the astronaut does. File downloads open in the web console (native app lists names only).
- **Temporary demo sign-in**: with `DEMO_LOGIN=on` (server/.env, non-production only) the welcome screen shows "Demo astronaut" and "Demo surgeon" and four demo astronauts are seeded. Everything is marked `DEMO-ONLY`; see `DEMO_REMOVAL.md` for the removal steps.

## Camera tab and food/water tracking
- **Camera tab** (`mobile/app/(tabs)/camera.tsx`, `mobile/src/data/pose.ts`): showcase of camera-based exercise tracking. Counts push-ups, pull-ups, squats and bicep curls from body landmarks (MediaPipe Pose, loaded from a CDN in the browser; frames never leave the device). A **Demo figure** mode runs the same counter on a synthetic skeleton, so it works with no camera. Sessions are saved (source camera / demo / manual) and reported to the surgeon console. On iOS/Android the camera is a preview with +1/-1 counting; pose counting runs in the web version. The browser only allows the camera on `https://` or `localhost`, so open the web app on the laptop that has the camera, or serve it over https.
- It is a **prototype stand-in**: in orbit crews do not do push-ups or pull-ups; they use ARED, CEVIS and the T2 treadmill, and HMSC is not integrated with them (notice shown on Training and Camera).
- **Wearable status** on the Camera tab shows WHOOP as Connected / Demo / Not connected. WHOOP shares recovery, sleep, HRV and strain after the session; it does not stream live heart rate to apps.
- **Food and water** (`mobile/app/nutrition.tsx`): calories, protein and water against targets from the personal plan (quick presets, custom entries, water buttons). Today's intake and camera reps are reported to the surgeon console.

## Where the AI is
- **AI tab** (`mobile/app/(tabs)/assistant.tsx`, server `POST /api/assistant`): the HMSC health assistant. It answers from the astronaut's own numbers (sleep, recovery, HRV, radiation…) and, if they ticked the consent box, a summary of their background file. Crisis wording is answered with a care message and the flight surgeon, never by a template.
- Both need `ANTHROPIC_API_KEY` in `server/.env` (model `claude-opus-5-5`, or `COMPANION_MODEL=claude-haiku-5-5` for faster/cheaper). **Without a key they fall back to labelled demo/offline replies** ("Demo reply: AI is not set up on this server").
- The camera tracker now lives **inside the Training tab** (no separate page). `/admin` signs in as the demo surgeon automatically while `DEMO_LOGIN=on`.

## Remote camera for the flight surgeon, meal detection, Gemini
- **Camera station** (`mobile/app/camera.tsx`, `mobile/src/kit/CaptureView.tsx`, `server/src/cam.js`): there are no fixed cameras yet, so one hard-coded page, `/camera`, is the camera. Nothing in the app links to it. An operator opens it on a phone or laptop, **chooses the astronaut** from the list, and the camera opens and films him (about one frame per second). Astronauts do not create anything themselves. The surgeon watches in Admin → astronaut → Live camera; the astronaut sees a notice on Home while the camera is on him. Nothing is recorded: the server keeps only the latest frame in memory for a few seconds. DEMO-ONLY: no sign-in, so it needs `CAMERA_STATION=on` in `server/.env` and is refused in production. Private per-astronaut links (`/cam/<token>`) still exist on the server but nothing in the UI offers them. Browsers only allow the camera on `https://` or `localhost`.
- **Meal detection** (`mobile/src/data/eating.ts`): in orbit food is precooked, so nobody cooks or photographs it; the camera only answers "did they eat?". The phone page runs the pretrained MediaPipe Pose model in the browser and counts hand-to-mouth bites; 4+ bites in one sitting = a meal. Only "a meal happened" is sent to the server (never video). The astronaut's Nutrition screen marks the meal "Seen by the camera", and the surgeon console shows it. Astronauts can also tick ate / skipped themselves.
- **Exercise counters** (`mobile/src/data/pose.ts`): pretrained MediaPipe Pose + geometry. Push-ups and curls use arm straightness (shoulder-wrist distance over arm length) with thresholds adapted per arm to the person's own range, so other camera angles, partial reps, noise and a hidden arm still count. Very small curls (under about half the motion) are intentionally ignored so tremor never counts.
- **Gemini**: set `GEMINI_API_KEY` in `server/.env` (model `GEMINI_MODEL`, default `gemini-flash-latest`) for the AI tab. Claude (`ANTHROPIC_API_KEY`) is used if no Gemini key is set. Keys live only in `server/.env`, which is git-ignored and left out of the zip. Rotate any key that was pasted into a chat.
- **One address for phone + laptop**: `cd mobile && npm run build:web` exports the app into `server/public`; the server then serves app and API together on `http://localhost:4000` (and `http://<your-LAN-IP>:4000` for a phone).

## Camera on a phone: local https
Phones only create `navigator.mediaDevices` on https pages, so opening the camera station over plain `http://<LAN-IP>:4000` fails ("undefined is not an object … getUserMedia"; the page now explains this and shows the https address instead). Run `cd server && npm run cert` once (it also covers your current Wi-Fi address; run it again if that address changes) and restart the server: it then also listens on `https://<LAN-IP>:4443`. On the phone open `https://<LAN-IP>:4443/camera`, accept the self-signed certificate warning once, choose the astronaut, allow the camera. On the laptop itself `http://localhost:4000/camera` always works. Certificates live in `server/certs/` (git-ignored and not zipped).


## Live camera video
The camera page streams HD (up to 1280x720, 30 fps, ~3 Mbps) peer to peer over WebRTC to the surgeon's browser; the server only relays the handshake over a WebSocket at `/rtc` (library `ws`). A JPEG still every 2.5 s remains as a fallback. The viewer shows resolution, fps and Mbps. Scale-up options: MediaMTX or LiveKit.

## Handoffs and exercise counting
- Queued handoff reports are sent to `/api/me/handoffs/:id`, listed in the admin console (badge on the crew card, section on the astronaut page) and acknowledged there; the acknowledgement and note return to the astronaut app. Synthetic judge-scenario reports are never sent.
- Push-up and pull-up counting use MediaPipe world (3D) landmarks, posture gates, One Euro smoothing and a hysteresis state machine (`mobile/src/data/pose.ts`, tests in `mobile/test/pose.test.mts`). Bicep curls were removed.

## Five decision-support tools (Today screen)
Private wellbeing check (`/wellbeing`, stays on the device), sensor confidence score (on the attention card), what changed since yesterday, EVA readiness check (`/eva`), radiation shelter drill (`/shelter`, simulated, never sent). Logic: `mobile/src/data/{wellbeing,confidence,changes,eva}.ts`.


(The family-voice companion and the voice-cloning engine were removed.)

## Teamwork, calls, face recognition and emergency detection
- **Crews** (`/crew`, `server/src/team.js`): create or join with a code at sign-up or later. Members share the mission briefing, see who is online, can call each other, add an anonymous daily pulse (average shown from 3 people), post kudos, and raise **anonymous concerns** that only flight surgeons read (the author is a salted hash, never shown).
- **Emergency alerts**: a camera detection, the SOS button or a drill alerts every flight surgeon and every crew mate live (alarm sound, full-screen), escalates after 45 s if nobody responds, and is closed by a surgeon (resolved or false alarm).
- **Calls** (WebRTC, signalling in `server/src/rtc.js`): astronaut to doctors, doctor to astronaut, crew to crew, and astronaut to family. A family member needs no account: add them in Family, send the private link (WhatsApp, Telegram or copy), they open `/f/<token>` to call or leave a message.
- **Face recognition** (open-source face-api.js, bundled in `mobile/public`): enrol in Settings → Face sign-in; sign in with email + a live head-turn; the camera station recognises people and labels them. Only 128 numbers are stored, never photos.
- **Camera station v2** (`/camera` → Scan the room, `mobile/src/kit/StationView.tsx`): several people at once; per-person pose analysis (`data/incident.ts`: collapse, convulsive shaking, no movement after a fall), activity timeline and plain-language report (`data/activity.ts`, free local AI: MediaPipe pose + object detector, no cloud). Not a medical device: it cannot see death or diagnose epilepsy; it only asks people to check immediately.
- Models and runtimes are bundled (MediaPipe Pose full + heavy, EfficientDet-Lite0, face-api.js); see `mobile/public/NOTICE-models.txt`. `cd mobile && npm test` runs the pose, incident and activity tests.

## Deploying
See `DEPLOY.md` (Azure VM + Caddy https + backups + optional TURN) and the `deploy/` folder. Features overview: `FEATURES.md`.
