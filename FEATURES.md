# HMSC · Health Monitoring System Cometa: what it does, where it lives, how it works

NASA Space Apps 2026 · astronaut health monitoring · decision support, **not a medical device, not affiliated with NASA**.

---

## 1. The big picture

| Part | Tech | Folder |
|---|---|---|
| App (web, Android, iOS from one code base) | Expo SDK 57, React Native 0.86, expo-router, TypeScript | `mobile/` |
| Server (API, sign-in, alerts, calls) | Node 26, Express 5, `node:sqlite`, `ws` | `server/` |
| Database | SQLite file `server/data/perigee.db` (created on first start) | `server/src/db.js` |
| Web build served by the server | `npm run build:web` → `server/public` | one origin, no CORS trouble |
| On-device AI (offline) | MediaPipe Pose + Object Detector, face-api.js | `mobile/public/` |

Everything the AI does about video happens **in the browser on the device**. The server never receives video recordings or photos.

### Run it
```bash
cd server && npm install && npm start                # API + built web app on http://localhost:4000 (https on :4443 if certs exist)
cd mobile && npm install && npm run build:web        # rebuild the web app into server/public after code changes
cd mobile && npm run web                             # dev server on :8081 (hot reload)
cd server && node --test                             # 37 server tests
cd mobile && npm test                                # 19 tests: push-up/pull-up counting, incident detection, activity report
cd server && npm run cert                            # self-signed https certificate for phone camera/mic on the local network
```
Phones only expose the camera and microphone on **https** (or localhost): open `https://<your-LAN-IP>:4443`.

### Folder map
```
server/src/index.js      routes: sign-up/login (email code), dashboard, plan, check-ins, WHOOP, account, AI tab, handoff wiring
server/src/db.js         all core tables
server/src/health/       engine.js (readiness, systems, adaptive plan), catalog.js (metric explanations)
server/src/admin.js      flight-surgeon console API, plan override, snapshot, handoff reports
server/src/team.js       crews, anonymous reports, pulse, family contacts, emergency alerts
server/src/rtc.js        WebSocket hub: live video signalling, alerts inbox, call signalling
server/src/cam.js        camera station API: frames, meals, incidents, activity reports, identify
server/src/face.js       face templates, face sign-in, identify
server/src/background.js astronaut background file (CV, conditions, files) for surgeon + AI
server/src/companion.js  AI tab (health assistant) prompt + provider call
server/src/llm.js        Gemini REST client
server/src/whoop.js      WHOOP OAuth + sync
server/src/mail.js       email codes (Gmail SMTP, Resend, or console)
server/src/demo*.js      DEMO-ONLY seed data and one-click login
mobile/app/              screens (file = route)
mobile/src/data/         app logic (plan, attention, radiation, pose, incident, activity, face, ...)
mobile/src/kit/          UI kit + big components (charts, StationView, FaceScan, ...)
mobile/src/live/         live layer: alert overlay, calls
mobile/public/           bundled AI models and runtimes (offline) + NOTICE-models.txt
```

---

## 2. Accounts, sign-in and roles

| Function | Where | How |
|---|---|---|
| Sign-up (name, age 18+, mission length, terms) | `mobile/app/(auth)/*`, `POST /api/auth/code` + `/verify` | Email → 4-digit code → profile. Steps: name, age, mission, body, goal, data source, email, code, data, **team**, done. |
| Email codes | `server/src/mail.js` | Gmail SMTP (App Password), Resend, or console. `EMAIL_VERIFICATION=on/auto`. Currently `auto` (code shown on screen in dev). |
| Log in | `mobile/app/(auth)/login.tsx` | Email → code, **or** face (see section 9). |
| Sessions | `server/src/auth.js` | Random token, only its SHA-256 stored; cookie for web, bearer token for native; CSRF header `X-Requested-With`. |
| Roles | `server/src/roles.js` | `astronaut`, `analog`, `surgeon` (flight surgeon = admin). `ADMIN_EMAILS` can also grant admin. |
| Account export / delete | `GET /api/account/export`, `DELETE /api/account` · `mobile/app/profile/privacy.tsx` | Full data export; delete removes everything (cascade). |
| Legal and consent | `mobile/src/legal.ts`, `mobile/app/legal/` | Terms, privacy, health-data consent versioned (`LEGAL_VERSION`). |
| **DEMO-ONLY** one-click login | `server/src/demo-login.js`, `mobile/src/DemoLogin.tsx` | `DEMO_LOGIN=on`, only when not production. Remove steps in `DEMO_REMOVAL.md`. |

