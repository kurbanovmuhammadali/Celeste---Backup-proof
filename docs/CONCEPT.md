# HMSC — Health Monitoring System Cometa

> *HMSC (Health Monitoring System Cometa).* The app keeps every astronaut close to the care they would get at home.

## 1. What the NASA challenge is really asking for

On a 6-month ISS increment, or a 2–3 year Mars mission, there is no clinic down the hall. Communication to Earth can be delayed by up to ~22 minutes each way (Mars), bandwidth is limited, and the flight surgeon sees the crew only in scheduled private medical conferences. **Astronauts must notice changes in their own body early and act on them.**

NASA's Human Research Program (HRP) describes five hazards of spaceflight (the RIDGE model):

| Hazard | What it does to the body | What the crew can measure |
|---|---|---|
| **R**adiation | DNA damage, cancer risk, CNS & cardiovascular effects | Dosimeter dose (mSv), blood counts (labs) |
| **I**solation & confinement | Stress, mood decline, sleep disruption, team conflict | Mood check-ins, sleep hours, HRV |
| **D**istance from Earth | No evacuation, delayed medical advice | Everything must be self-assessed |
| **G**ravity fields | Bone loss (~1–1.5 %/month in hip & spine), muscle atrophy, fluid shift, SANS (eye changes), orthostatic intolerance | Body mass, bone markers (urine/blood), exercise volume, BP, vision symptoms |
| Hostile closed **E**nvironment | CO₂ headaches, microbes, immune dysregulation, latent virus reactivation | Temperature, symptoms, CO₂ level, labs |

The challenge: **build a visual tool that gathers health indicators and lets an astronaut evaluate and act on their own health** — with clear colour coding, trends over time, simple explanations, routine prompts, gamification, and guidance on when to escalate to the flight surgeon.

## 2. Our idea in one sentence

**HMSC sits on top of the crew's existing health system — it does not replace it.** It reads continuous data from a wearable (WHOOP first), combines it with manual measurements, lab results and body composition, compares everything against the astronaut's *personal pre-flight baseline*, and then *adapts* the mission's prescribed health plan with clear, explainable suggestions.

Example (the core feature):

> **Mission plan:** Treadmill 1 km · ARED resistance 60 min
> **What we see:** urinary NTx (bone-resorption marker) up 18 % vs baseline for 2 weeks, WHOOP strain below target 4 of last 7 days.
> **HMSC suggests:** *"Your plan says 1 km. Your bone markers are getting worse — add +1 km of loaded treadmill today, for your own bones."* (within the crew exercise protocol; flagged to flight surgeon if it would exceed the protocol.)

## 3. How we help astronauts with their data — the loop

```
 ┌───────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐
 │  COLLECT  │ → │  NORMALISE   │ → │   EVALUATE   │ → │     ACT      │ → │   ESCALATE    │
 │ WHOOP,    │   │ one metric   │   │ vs personal  │   │ adaptive plan│   │ flight surgeon│
 │ manual,   │   │ model, units,│   │ baseline +   │   │ tasks, XP,   │   │ report when   │
 │ labs, body│   │ source, time │   │ clinical     │   │ education    │   │ red / trending│
 └───────────┘   └──────────────┘   │ ranges       │   └──────────────┘   └───────────────┘
                                    └──────────────┘
```

1. **Collect** – WHOOP (recovery, HRV, resting HR, SpO₂, skin temperature, sleep stages, strain, workouts, body measurements) via the official WHOOP API v2 with OAuth. Manual entry for what a band cannot measure: blood pressure, blood glucose, body temperature, body mass, mood, symptoms, vision changes, radiation dose, and lab panels (bone markers, vitamin D, haemoglobin, WBC…).
2. **Normalise** – every value becomes one record: `metric · value · unit · source · recorded_at`. A new source (Oura, Garmin, CSA's Astroskin/Bio-Monitor, NASA's own systems) only needs an *adapter* that outputs this record. The universal `/api/ingest` endpoint already accepts it.
3. **Evaluate** – each metric is scored **green / amber / red** using (a) clinical reference ranges and (b) deviation from *the astronaut's own baseline* (a 7-day trend matters more than one reading). Metrics roll up into 6 **body systems** shown on a clickable 3D body: Heart & vessels, Bones & muscle, Brain & mood, Eyes (SANS), Immune, Metabolism. A single **Readiness score** summarises the day.
4. **Act** – the mission plan (exercise, sleep window, nutrition, medical tasks) is imported as-is. The adaptation engine adds explainable suggestions ("why" + "what" + "how much"), daily measurement prompts, and an XP/streak system so routine self-checks become a habit.
5. **Escalate** – red flags (e.g., BP ≥ 140/90 repeatedly, SpO₂ < 92 %, fever, vision change, chest pain) are never "gamified away": the app tells the astronaut to contact the flight surgeon and generates a one-tap report (store-and-forward, works with comms delays).

## 4. What we use to track health today (no official NASA data yet)

| Data | Source now | Ready for later |
|---|---|---|
| HRV, resting HR, recovery, sleep, strain, SpO₂, skin temp | **WHOOP API v2** (real OAuth) or realistic demo data | Any wearable adapter |
| BP, glucose, body temp, mass, mood, symptoms | Manual entry in the app | Bluetooth devices |
| Labs (bone markers, vitamin D, Hb, WBC) | Manual entry / CSV-JSON import | NASA lab results feed, FHIR Observation import |
| Radiation dose | Manual entry | Station dosimeter feed (e.g. ISS RAD / crew personal dosimeters) |
| Reference ranges & risks | Public clinical ranges + NASA HRP Human System Risks | NASA OSDR / LSDA datasets, flight-surgeon-specific thresholds |

The architecture keeps **thresholds and plans as data, not code**, so when NASA (or a flight surgeon) provides official ranges and plans they are swapped in without rewriting the app.

Public resources we build on:
- NASA HRP — Human Research Roadmap & five hazards: https://www.nasa.gov/hrp/hazards
- NASA Open Science Data Repository (OSDR): https://osdr.nasa.gov
- NASA Life Sciences Data Archive (LSDA): https://lsda.jsc.nasa.gov
- NASA Twins Study, CSA Bio-Monitor/Astroskin, ESA astronaut health research
- WHOOP Developer API v2: https://developer.whoop.com/api/

## 5. Important honesty notes (judges will ask)

- WHOOP's cloud API needs internet. In orbit, data would sync over the station's network (ISS has it); on Mars it would be store-and-forward. HMSC is **offline-first in design**: the evaluation engine runs on the crew's own server/device.
- WHOOP is not validated for microgravity. That is exactly why we compare against a *personal baseline* and combine it with clinical measurements, instead of trusting one sensor.
- The app gives guidance and escalation — it does **not** diagnose or prescribe. Flight surgeons stay in the loop.
