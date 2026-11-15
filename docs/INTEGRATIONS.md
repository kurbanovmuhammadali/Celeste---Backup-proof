# Data integrations

Every source is normalised into one record:

```json
{ "metric": "hrv", "value": 52.3, "value2": null, "unit": "ms", "source": "whoop", "recordedAt": "2026-11-08T06:30:00Z" }
```

Metric keys and thresholds live in `server/src/health/catalog.js` (data, not code).

## WHOOP (live)

1. Create an app at https://developer-dashboard.whoop.com/ → copy Client ID / Secret.
2. Redirect URL: `http://localhost:4000/api/integrations/whoop/callback` (dev) and `https://<your-domain>/api/integrations/whoop/callback` (prod).
3. `server/.env`:
   ```
   WHOOP_CLIENT_ID=...
   WHOOP_CLIENT_SECRET=...
   WHOOP_REDIRECT_URI=http://localhost:4000/api/integrations/whoop/callback
   TOKEN_ENC_KEY=<long random string>
   ```
4. In the app: Profile → Data sources → Connect WHOOP.

Scopes: `offline read:recovery read:cycles read:sleep read:workout read:body_measurement`.
Mapped: recovery score, HRV (RMSSD), resting HR, SpO₂ → `/v2/recovery`; sleep hours → `/v2/activity/sleep`; day strain → `/v2/cycle`; body mass → `/v2/user/measurement/body`. Tokens are AES-256-GCM encrypted at rest and refreshed automatically; disconnect revokes access (`DELETE /v2/user/access`).

## NASA / other sources (ready)

`POST /api/ingest` (authenticated):

```json
{ "source": "nasa-lab", "records": [
  { "metric": "ntx", "value": 41.2, "recordedAt": "2026-11-07T08:00:00Z", "externalId": "lab-123" },
  { "metric": "vitd", "value": 28 }
] }
```

Use it for: NASA lab panels, station dosimeters (`radiation`), cabin CO₂ (`co2`), CSA Bio-Monitor/Astroskin, Oura, Garmin. Add new metric types in `catalog.js` — the dashboard, trends, body map and plan engine pick them up automatically.

## Mission plan import

`PUT /api/plan` replaces the base plan with the one from mission control / the flight surgeon. HMSC never edits these items — it only adds adaptations with a reason and flags anything outside protocol as "needs approval".
