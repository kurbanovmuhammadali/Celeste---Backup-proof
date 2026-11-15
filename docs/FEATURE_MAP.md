# Where the partner's HMSC features go in Celeste

Source: the partner's `FEATURES.md` (HMSC). Their code is **not in this repo yet** (no `team.js`, `rtc.js`, `cam.js`, `face.js`, `admin.js` here) — this map says where each feature lands when it is ported.

## Rules (so nothing feels overloaded)

1. **Still five tabs:** Home · Mission · AI · Body · Profile. No sixth tab.
2. **Each feature lives in one place.** Other places only link to it.
3. **Home shows one summary and one action**, never a full tool.
4. **Alerts and calls are layers, not pages.** They appear over any screen when needed.
5. **Surgeon, camera station and judge tools are separate surfaces**, never inside the crew tabs.

## Map

| Partner feature | Goes to | Notes |
|---|---|---|
| **HOME** — today at a glance | | |
| Attention card, what changed since yesterday | Home (already built) | Keep one attention card. |
| Readiness score (health engine) | Home, as a small ring in the header next to "Day 42" | One number; tap opens Body. |
| Crew presence (who is online) | Home header: a stack of crew-mate avatars | Tap opens My crew. No health data shown. |
| "Call my doctor" | Home, inside the attention card when it is red | Not a separate button the rest of the time. |
| Daily check, wellbeing check, meal ticks | Home › **Check** button (already in the header) | Wellbeing becomes a **private** step with a lock icon (stays on the device). Meal "Did you eat?" ticks go here too. |
| **MISSION › Hazards & health** | | |
| Radiation module, DONKI, shelter drill | Mission › R hazard → Radiation page (already built) | The drill goes there as "Practice drill". |
| Crew pulse (anonymous mood) | Mission › I hazard (Isolation) | Shown only once 3 or more people have answered. |
| Anonymous concerns about a crew mate | Mission › I hazard → "Raise a concern" | Also from a crew mate's card in My crew. |
| EVA readiness | Mission (already built) | |
| Offline handoff and the flight-surgeon queue | Mission › Flight surgeon (already built) | Add "Call surgeon" at the top of that page. |
| Mission briefing / shared crew environment | Mission header tag → Briefing (already built) | When the commander shares a briefing, the tag says "Crew briefing". |
| **MISSION › Training** | | |
| Training plan, ARED/CEVIS/T2 sessions | Mission › Training (built in this change) | |
| Flight-surgeon plan override | Mission › Training: a banner above today's session saying "Plan from your flight surgeon" | Replaces the plan; that banner is the only new element. |
| Push-up / pull-up / squat counting | Mission › Training › **Form check** tile (already there) | Use the partner's `pose.ts` (world landmarks) here. |
| Personal plan: heart-rate zones, kcal, protein, water | Mission › Training › "Fuel & zones" card under This week | One card, collapsed by default. |
| Nutrition targets vs eaten | Same "Fuel & zones" card | Meal ticks come from the daily check. |
| **AI** | | |
| Health assistant (Gemini / Claude, distress safety) | AI tab | Replace the demo replies with the partner's `/api/assistant`. |
| **BODY** | | |
| 6 body systems (heart, bones, brain, eyes, immune, metabolism) | Body tab markers + findings list | Matches the existing map. |
| Sensor confidence, data freshness | Reading sheet (already built) | |
| Inspiration4 real NASA data | Body › NASA research card (already built) | |
| **PROFILE** | | |
| My crew: create/join (code `K7M-2QX`), members, board, kudos, leave | Profile › **My crew** (new page) | Calls to crew mates are made from this page. |
| Family contacts, private link, messages, calls | Profile › **Family** (new page) | Unread messages show a dot on the Profile tab. |
| Background file (CV, conditions, files, consent) | Profile › **Medical file** (new page) | |
| Face sign-in enrolment | Profile › Face scan (already there) | Login screen gets "Sign in with my face" once a face is enrolled. |
| WHOOP, manual data source | Profile › Connected data (already built) | |
| Export / delete account, legal | Profile › Account (already built) | |
| SOS / emergency | Profile › Safety › Emergency (already built) | Kept off Home on purpose (your earlier decision). |
| Judge demo mode | Profile › Demo & presentation (already built) | |
| Camera station (`/camera`) | Profile › Demo & presentation › "Open camera station" | Demo only; laptop only. |
| **GLOBAL LAYERS** (any screen) | | |
| Emergency alert overlay (red, sound, "I am responding") | Full-screen layer from `Live.tsx` | Mount once in `app/_layout.tsx`. |
| Incoming / outgoing calls | Call sheet layer from `CallPanel.tsx` | Same place. |
| **SEPARATE SURFACES** (not in crew tabs) | | |
| Flight-surgeon console (`/admin`): overview, astronaut page, plan override, concerns inbox, alert resolve, activity reports | `/admin` web only, surgeon role | Reached from the laptop sidebar only when the user is a surgeon. |
| Activity reports, meal detection, live HD video | Surgeon console › Live tab | The astronaut only sees the result (meal auto-ticked). |
| Family page `/f/<token>` | Its own page with no account | |

## What gets new screens

Only four: **My crew**, **Family**, **Medical file** (all under Profile), and the **Fuel & zones** card in Training. Everything else either exists already or is a link from a page that does.
