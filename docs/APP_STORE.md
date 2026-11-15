# Shipping HMSC to the App Store

The iOS app is the Expo project in `mobile/`. EAS Build compiles it in Expo's cloud, so you do **not** need Xcode locally.

## Already prepared in the project

- `app.json`: bundle ID `space.perigee.crewhealth` (change to one you own), version 1.0.0, portrait, iPad support, URL scheme `perigee://` (WHOOP OAuth return).
- `ITSAppUsesNonExemptEncryption: false` (standard HTTPS only).
- Privacy manifest: health, fitness, email, name declared as *linked, not tracking, app functionality*; `UserDefaults` reason `CA92.1`.
- In-app **account deletion**, data export, Terms, Privacy Policy, explicit health-data consent, 18+ age gate.
- Medical disclaimer ("not a medical device") and escalation to a professional (guideline 1.4.1).
- No ads, no tracking SDKs → no ATT prompt needed.
- `eas.json` with development / preview / production profiles. Set `EXPO_PUBLIC_API_URL` to your deployed HTTPS server.

## Steps

1. Deploy `server/` on HTTPS (see README). Put that URL into `mobile/eas.json` → `EXPO_PUBLIC_API_URL`.
2. Apple Developer account ($99/yr). Register the bundle ID.
3. In `mobile/`:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build:configure
   npx eas-cli@latest build --platform ios --profile production
   npx eas-cli@latest submit --platform ios --profile production
   ```
4. In App Store Connect: app name, subtitle ("Crew health, in orbit"), description, keywords, **age rating 17+** (medical/treatment information), support URL, privacy policy URL (host `LEGAL.privacy` as a web page — the web build already serves `/legal/privacy`), App Privacy questionnaire matching the manifest above, screenshots (6.9" and 13" iPad).
5. Review notes: give the reviewer a demo account (create one on the production server) and explain that data is synthetic unless WHOOP is connected.

## Before public release (not just TestFlight)

- Replace `privacy@perigee.example` in `mobile/src/legal.ts` with a real contact and company/team name.
- Plug an email provider into `/api/auth/forgot` (currently logs the link).
- Confirm WHOOP developer terms allow distribution; WHOOP may require app review on their side.
- Do not use the NASA logo or claim NASA endorsement.
- Positioning: "health companion / wellness" — diagnosis or treatment claims would make it regulated medical software (FDA SaMD).
