# Sky Stack

A one-tap HTML5 stacking game built for **YouTube Playables**. It has no dependencies and no build step.

## Play locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Controls

Tap, click, or press Space/Enter to drop the block. Land it exactly on the block below for a **PERFECT**. Three or more perfects in a row make the block grow back.

## YouTube Playables integration (`src/sdk.js`)

| Requirement | Where |
|---|---|
| SDK loaded before game code | `index.html` `<head>` |
| `firstFrameReady()` | `boot()` after the first render |
| `gameReady()` | `boot()` once input is live |
| `onPause` / `onResume` | stops the render loop and suspends audio |
| `isAudioEnabled` / `onAudioEnabledChange` | `applyAudio()` |
| Cloud save (`saveData` / `loadData`) | best score |
| `sendScore` | on game over |
| Rewarded ad | "Continue" button, once per run |
| Interstitial ad | every 3rd restart |

Outside YouTube, everything falls back gracefully: `localStorage` for saves, Page Visibility for pausing, and simulated ads. The same build can therefore be hosted anywhere as a public demo.

## Package for upload

```bash
./package.sh   # -> dist/sky-stack.zip (index.html at the ZIP root)
```
