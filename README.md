# SeaFit

SeaFit adds a compact aspect-ratio control directly to Seanime's built-in video player. One button cycles through three display modes and changes its icon to show the active mode.

## Modes

- **Original / Fit** — Seanime's normal behavior. The full video remains visible and keeps its original aspect ratio.
- **Crop / Fill** — fills the entire player while preserving aspect ratio, cropping overflow when needed.
- **Stretch** — forces the video to fill the player dimensions, even when that changes the video's aspect ratio.

The cycle is:

**Original / Fit → Crop / Fill → Stretch → Original / Fit**

## Features

- Adds only one button to the native Seanime player controls.
- The icon changes immediately to match the active mode.
- Shows a hover tooltip with the current mode.
- Works in normal and fullscreen playback.
- Supports Seanime's desktop and mobile control layouts.
- Remembers the selected mode across episode changes and app refreshes.
- Automatically reattaches when Seanime rerenders or replaces the video player.
- Uses the normal Seanime video element; no replacement player is created.

## Install

Add this manifest URL to Seanime:

```text
https://raw.githubusercontent.com/DefnoJae/SeaFit/refs/heads/main/Manifest.json
```

## Usage

Start playing a video and look near the fullscreen control. SeaFit starts in **Original / Fit** mode on first use.

Click the SeaFit button to cycle the display mode. Your last selected mode is remembered automatically and applied to the next episode.

## How it works

SeaFit changes the native video element's `object-fit` behavior:

- Original / Fit: `contain`
- Crop / Fill: `cover`
- Stretch: `fill`

This means playback, subtitles, seeking, volume, quality selection, and the rest of Seanime's player remain untouched.

## Version

Current release: **0.1.0**
