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
  - Fit/Zoom/Pan/Rotate/Flip
  - Brightness/Contrast/Saturation/Sharpness
  - Warmth/Tint/Blur/Hue Shift
  - Vignette/Grain/Scanlines/RGB Glitch
  - Border styles and sticker packs (with layout regeneration)
  - Stamp text and export background fill modes
- Project save/load (`.vrcprint.json`).
- Export presets (keep original size, VRChat dimensions, upscale x2).

## Windows PowerShell quickstart

Use these exact commands (do **not** type `install` or `run build` by themselves):

```powershell
npm install
npm run start
```

## Build installers / packaged app

```powershell
# verify scripts are available
npm run

# sanity check
npm run check

# unpacked build output (quick local validation)
npm run build

# full distributables in ./release
npm run dist
```

### Optional platform-specific build commands

```powershell
npm run build:win
npm run build:portable
npm run build:nsis
npm run build:linux
```

### Build outputs

- **Windows**: NSIS installer + portable executable.
- **Linux**: AppImage + `.deb` package.
- **macOS**: `.dmg`.

All artifacts are generated in the `release/` directory.

## If you get `Missing script: "build"`

You are most likely in an older copy of the project that does not include the updated `package.json` scripts.

1. Run `npm run` and confirm `build` is listed.
2. If `build` is missing, re-download or pull the latest repo version.
3. Delete `node_modules` + `package-lock.json`, then run `npm install` again.