---

## 3. Health data, dashboard and plan

| Function | Where | How |
|---|---|---|
| WHOOP connection (only wearable) | `server/src/whoop.js`, `mobile/app/integrations.tsx` | OAuth; tokens encrypted at rest (`TOKEN_ENC_KEY`). Without keys the **demo dataset** is used and labelled "demo". |
| Enter data by hand | `mobile/app/daily.tsx`, `log.tsx`, `checkin.tsx` | Sleep, resting HR, HRV, mood, exercise, radiation, symptoms. Mandatory choice at sign-up: WHOOP **or** by hand. |
| Health engine | `server/src/health/engine.js` | 30-day series → readiness score, 6 body systems (heart, bones, brain, eyes, immune, metabolism), alerts, adaptive plan with reasons. |
| Home dashboard | `mobile/app/(tabs)/today.tsx`, `mobile/src/data/crew.ts` | Merges server data with sample values, labels every source. Stress is derived from HRV, resting HR, sleep, recovery (`data/stress.ts`). |
| **Attention card** | `data/attention.ts`, `kit/hmsc.tsx` | One main signal + reason + one action, compared with the person's own 14-day baseline. Never shows "normal" without data. |
| **Data-freshness labels** | `data/freshness.ts` | demo / received / stale / missing / error / queued per source. |
| **Sensor confidence score** | `data/confidence.ts` | Starts at 100; loses points for stale data, demo/typed data, missing readings, short baseline. Every deduction listed on the Attention page. |
| **What changed since yesterday** | `data/changes.ts`, `kit/tools.tsx` | Only meaningful changes: sleep, HRV, resting HR, recovery, new symptom, no training, skipped meals, dose change. Says so when nothing changed. |
| Plans: personal mission plan | `data/plan.ts`, `mobile/app/mission-plan.tsx` | From sex, age, height, weight, goal, destination, EVA: heart-rate zones, kcal, protein, water, radiation protocol, training emphasis, condition-specific advice. |
| Training | `mobile/app/(tabs)/plan.tsx`, `mobile/app/training/*`, `data/training.ts` | Sessions for ISS-style devices (ARED, CEVIS, T2 treadmill); plan adapts. |
| Flight-surgeon plan override | `data/override.ts`, `server/src/admin.js` | A surgeon sends a ready weekly plan; it replaces the astronaut's Training tab. |
| Nutrition | `mobile/app/nutrition.tsx`, `data/mealchecks.ts` | Precooked space food: "Did you eat?" marks per meal, calories/protein/water against targets. |
| Mission briefing | `mobile/app/briefing.tsx`, `data/mission.ts` | Destination, duration, comms delay, EVA, sensors → hazard profile (radiation, isolation, distance, gravity, environment). |
| Radiation module | `mobile/app/radiation.tsx`, `data/radiation.ts`, `data/donki.ts` | Dose rate, interval, cumulative **only when every mission day has a reading**, coverage gaps; NASA DONKI space-weather context via api.nasa.gov. |
| Real NASA data | `mobile/app/research.tsx`, `data/inspiration4.ts` | Inspiration4 blood counts (OSDR OSD-569) generated into the app. |
| Judge demo mode | `mobile/app/judge.tsx`, `data/scenario.ts` | Synthetic Mars case on top of the app, clearly labelled; one real dataset; one handoff. |
| 3D body | `mobile/src/three/`, `kit/hmsc.tsx` | Real NASA astronaut GLB model (Draco decoded, textures stripped for native). |

