# the eyes, chico

An interactive web installation by [Sinaida](https://sinaida.eu) · [@sin.ai.da](https://www.instagram.com/sin.ai.da/)

A field of eyes, a field of poppies, a glowing figure you steer through it.
Fifty of the flowers hold questions you can only answer in your own head —
inspired by Arthur Aron's 36 questions, rewritten for an audience of one.

## Run

Static site, no build step. Serve the folder with any web server:

```
python3 -m http.server 4791
```

Open http://localhost:4791. Deployable as-is to GitHub Pages.

## Stack

- Three.js (vendored in `/vendor`) — instanced eyeball/poppy field, GPU-particle avatar
- Raymarched log-polar fBm nebula sky, rendered to a low-res target
- Single-pass VHS/RGB-delay/glitch post-processing
- MediaPipe Hands (lazy-loaded from CDN, opt-in) — palm steer / fist dive / pinch pick
- Web Audio generative drone + vinyl crackle, no audio files
- Adaptive quality tiers (`?tier=0|1|2` to force) with a runtime FPS governor
- No analytics, no cookies; localStorage only, behind consent

© Sinaida Krivchenko. Artwork and text all rights reserved.
