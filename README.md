# VRC Print Remix Studio (Desktop)

A **non-web desktop app** for editing **already-created VRChat prints** in a clean dark-neon environment inspired by your provided theme.

## What this app is for

VRChat already has its own print maker; this tool is a post-process editor.

**Workflow:**
1. Drag/drop or browse an existing print image.
2. Use dropdowns/sliders/tabs to remix it.
3. Export a polished PNG.

## Features

- VRC-style dark neon desktop UI with sidebar + dashboard cards.
- Import existing print and edit non-destructively in a live preview.
- Organized tabs for **Basic**, **FX**, **Borders & Stickers**, and **Export**.
- Lots of controls:
  - Fit mode, rotate, flip
  - Brightness/contrast/saturation/sharpness
  - Warmth/tint/vignette/grain/RGB glitch
  - Creative border styles + sticker packs
  - Signature stamp text
- Quality-of-life:
  - Random look generator
  - Undo/redo
  - Save/load project (`.vrcprint.json`)
  - Copy current settings as JSON
- Export presets including keep-original-size and VRChat-friendly dimensions.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Note on drag-and-drop

The app attempts to enable native `tkdnd` drag-and-drop when available in your Tk installation. If not available, use the **Drop/Browse Print** button.