### Decision-support tools (top five)
| Tool | Where | How |
|---|---|---|
| **Private wellbeing check** | `mobile/app/wellbeing.tsx`, `data/wellbeing.ts` | Mood, stress, energy, loneliness, sleep quality, "need support". **Stored only on the device.** Support → offers a confidential handoff draft. |
| **EVA readiness check** | `mobile/app/eva.tsx`, `data/eva.ts` | Measured items fill in (sleep, hydration, food, symptoms, recovery, radiation) + ticks (suit, comms, tethers, plan, medical clearance) → GO / CAUTION / NO-GO; can send to the surgeon. |
| **Radiation shelter drill** | `mobile/app/shelter.tsx` | Simulated solar particle event: countdown, invented sensor values, checklist, drill report (never sent). 1 simulated minute = 2 real seconds. |
| Sensor confidence, What changed | see above | |

### Offline medical handoff
`mobile/app/(tabs)/handoff.tsx`, `data/handoff.ts`, server `admin.js`.
Draft → queued → sent → acknowledged. A queued report is delivered to the flight-surgeon console (`PUT /api/me/handoffs/:id`); the surgeon acknowledges with a note (`POST /api/admin/handoffs/:uid/:id/ack`) and the astronaut sees it. The communication window is simulated; synthetic-scenario reports are never sent. Comms delay from the briefing is shown.

### AI tab (health assistant)
`mobile/app/(tabs)/assistant.tsx`, `data/assistant.ts`, `server/src/companion.js`, `server/src/llm.js`, `POST /api/assistant`.
Gemini (`GEMINI_API_KEY`, model `gemini-flash-latest`) or Claude (`ANTHROPIC_API_KEY`). The prompt contains only the user's own numbers, plus the background file **if the astronaut agreed**. Distress wording (`data/safety.ts`) is answered with a care message and a pointer to the flight surgeon, never by the model. Without a key, offline answers are used.

### Background file
`mobile/app/background.tsx`, `server/src/background.js`. CV, characteristics, health conditions, allergies, medications, up to 5 files (PDF, Word, text, image). Visible to flight surgeons; used by the AI and the plan only with consent.

---

## 4. Teamwork: crews

`server/src/team.js` · `mobile/app/crew.tsx` · `mobile/app/(auth)/team.tsx` · `mobile/src/data/team.ts`

| Function | How |
|---|---|
| **Create or join a crew** | Code like `K7M-2QX`. One crew per person, max 12. Last sign-up step, or Settings → My crew. |
| **Same environment for the team** | The commander shares the mission briefing; every member's briefing and mission length follow it (`useTeam`). |
| Members and presence | Names, role, online dot. Health data is **not** shown to crew mates. |
| **Crew pulse (anonymous)** | Each member adds mood/stress 1-5; the average is shown only from 3 people. Stored with a salted hash, not a user id. |
| **Anonymous concerns** | "Concern" button on a crew mate → category + message → only flight surgeons read it. Author = HMAC hash, never shown; surgeons see how many *different* people raised the same person in 14 days. Rate limited (6/day). |
| Crew board | Commander announcements, anyone can send kudos. |
| Leave crew | Longest-serving member becomes commander; empty crew is deleted. |

---

## 5. Emergency alerts

`server/src/team.js` (incidents) · `server/src/rtc.js` (live push) · `mobile/src/live/Live.tsx` (overlay) · `mobile/src/kit/StationView.tsx` (detection)

1. **Who can raise one:** the camera station (automatic), the **SOS** button (Today → tools), a test/drill.
2. **Who is told, instantly:** every flight surgeon **and** every crew mate of that person, over the live socket. Full-screen red overlay + alarm sound + vibration. The person themselves sees "Help has been alerted".
3. **Responding:** "I am responding" is shown to everyone; "Call" rings the person.
4. **Escalation:** if nobody responds in 45 s the alert is sent again, louder (`escalated`).
5. **Closing:** only a flight surgeon: resolved or false alarm (`POST /api/admin/alerts/:id/resolve`). History on the astronaut's admin page → Live tab.
6. Late joiners are shown active incidents when they connect; duplicates within 90 s are merged.

