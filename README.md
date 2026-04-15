# VRC Print Remix Studio (Electron)

A professional, non-web desktop app for **editing already-made VRChat prints**.

## Why this version

You asked for a cleaner and more professional app, with better responsiveness than the previous Tkinter build. This rewrite uses **Electron + Canvas** with a modern dark-neon desktop UI and a debounced rendering pipeline.

## Workflow

1. Drag and drop a completed VRChat print into the app (or click **Load Print**).
2. Tweak it using structured tabs (Basic / FX / Border & Stickers / Export).
3. Export the final PNG.

## Features

- Professional desktop layout inspired by your theme direction.
- Real drag-and-drop for image files.
- Fast preview rendering via a staged canvas pipeline + `requestAnimationFrame` queue.
- Rich controls:
  - Fit/Rotate/Flip
  - Brightness/Contrast/Saturation/Sharpness
  - Warmth/Tint/Vignette/Grain/RGB Glitch
  - Border styles and sticker packs
  - Stamp text
- Project save/load (`.vrcprint.json`).
- Export presets (keep original size, VRChat dimensions, upscale x2).

## Install and run

```bash
npm install
npm run start
```

## Dev check

```bash
npm run check
```
