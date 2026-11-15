# Celeste — laptop intro film (16:9) · Higgsfield shot list

Goal: a longer (~50 s), more dynamic 16:9 film for Mac / laptop screens. You generate the 7 clips below on
Higgsfield and send them to me; I cut them together with the Celeste typography, the five-hazard titles,
real app screens, music, and make the last frame hand over seamlessly to the Welcome screen.

**No text, logos or UI in any clip** — I add all typography and app screens in the edit.

## Settings for every shot
| Setting | Value |
|---|---|
| Aspect ratio | **16:9** |
| Resolution | **1080p** (draft at 480p first if you want to save credits) |
| Audio | **off** (I add one music track across the whole film) |
| Style line (already inside every prompt) | warm copper and sand palette, soft cinematic light, shallow depth of field, slow confident camera, photoreal, no text |

## Which model
- **Seedance 2.5** (`mode: omni_reference`) — shots 1, 2, 4, 6, 7. Best at keeping our ship / planets / avatar looking like the reference images, and it accepts a start + end frame for clean cuts. Duration 6–8 s.
- **Cinema Studio Video** (genre `spectacle`, mode `pro`, speedramp `slowmo`) — shots 3 and 5 (the human, emotional moments). Duration 6–8 s.

## Reference images to attach (from the project)
- Ship → `mobile/assets/space/ship.png`
- Earth → `mobile/assets/space/earth.png`
- Mars → `mobile/assets/space/mars.png`
- Jupiter → `mobile/assets/space/jupiter.png`
- AI avatar (copper planet with ring) → `mobile/assets/ai/avatar.png`
- Comet + fire → `mobile/assets/ai/comet.png`, `mobile/assets/ai/trail.png`
- Glass body → `mobile/assets/body/glass.png`

---

### Shot 1 — Departure (Seedance 2.5 · 8 s · refs: ship, Earth)
```
Cinematic wide shot in deep space. The spacecraft from the reference image glides slowly from right to left past a huge, softly lit Earth that fills the lower third of the frame, sunrise rim light along the planet's edge. The camera drifts alongside the ship, then slowly pushes past it toward the dark empty space ahead, leaving open negative space in the upper left. Warm copper and sand palette, soft cinematic light, shallow depth of field, slow confident camera, photoreal, no text, no logos.
```

### Shot 2 — Radiation (Seedance 2.5 · 7 s · refs: ship)
```
The same spacecraft travels through deep space as a solar particle storm arrives: thin glowing copper and amber particle streaks pass diagonally across the frame, a faint shimmering shield of light flickers along the ship's hull, distant sun flaring on the right edge. Camera slowly orbits the ship from its side to its front. Tense but beautiful, not explosive. Warm copper and sand palette, soft cinematic light, shallow depth of field, slow confident camera, photoreal, no text, no logos.
```

### Shot 3 — Isolation (Cinema Studio Video · spectacle · 7 s · no refs)
```
Inside a small, quiet spacecraft cabin. An astronaut in a soft beige flight shirt floats near a round window, seen from behind and slightly to the side, face not visible, looking out at a tiny distant blue dot. Warm low cabin light, a few floating items drift slowly. The camera pushes in very slowly toward the window. Calm, lonely, intimate mood. Warm copper and sand palette, shallow depth of field, photoreal, no text, no screens with writing.
```

### Shot 4 — Altered gravity / the body (Seedance 2.5 · 7 s · refs: glass body)
```
A translucent glass human figure like the reference image, faceless, floating upright in a dark warm void, slowly rotating a quarter turn. Inside, the organs and skeleton glow softly; a gentle copper light pulses once at the hips and once at the chest, like a quiet scan passing through the body from top to bottom. Camera slowly circles. Clean, medical, elegant, not scary. Warm copper and sand palette, soft cinematic light, shallow depth of field, photoreal 3D render, no text, no UI.
```

### Shot 5 — The crew member checks in (Cinema Studio Video · spectacle · 6 s · no refs)
```
Close-up of an astronaut's hands holding a phone inside a spacecraft, the phone screen is a soft warm glowing blank light (no readable text), cabin softly lit in copper tones, the astronaut's sleeve and a floating pen in the background slightly out of focus. The hands relax, a small reassured movement. Camera slow push-in. Warm, human, hopeful. Warm copper and sand palette, shallow depth of field, photoreal, no text, no logos.
```

### Shot 6 — Celeste appears (Seedance 2.5 · 8 s · refs: comet, trail, AI avatar)
```
Dark warm space with a single thin glowing copper line stretched horizontally across the middle of the frame. A small dark rock comet with a soft flowing orange fire trail streaks in from the top right and strikes the centre of the line; a soft flash; the line bends and wraps around the rock, closing into a perfect copper ring; the rock transforms into the glowing copper planet from the reference image, sitting inside its ring, gently floating. Camera static then a slow push-in at the end. Elegant, magical, minimal. Warm copper and sand palette, soft cinematic light, photoreal, no text.
```
(Tip: use the avatar image as **end_image** so the last frame matches the app's assistant exactly.)

### Shot 7 — Arrival at Mars (Seedance 2.5 · 8 s · refs: ship, Mars · end_image = Welcome background)
```
The spacecraft from the reference image arrives above Mars: the planet's horizon curves across the lower half of the frame, thin atmosphere glowing at the limb, the ship drifts slowly into the upper right and settles, gently floating. Camera slowly rises and settles into a calm, still final composition with the ship in the upper right and open warm sky in the upper left. Warm copper and sand palette, soft cinematic light, shallow depth of field, slow confident camera, photoreal, no text, no logos.
```
(Tip: for the cleanest hand-off, set **end_image** to `docs/ad/assets/app/welcome.png` cropped to 16:9 — or just send me the clip and I'll match it in the edit.)

---

## What I do with the clips
1. Cut order: 1 → 2 → 3 → 4 → 5 → 6 → 7 (≈ 50 s), whip-dissolves between shots.
2. Over shots 2–4 the five NASA hazards appear one by one (Radiation · Isolation · Distance · Gravity · Environment).
3. Shot 5 cuts into real app screens (Home hazards → attention card → re-measure) inside the phone frame.
4. Shot 6 ends on "Hello" in the assistant's exact layout; shot 7 ends on the Welcome background so the film hands over to sign-up / log-in with no visible jump.
5. Music: the existing original track, extended to the new length, sound **on** by default.