### What the camera can and cannot detect (`mobile/src/data/incident.ts`)
Geometry and timing on MediaPipe pose, no model was trained:
- **Collapse:** standing → lying within 2 s, still down 3 s later (slow lying-down is ignored; ignored while an exercise counter is active).
- **Seizure-like shaking:** rhythmic whole-body motion 2-8 Hz in ≥5 joints incl. head/shoulders for 5 s, while lying or just after a fall.
- **No movement after a fall/shaking:** almost no motion for 20 s.
- **It cannot see death and cannot diagnose epilepsy.** It asks humans to check at once. Thresholds are tuned on simulated skeletons only and are **not clinically validated**. The station asks the operator for a 6 s confirm window ("It's fine") before sending, except for "no movement".

---

## 6. Camera station

Open `/camera` (DEMO-ONLY page, needs `CAMERA_STATION=on`, off in production). Files: `mobile/app/camera.tsx`, `mobile/src/kit/StationView.tsx`, `server/src/cam.js`.

| Function | How |
|---|---|
| **Scan the room** | One camera, up to 3 people. Face recognition labels each person (name tag on video). |
| Manual pick | If someone has no enrolled face, choose who it is. |
| **Live HD video to the surgeon** | WebRTC peer to peer, 1280x720 up to 30 fps, ~3 Mbps (`data/rtcClient.ts`, `server/src/rtc.js`); viewer shows resolution/fps/Mbps; JPEG stills every 2.5 s as fallback (`kit/CamViewer.tsx`). Nothing is stored. |
| Meal detection | Hand-to-mouth bites from pose (`data/eating.ts`): ≥4 bites = meal; reported to the astronaut's meal marks and the surgeon (`POST /api/station/:id/meal`). Space food is precooked; no food photos. |
| **Activity report (local free AI)** | MediaPipe pose → posture (standing, sitting, lying, walking), exercise counters, eating, objects (EfficientDet-Lite0: cup, laptop, phone...). `data/activity.ts` builds a timeline and a plain-language report every 5 min and at stop (`POST /api/station/:id/activity`); surgeon sees it on the Live tab with a coloured timeline bar. Deterministic template, no cloud. |
| Test alert | Per recognised person, sends a labelled DRILL alert in 3 s. |
| Wake lock, flip, https hint | `data/cameraSupport.ts` explains how to get https on a phone. |
| Private link (unused by the UI) | `/cam/[token]`, `POST /api/me/cam-link` kept for later. |

### Exercise counting (push-ups, pull-ups, squats; curls removed)
`mobile/src/data/pose.ts`, `kit/CameraTracker.tsx` (Training tab, behind a button). MediaPipe **world (3D) landmarks** so the camera angle does not matter, posture gates (push-up: torso horizontal; pull-up: hands above shoulders), median + One Euro smoothing, hysteresis state machine, minimum swing and rep gap. Push-ups/pull-ups use the bundled **heavy** pose model. Tests: `mobile/test/pose.test.mts`. No standalone pretrained push-up model exists in maintained form; this is the standard pose-model + rules approach.
In orbit crews use ARED/CEVIS/T2; the phone camera stands in for them in this prototype (says so in the app).

---

## 7. Calls

`mobile/src/live/calls.ts` (engine) · `CallPanel.tsx` (UI) · `Live.tsx` (provider) · `server/src/rtc.js` (signalling).

| Call | How |
|---|---|
| **Astronaut → doctors** | Today → "Call my doctor", Settings → "Call doctor": rings every online flight surgeon; the first to answer wins, the others stop ringing. |
| **Doctor → astronaut** | Call buttons on the admin overview, astronaut page and alert overlay. |
| **Crew ↔ crew** | Call button next to each online member. |
| **Astronaut ↔ family** | See below. |
| Engine | Voice + video, mute, camera off, timer; ring tone; audio-only fallback if no camera. Media goes directly between devices (WebRTC); the server only relays the handshake. STUN is `stun.l.google.com`; **add a TURN server for strict firewalls / internet use** (`ICE` in `calls.ts`). |
| Safety rules | A guest can only ring their own astronaut; crew calls need a shared crew; doctors may ring anyone. |

