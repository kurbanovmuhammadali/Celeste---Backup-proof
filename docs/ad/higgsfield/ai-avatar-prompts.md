# Celeste AI avatar — Higgsfield prompts (comet intro + voice states)

You generate these on Higgsfield and send me the clips. I put them into the app:
- the **comet intro** plays the first time the AI tab opens and ends exactly on the avatar in its place;
- the **voice states** are short seamless loops. In the app I layer them and drive **size and glow from the
  live microphone / speaker volume** (louder → the avatar swells and shines brighter, quiet → it settles back),
  like ChatGPT's voice mode but with our copper planet.

## Settings for every clip
| Setting | Value |
|---|---|
| Aspect ratio | **1:1** (the avatar is square in the app) |
| Resolution | **1080p** (draft at 480p first if you want to save credits) |
| Audio | **off** |
| Background | solid warm sand **#F7EEE8** (the app's background colour, so the clip blends in with no visible box) |

## Reference images to attach (from the project)
- AI avatar (copper planet with ring) → `mobile/assets/ai/avatar.png`
- Comet rock → `mobile/assets/ai/comet.png`
- Fire trail → `mobile/assets/ai/trail.png`

## Which model
- **Seedance 2.5** (`mode: omni_reference`) — all clips. It keeps our avatar looking exactly like the reference and accepts a **start_image** and **end_image**: for the loops use the avatar for **both**, so the clip loops without a jump.
- Optional alternative for the loops: **MiniMax H3 Max** (start_image + end_image = avatar), if Seedance moves the planet too much.

Style line used in every prompt: *warm copper and sand palette, soft studio light, premium minimal product animation, smooth easing, no text, no UI, plain #F7EEE8 background.*

---

### 1 · Comet intro (Seedance 2.5 · 6 s · refs: comet, trail, avatar · end_image = avatar)
```
On a plain warm sand background (#F7EEE8), a single thin glowing copper line draws itself horizontally across the centre of the frame. A small dark faceted rock comet with a soft flowing copper-orange fire trail streaks in from the top right corner and strikes the exact centre of the line. A soft warm flash; the line bends and wraps around the rock, closing smoothly into a perfect thin copper ring. The rock transforms into the glowing copper-marble planet from the reference image, sitting inside its ring, gently floating in the centre. Camera static. Warm copper and sand palette, soft studio light, premium minimal product animation, smooth easing, no text, no UI.
```

### 2 · Idle loop (Seedance 2.5 · 5 s · ref: avatar · start_image = end_image = avatar)
```
The copper-marble planet with its thin copper ring from the reference image floats calmly in the centre of a plain warm sand background (#F7EEE8). Very slow breathing: it rises a few pixels and settles, soft light drifts across its marbled surface, the small four-point star on the planet twinkles once. Seamless loop, the last frame identical to the first. Camera static. Warm copper and sand palette, soft studio light, premium minimal product animation, no text.
```

### 3 · Listening loop (Seedance 2.5 · 4 s · ref: avatar · start_image = end_image = avatar)
```
The copper planet with its ring from the reference image, centred on a plain warm sand background (#F7EEE8), is listening: a soft warm halo glows around it and gently expands and contracts in small irregular pulses like reacting to a voice, the ring brightens slightly, fine golden light ripples across the planet's surface. The planet stays in place. Seamless loop, last frame identical to the first. Warm copper and sand palette, soft studio light, premium minimal product animation, no text.
```

### 4 · Speaking loop (Seedance 2.5 · 4 s · ref: avatar · start_image = end_image = avatar)
```
The copper planet with its ring from the reference image, centred on a plain warm sand background (#F7EEE8), is speaking: it swells and settles rhythmically like a voice, growing about 8% and shining brighter on each beat, the inner marble swirls flow faster, the ring glows and emits a soft wave of light outward on the strongest beats. Seamless loop, last frame identical to the first. Warm copper and sand palette, soft studio light, premium minimal product animation, no text.
```

### 5 · Thinking loop (Seedance 2.5 · 4 s · ref: avatar · start_image = end_image = avatar)
```
The copper planet with its ring from the reference image, centred on a plain warm sand background (#F7EEE8), is thinking: the thin ring slowly tilts and rotates around the planet like an orbit, a few tiny copper sparks travel along the ring, the planet's light dims slightly and then returns. Calm, focused. Seamless loop, last frame identical to the first. Warm copper and sand palette, soft studio light, premium minimal product animation, no text.
```

---

## What I do with the clips
1. **Comet intro** replaces the current coded animation on the first open of the AI tab; its last frame equals the avatar in place, so there is no visible hand-off.
2. **Idle / listening / speaking / thinking** loops play in place of the static avatar. On top, the app scales the avatar (≈ 1.00 → 1.12) and brightens a copper glow layer from the **live audio level** — your microphone while you talk, Celeste's voice while she answers — smoothed so it never jitters.
3. If a clip's background isn't exactly #F7EEE8, I colour-match it in the edit.