### Family: easy to add
`mobile/app/family.tsx`, `mobile/app/f/[token].tsx`, `server/src/team.js`.
1. Settings → Family → type a name, pick a relation → **Add and get link**.
2. Send the private link with WhatsApp, Telegram or copy.
3. The relative opens `/f/<token>` on any phone/computer: **no account, no app**. They can **call** the astronaut or **leave a message**; the astronaut sees unread messages and can reply. If the relative's page is closed, a ring waits 3 min for them.
4. The link is the credential: removing the contact invalidates it.

---

## 8. Admin (flight-surgeon) console

`mobile/app/admin/index.tsx`, `[id].tsx`, `reports.tsx` · `server/src/admin.js`. Open `/admin` (demo surgeon sign-in is automatic in demo mode).

- **Overview:** KPI tiles (astronauts, live alerts, handoffs, concerns), live alert banners with Call/Open, **tappable readiness bar chart** with a preview card, filters (All / Attention / Handoffs), cards with readiness ring, tags, plan progress.
- **Astronaut page tabs:**
  - *Overview:* alerts, 14-day **trend chart** (sleep/HRV/RHR/recovery, drag to read), handoff reports with Acknowledge + reply, progress tiles, today's plan.
  - *Live:* live camera, activity reports with timeline bar, emergency history.
  - *Plan:* send a ready plan (weekly template, sessions, zone 2, intensity, extra tasks), withdraw it.
  - *File:* what the app reported (body numbers, stress, radiation, food, camera reps), background file and downloads, private surgeon notes.
- **Anonymous concerns** inbox (`/admin/reports`) with "voices" count.
- Live connection badge; alerts reach the console in about a second.
- Prototype note: every surgeon sees every astronaut; a real deployment assigns crew and records consent.

---

## 9. Face recognition

`mobile/src/data/face.ts`, `mobile/src/kit/FaceScan.tsx`, `mobile/app/face.tsx`, `server/src/face.js`. Open-source **face-api.js** (MIT): tiny face detector, 68 landmarks, recognition net → 128 numbers. Models are bundled; nothing downloads at run time; nothing was trained.

| Step | How |
|---|---|
| Enrol | Settings → Face sign-in → agree → look straight, then turn slightly left/right (6 samples). Only the 128-number descriptors are stored (`PUT /api/me/face`). Delete any time. |
| **Sign in** | Enter email → "Sign in with my face" appears only if that email has a face → look, then turn your head one way and back (liveness) → server compares with **that account only** (distance ≤ 0.45), rate limited. Same answer for unknown accounts. Email code always works. |
| Identify at the station | Descriptor → `POST /api/station/identify`: nearest crew member, must beat the second best by 0.04, else "Unknown" (never guesses). |
| Honest limits | A video replay might fool the head-turn check; not bank-grade. Biometric data: consent required, deletable, removed with the account. |

---

## 10. Admin/security and privacy summary

- Video: never stored; live WebRTC and in-memory stills only; AI runs on the device.
- Face: 128 numbers, consent, deletable. Voice cloning feature was **removed** (and its stored recordings dropped).
- Wellbeing check: device only. Peer reports: author hash only. Pulse: anonymous, shown from 3 people.
- Secrets: `server/.env` is git-ignored and never zipped. Gemini key only there. **Rotate it** (it was shared in chat).
- Security headers: `Permissions-Policy: camera=(self), microphone=(self)`; rate limits on codes, face login, reports, SOS, family, frames.

---

## 11. Server API (grouped)

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/code`, `/code/verify`, `/login`, `/register`, `/logout`, `/forgot`, `/reset`; `GET /api/auth/me`; `POST /api/auth/face/login`; `GET /api/auth/face/available` |
| Account | `GET /api/account/export`, `PUT/DELETE /api/account`, `GET /api/health` |
| Health | `GET /api/dashboard`, `/api/metrics/:key`, `/api/catalog`, `/api/report`; `POST /api/measurements`, `/api/checkins`, `/api/ingest`; `GET/PUT /api/plan`, `POST /api/plan/tasks/:key/toggle` |
| WHOOP | `GET /api/integrations`, `POST /api/integrations/whoop/start|sync`, `GET .../callback`, `DELETE` variants |
| AI | `POST /api/assistant` |
| Astronaut app | `PUT /api/me/snapshot`, `GET /api/me/override`, `GET/PUT /api/me/background`, `POST/DELETE /api/me/files`, `GET /api/me/meal-events`, `GET /api/me/cam-status`, `POST /api/me/cam-link`, `GET/PUT/DELETE /api/me/face`, `PUT /api/me/handoffs/:id`, `GET /api/me/handoffs` |
| Crew | `GET/POST /api/crew`, `POST /api/crew/join|leave|feed|pulse|report`, `PUT /api/crew/briefing` |
| Family | `GET/POST /api/me/family`, `DELETE /api/me/family/:id`, `GET/POST /api/me/family/:id/messages`; public `GET /api/family/:token/info|messages`, `POST /api/family/:token/messages` |
| Alerts | `GET /api/alerts`, `POST /api/alerts/:id/ack`, `/api/alerts/sos`, `/api/alerts/test`; `POST /api/admin/alerts/:id/resolve`; `GET /api/admin/incidents` |
| Admin | `GET /api/admin/crew`, `/crew/:id`, `/crew/:id/activity`, `/crew/:id/cam`, `/crew/:id/cam/frame.jpg`, `/crew/:id/files/:fid`; `PUT /api/admin/crew/:id/override|notes`; `DELETE .../override`; `GET /api/admin/handoffs`, `POST .../handoffs/:uid/:id/ack`; `GET /api/admin/reports`, `POST .../reports/:id/seen`; `GET /api/admin/crews` |
| Camera station (demo) | `GET /api/station/crew`, `POST /api/station/identify`, `POST /api/station/:id/frame|stop|meal|incident|activity`, same under `/api/cam/:token/…` |
| Live sockets | `ws /rtc?role=inbox` (alerts, calls), `role=family&token=…`, `role=pub&station=…` (camera video), `role=view&user=…` (surgeon video) |

Database tables: `users, sessions, consents, measurements, checkins, plans, plan_overrides, snapshots, handoffs, cam_links, meal_events, activity_reports, crews, crew_members, peer_reports, crew_pulse, crew_feed, family_contacts, family_messages, incidents, incident_acks, face_templates, …` (created automatically).

---

## 12. Settings you may need (`server/.env`)

| Variable | Meaning |
|---|---|
| `PORT`, `HTTPS_PORT` | http 4000, https 4443 (needs `server/certs/{key,cert}.pem`, `npm run cert`) |
| `NODE_ENV=production` | turns **off** demo login and the camera station |
| `GEMINI_API_KEY`, `GEMINI_MODEL` / `ANTHROPIC_API_KEY` | AI tab |
| `EMAIL_VERIFICATION=on|auto`, `SMTP_*`, `RESEND_API_KEY`, `MAIL_FROM` | email codes (needed for real users) |
| `WHOOP_CLIENT_ID/SECRET/REDIRECT_URI`, `TOKEN_ENC_KEY` | WHOOP |
| `ADMIN_EMAILS` | extra admins |
| `DEMO_LOGIN`, `CAMERA_STATION` | demo only |
| `CORS_ORIGINS`, `APP_URL` | origins and public URL |

### Before a public domain
Production mode disables the demo login and the camera station, so you need real email sending, a first surgeon account, and ideally a TURN server for calls.

---

## 13. Removed or temporary

- **Removed:** biceps curls, Apple Watch, food photos, the family-voice AI with voice cloning, the stand-alone "AI companion".
- **Temporary (DEMO-ONLY):** one-click demo login, `/camera` station without sign-in, `EMAIL_VERIFICATION=auto`. See `DEMO_REMOVAL.md`.

## 14. Known limits (be honest in the demo)

- Real camera, microphone, face login, calls and the incident detector were **not tested on real people/devices** in development (browser pane blocks them); logic is covered by tests on simulated data.
- Incident thresholds are not clinically validated. Not a medical device.
- WebRTC calls and video need same-network access or a TURN server on strict networks.
- Native iOS/Android: calls, face and station run in the **web** build; native shows previews.
- Models bundled: MediaPipe Pose (full 9 MB, heavy 31 MB), EfficientDet-Lite0 (7 MB), face-api.js (~8 MB). The zip is ~78 MB for that reason.
