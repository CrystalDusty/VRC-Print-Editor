#!/usr/bin/env python3
"""VRC Print Remix Studio - desktop editor for already-created VRChat prints."""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps, ImageStat, ImageTk, ImageDraw, ImageFont

APP_BG = "#07090f"
PANEL_BG = "#0d1018"
CARD_BG = "#101420"
ACCENT = "#e84ea5"
TEXT = "#dde1ec"
MUTED = "#8a90a4"

EXPORT_PRESETS = {
    "Keep original print size": None,
    "VRChat Landscape 4096x2048": (4096, 2048),
    "VRChat Square 2048x2048": (2048, 2048),
    "VRChat Portrait 1536x2048": (1536, 2048),
    "Upscale x2": "2x",
}


@dataclass
class EditState:
    fit_mode: str = "Contain"
    brightness: int = 100
    contrast: int = 100
    saturation: int = 100
    sharpness: int = 100
    warmth: int = 0
    tint: int = 0
    vignette: int = 0
    grain: int = 0
    glitch_shift: int = 0
    border_style: str = "None"
    border_size: int = 32
    border_color: str = "#f4f6ff"
    sticker_pack: str = "None"
    sticker_density: int = 16
    stamp_text: str = ""
    rotate: str = "None"
    flip: str = "None"
    export_preset: str = "Keep original print size"
    source_image: str = ""


class PrintEditorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("VRC Print Remix Studio")
        self.geometry("1520x930")
        self.minsize(1250, 760)
        self.configure(bg=APP_BG)

        self.state = EditState()
        self.undo_stack: list[EditState] = []
        self.redo_stack: list[EditState] = []
        self.source_image: Image.Image | None = None
        self.preview_image: ImageTk.PhotoImage | None = None
        self._dnd_enabled = False

        self._build_theme()
        self._build_layout()
        self._wire_defaults()
        self._enable_best_effort_dnd()
        self._render_preview()

    def _build_theme(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("App.TFrame", background=APP_BG)
        style.configure("Sidebar.TFrame", background="#05070b")
        style.configure("Panel.TFrame", background=PANEL_BG)
        style.configure("Card.TFrame", background=CARD_BG)
        style.configure("Title.TLabel", background=APP_BG, foreground=TEXT, font=("Segoe UI", 21, "bold"))
        style.configure("Subtitle.TLabel", background=APP_BG, foreground=MUTED, font=("Segoe UI", 10))
        style.configure("CardTitle.TLabel", background=CARD_BG, foreground=TEXT, font=("Segoe UI", 10, "bold"))
        style.configure("CardValue.TLabel", background=CARD_BG, foreground=ACCENT, font=("Segoe UI", 16, "bold"))
        style.configure("Side.TLabel", background="#05070b", foreground="#c3c8d7", font=("Segoe UI", 10))
        style.configure("SideHeader.TLabel", background="#05070b", foreground="#edf0f8", font=("Segoe UI", 13, "bold"))
        style.configure("SideMuted.TLabel", background="#05070b", foreground=MUTED, font=("Segoe UI", 9))
        style.configure("TLabel", background=PANEL_BG, foreground=TEXT)
        style.configure("TNotebook", background=PANEL_BG, borderwidth=0)
        style.configure("TNotebook.Tab", background="#11172a", foreground="#c9cee0", padding=(10, 6))
        style.map("TNotebook.Tab", background=[("selected", "#1f1a2d")], foreground=[("selected", "#ffffff")])
        style.configure("TCombobox", fieldbackground="#131a2c", foreground="#eef0f7", bordercolor="#242d44")
        style.configure("TEntry", fieldbackground="#131a2c", foreground="#eef0f7")
        style.configure("Horizontal.TScale", background=PANEL_BG, troughcolor="#1e2538")
        style.configure("Primary.TButton", background="#301234", foreground="#fff", borderwidth=0, padding=8)
        style.map("Primary.TButton", background=[("active", "#541659")])
        style.configure("Ghost.TButton", background="#151d2d", foreground="#dce0eb", borderwidth=0, padding=8)
        style.map("Ghost.TButton", background=[("active", "#202941")])

    def _build_layout(self) -> None:
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        self.sidebar = ttk.Frame(self, style="Sidebar.TFrame", padding=15)
        self.sidebar.grid(row=0, column=0, sticky="ns")
        self.sidebar.rowconfigure(20, weight=1)
        ttk.Label(self.sidebar, text="VRC Studio", style="SideHeader.TLabel").grid(row=0, column=0, sticky="w", pady=(0, 14))
        menu = ["Print Remix", "Quick Looks", "Borders", "Stickers", "Export", "Settings"]
        for i, item in enumerate(menu, start=1):
            color = "#ff62b2" if i == 1 else "#bbc1d3"
            ttk.Label(self.sidebar, text=f"• {item}", style="Side.TLabel", foreground=color).grid(row=i, column=0, sticky="w", pady=5)
        self.drop_status = tk.StringVar(value="Drag & drop: trying to enable…")
        ttk.Label(self.sidebar, textvariable=self.drop_status, style="SideMuted.TLabel").grid(row=21, column=0, sticky="sw", pady=(16, 0))

        self.main = ttk.Frame(self, style="App.TFrame", padding=16)
        self.main.grid(row=0, column=1, sticky="nsew")
        self.main.columnconfigure(0, weight=7)
        self.main.columnconfigure(1, weight=5)
        self.main.rowconfigure(2, weight=1)

        ttk.Label(self.main, text="VRChat Print Remix", style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(
            self.main,
            text="Built for editing existing VRChat prints. Drop a finished print, then tweak in a clean control panel.",
            style="Subtitle.TLabel",
        ).grid(row=1, column=0, sticky="w", pady=(0, 10))

        stat_box = ttk.Frame(self.main, style="App.TFrame")
        stat_box.grid(row=0, column=1, rowspan=2, sticky="e")
        self.file_name = tk.StringVar(value="No print loaded")
        self.size_text = tk.StringVar(value="--")
        self._stat(stat_box, "Print", self.file_name).grid(row=0, column=0, padx=6)
        self._stat(stat_box, "Canvas", self.size_text).grid(row=0, column=1, padx=6)

        # preview pane
        preview_panel = ttk.Frame(self.main, style="Panel.TFrame", padding=10)
        preview_panel.grid(row=2, column=0, sticky="nsew", padx=(0, 10))
        preview_panel.rowconfigure(1, weight=1)
        preview_panel.columnconfigure(0, weight=1)
        ttk.Label(preview_panel, text="Live Preview", style="CardTitle.TLabel").grid(row=0, column=0, sticky="w", pady=(0, 8))
        self.canvas = tk.Canvas(preview_panel, bg="#04060c", highlightthickness=0)
        self.canvas.grid(row=1, column=0, sticky="nsew")
        self.canvas.bind("<Configure>", lambda _e: self._render_preview())

        # controls
        ctrl = ttk.Frame(self.main, style="Panel.TFrame", padding=10)
        ctrl.grid(row=2, column=1, sticky="nsew")
        ctrl.rowconfigure(3, weight=1)
        ctrl.columnconfigure(0, weight=1)

        top_actions = ttk.Frame(ctrl, style="Panel.TFrame")
        top_actions.grid(row=0, column=0, sticky="ew")
        for i in range(3):
            top_actions.columnconfigure(i, weight=1)
        ttk.Button(top_actions, text="Drop/Browse Print", style="Primary.TButton", command=self._open_image).grid(row=0, column=0, sticky="ew", padx=(0, 6))
        ttk.Button(top_actions, text="Random Look", style="Ghost.TButton", command=self._randomize_look).grid(row=0, column=1, sticky="ew", padx=3)
        ttk.Button(top_actions, text="Reset", style="Ghost.TButton", command=self._reset_edits).grid(row=0, column=2, sticky="ew", padx=(6, 0))

        history_actions = ttk.Frame(ctrl, style="Panel.TFrame")
        history_actions.grid(row=1, column=0, sticky="ew", pady=(8, 0))
        ttk.Button(history_actions, text="Undo", style="Ghost.TButton", command=self._undo).grid(row=0, column=0, sticky="w")
        ttk.Button(history_actions, text="Redo", style="Ghost.TButton", command=self._redo).grid(row=0, column=1, sticky="w", padx=(8, 0))
        ttk.Button(history_actions, text="Copy Settings JSON", style="Ghost.TButton", command=self._copy_state_json).grid(row=0, column=2, sticky="e", padx=(12, 0))

        notebook = ttk.Notebook(ctrl)
        notebook.grid(row=3, column=0, sticky="nsew", pady=(8, 0))
        self.tab_basic = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        self.tab_fx = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        self.tab_border = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        self.tab_export = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        notebook.add(self.tab_basic, text="Basic")
        notebook.add(self.tab_fx, text="FX")
        notebook.add(self.tab_border, text="Borders & Stickers")
        notebook.add(self.tab_export, text="Export")

        self._build_basic_tab(self.tab_basic)
        self._build_fx_tab(self.tab_fx)
        self._build_border_tab(self.tab_border)
        self._build_export_tab(self.tab_export)

    def _stat(self, parent: ttk.Frame, label: str, variable: tk.StringVar) -> ttk.Frame:
        card = ttk.Frame(parent, style="Card.TFrame", padding=10)
        ttk.Label(card, text=label, style="CardTitle.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(card, textvariable=variable, style="CardValue.TLabel").grid(row=1, column=0, sticky="w", pady=(6, 0))
        return card

    def _build_basic_tab(self, tab: ttk.Frame) -> None:
        tab.columnconfigure(1, weight=1)
        self.fit_var = self._combo(tab, 0, "Fit mode", ["Contain", "Cover", "Stretch"], self.state.fit_mode)
        self.rotate_var = self._combo(tab, 2, "Rotate", ["None", "90°", "180°", "270°"], self.state.rotate)
        self.flip_var = self._combo(tab, 4, "Flip", ["None", "Horizontal", "Vertical"], self.state.flip)

        self.stamp_var = tk.StringVar(value=self.state.stamp_text)
        ttk.Label(tab, text="Signature / Stamp").grid(row=6, column=0, sticky="w", pady=(10, 0))
        ttk.Entry(tab, textvariable=self.stamp_var).grid(row=7, column=0, columnspan=2, sticky="ew")
        self.stamp_var.trace_add("write", lambda *_: self._on_setting_change())

        self.brightness = self._slider(tab, 8, "Brightness", 40, 170, self.state.brightness)
        self.contrast = self._slider(tab, 10, "Contrast", 40, 170, self.state.contrast)
        self.saturation = self._slider(tab, 12, "Saturation", 0, 220, self.state.saturation)
        self.sharpness = self._slider(tab, 14, "Sharpness", 0, 250, self.state.sharpness)

    def _build_fx_tab(self, tab: ttk.Frame) -> None:
        tab.columnconfigure(1, weight=1)
        self.warmth = self._slider(tab, 0, "Warmth", -70, 70, self.state.warmth)
        self.tint = self._slider(tab, 2, "Tint (magenta/green)", -70, 70, self.state.tint)
        self.vignette = self._slider(tab, 4, "Vignette", 0, 100, self.state.vignette)
        self.grain = self._slider(tab, 6, "Film Grain", 0, 100, self.state.grain)
        self.glitch = self._slider(tab, 8, "RGB Glitch Shift", 0, 24, self.state.glitch_shift)

    def _build_border_tab(self, tab: ttk.Frame) -> None:
        tab.columnconfigure(1, weight=1)
        self.border_style_var = self._combo(
            tab,
            0,
            "Border style",
            ["None", "Clean", "Neon Pulse", "Filmstrip", "Arcade", "Sticker Bomb"],
            self.state.border_style,
        )
        self.border_size = self._slider(tab, 2, "Border size", 0, 140, self.state.border_size)
        self.border_color_var = self._combo(tab, 4, "Border color", ["#f4f6ff", "#e84ea5", "#45b3ff", "#56f2a5", "#ffd446"], self.state.border_color)
        self.sticker_pack_var = self._combo(tab, 6, "Sticker pack", ["None", "Stars", "Hearts", "Chaos"], self.state.sticker_pack)
        self.sticker_density = self._slider(tab, 8, "Sticker density", 0, 100, self.state.sticker_density)

    def _build_export_tab(self, tab: ttk.Frame) -> None:
        tab.columnconfigure(1, weight=1)
        self.export_var = self._combo(tab, 0, "Export preset", list(EXPORT_PRESETS.keys()), self.state.export_preset)

        row = ttk.Frame(tab, style="Panel.TFrame")
        row.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        row.columnconfigure(0, weight=1)
        row.columnconfigure(1, weight=1)
        ttk.Button(row, text="Save PNG", style="Primary.TButton", command=self._save_png).grid(row=0, column=0, sticky="ew", padx=(0, 6))
        ttk.Button(row, text="Save Project", style="Ghost.TButton", command=self._save_project).grid(row=0, column=1, sticky="ew")

        row2 = ttk.Frame(tab, style="Panel.TFrame")
        row2.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        ttk.Button(row2, text="Load Project", style="Ghost.TButton", command=self._load_project).grid(row=0, column=0, sticky="w")

    def _combo(self, parent: ttk.Frame, row: int, label: str, values: list[str], default: str) -> tk.StringVar:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=(8, 0))
        var = tk.StringVar(value=default)
        combo = ttk.Combobox(parent, values=values, textvariable=var, state="readonly")
        combo.grid(row=row + 1, column=0, columnspan=2, sticky="ew")
        combo.bind("<<ComboboxSelected>>", lambda _e: self._on_setting_change())
        return var

    def _slider(self, parent: ttk.Frame, row: int, label: str, lo: int, hi: int, default: int) -> tk.IntVar:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=(8, 0))
        var = tk.IntVar(value=default)
        ttk.Scale(parent, from_=lo, to=hi, variable=var, orient="horizontal", command=lambda _v: self._on_setting_change()).grid(
            row=row + 1, column=0, columnspan=2, sticky="ew"
        )
        return var

    def _wire_defaults(self) -> None:
        self.fit_var.set(self.state.fit_mode)
        self.rotate_var.set(self.state.rotate)
        self.flip_var.set(self.state.flip)
        self.border_style_var.set(self.state.border_style)
        self.border_color_var.set(self.state.border_color)
        self.sticker_pack_var.set(self.state.sticker_pack)
        self.export_var.set(self.state.export_preset)

    def _snapshot_state(self) -> EditState:
        return EditState(
            fit_mode=self.fit_var.get(),
            brightness=self.brightness.get(),
            contrast=self.contrast.get(),
            saturation=self.saturation.get(),
            sharpness=self.sharpness.get(),
            warmth=self.warmth.get(),
            tint=self.tint.get(),
            vignette=self.vignette.get(),
            grain=self.grain.get(),
            glitch_shift=self.glitch.get(),
            border_style=self.border_style_var.get(),
            border_size=self.border_size.get(),
            border_color=self.border_color_var.get(),
            sticker_pack=self.sticker_pack_var.get(),
            sticker_density=self.sticker_density.get(),
            stamp_text=self.stamp_var.get(),
            rotate=self.rotate_var.get(),
            flip=self.flip_var.get(),
            export_preset=self.export_var.get(),
            source_image=self.state.source_image,
        )

    def _apply_state(self, state: EditState) -> None:
        self.state = state
        self.fit_var.set(state.fit_mode)
        self.brightness.set(state.brightness)
        self.contrast.set(state.contrast)
        self.saturation.set(state.saturation)
        self.sharpness.set(state.sharpness)
        self.warmth.set(state.warmth)
        self.tint.set(state.tint)
        self.vignette.set(state.vignette)
        self.grain.set(state.grain)
        self.glitch.set(state.glitch_shift)
        self.border_style_var.set(state.border_style)
        self.border_size.set(state.border_size)
        self.border_color_var.set(state.border_color)
        self.sticker_pack_var.set(state.sticker_pack)
        self.sticker_density.set(state.sticker_density)
        self.stamp_var.set(state.stamp_text)
        self.rotate_var.set(state.rotate)
        self.flip_var.set(state.flip)
        self.export_var.set(state.export_preset)

        if state.source_image and Path(state.source_image).exists():
            self.source_image = Image.open(state.source_image).convert("RGBA")
            self.file_name.set(Path(state.source_image).name)
        self._render_preview()

    def _push_undo(self) -> None:
        self.undo_stack.append(self._snapshot_state())
        if len(self.undo_stack) > 50:
            self.undo_stack.pop(0)
        self.redo_stack.clear()

    def _on_setting_change(self) -> None:
        self._render_preview()

    def _enable_best_effort_dnd(self) -> None:
        """Enable native tkdnd if present; otherwise keep browse workflow."""
        try:
            self.tk.call("package", "require", "tkdnd")
            self.tk.call("tkdnd::drop_target", "register", self.canvas, "DND_Files")
            self.canvas.drop_target_register("DND_Files")
            self.canvas.dnd_bind("<<Drop>>", self._on_drop)
            self._dnd_enabled = True
            self.drop_status.set("Drag & drop: enabled")
        except tk.TclError:
            self._dnd_enabled = False
            self.drop_status.set("Drag & drop: use Browse button in this build")

    def _on_drop(self, event: tk.Event) -> None:
        raw = str(event.data).strip()
        if raw.startswith("{") and raw.endswith("}"):
            raw = raw[1:-1]
        path = Path(raw)
        if path.exists():
            self._load_source(path)

    def _open_image(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("Image files", "*.png;*.jpg;*.jpeg;*.webp;*.bmp")])
        if path:
            self._load_source(Path(path))

    def _load_source(self, path: Path) -> None:
        self._push_undo()
        self.state.source_image = str(path)
        self.source_image = Image.open(path).convert("RGBA")
        self.file_name.set(path.name)
        self.size_text.set(f"{self.source_image.width}×{self.source_image.height}")
        self._render_preview()

    def _compose(self) -> Image.Image:
        if self.source_image is None:
            img = Image.new("RGBA", (1920, 1080), "#0a0e16")
            draw = ImageDraw.Draw(img)
            draw.text((680, 520), "Drop or browse a VRChat print to edit", fill="#8c91a3")
            return img

        src = self.source_image.copy()
        rotate = self.rotate_var.get()
        if rotate == "90°":
            src = src.transpose(Image.Transpose.ROTATE_90)
        elif rotate == "180°":
            src = src.transpose(Image.Transpose.ROTATE_180)
        elif rotate == "270°":
            src = src.transpose(Image.Transpose.ROTATE_270)

        flip = self.flip_var.get()
        if flip == "Horizontal":
            src = src.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        elif flip == "Vertical":
            src = src.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

        # Keep existing print size; fit mode only matters if user rotated causing ratio changes.
        w, h = self.source_image.size
        mode = self.fit_var.get()
        if mode == "Stretch":
            img = src.resize((w, h), Image.Resampling.LANCZOS)
        elif mode == "Cover":
            img = ImageOps.fit(src, (w, h), method=Image.Resampling.LANCZOS)
        else:
            img = Image.new("RGBA", (w, h), "#0a0e16")
            fit = ImageOps.contain(src, (w, h), method=Image.Resampling.LANCZOS)
            img.paste(fit, ((w - fit.width) // 2, (h - fit.height) // 2), fit)

        img = ImageEnhance.Brightness(img).enhance(self.brightness.get() / 100)
        img = ImageEnhance.Contrast(img).enhance(self.contrast.get() / 100)
        img = ImageEnhance.Color(img).enhance(self.saturation.get() / 100)
        img = ImageEnhance.Sharpness(img).enhance(self.sharpness.get() / 100)

        img = self._apply_warmth_tint(img)
        img = self._apply_glitch(img)
        self._draw_vignette(img)
        self._draw_grain(img)
        self._draw_border(img)
        self._draw_stickers(img)
        self._draw_stamp(img)
        return img

    def _apply_warmth_tint(self, img: Image.Image) -> Image.Image:
        warmth = self.warmth.get()
        tint = self.tint.get()
        if warmth == 0 and tint == 0:
            return img
        r, g, b, a = img.split()
        if warmth != 0:
            r = r.point(lambda p: max(0, min(255, p + warmth)))
            b = b.point(lambda p: max(0, min(255, p - warmth)))
        if tint != 0:
            g = g.point(lambda p: max(0, min(255, p - tint)))
            r = r.point(lambda p: max(0, min(255, p + tint // 2)))
            b = b.point(lambda p: max(0, min(255, p + tint // 2)))
        return Image.merge("RGBA", (r, g, b, a))

    def _apply_glitch(self, img: Image.Image) -> Image.Image:
        shift = self.glitch.get()
        if shift <= 0:
            return img
        r, g, b, a = img.split()
        r = ImageChops.offset(r, shift, 0)
        b = ImageChops.offset(b, -shift, 0)
        return Image.merge("RGBA", (r, g, b, a))

    def _draw_vignette(self, img: Image.Image) -> None:
        amount = self.vignette.get()
        if amount <= 0:
            return
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        w, h = img.size
        max_alpha = int(180 * (amount / 100))
        steps = 24
        for i in range(steps):
            pad = int(min(w, h) * 0.02 * i)
            alpha = int(max_alpha * (i / steps))
            draw.rectangle((pad, pad, w - pad, h - pad), outline=(0, 0, 0, alpha), width=max(2, min(w, h) // 120))
        img.alpha_composite(overlay)

    def _draw_grain(self, img: Image.Image) -> None:
        amount = self.grain.get()
        if amount <= 0:
            return
        rng = random.Random(img.width + img.height + amount)
        px = img.load()
        total = int((img.width * img.height) * (amount / 100) * 0.08)
        for _ in range(total):
            x = rng.randint(0, img.width - 1)
            y = rng.randint(0, img.height - 1)
            delta = rng.randint(-24, 24)
            r, g, b, a = px[x, y]
            px[x, y] = (
                max(0, min(255, r + delta)),
                max(0, min(255, g + delta)),
                max(0, min(255, b + delta)),
                a,
            )

    def _draw_border(self, img: Image.Image) -> None:
        style = self.border_style_var.get()
        size = self.border_size.get()
        if style == "None" or size <= 0:
            return
        draw = ImageDraw.Draw(img)
        w, h = img.size
        color = self.border_color_var.get()
        if style == "Clean":
            draw.rectangle((0, 0, w - 1, h - 1), outline=color, width=size)
        elif style == "Neon Pulse":
            for i in range(size):
                alpha = max(20, 255 - i * 6)
                draw.rectangle((i, i, w - i - 1, h - i - 1), outline=(232, 78, 165, alpha), width=1)
        elif style == "Filmstrip":
            draw.rectangle((0, 0, w - 1, h - 1), outline="#0b0b0d", width=size)
            hole = max(10, size // 2)
            gap = hole * 2
            for x in range(size, w - size, gap):
                draw.rectangle((x, 6, x + hole, 6 + hole), fill="#dfe3ef")
                draw.rectangle((x, h - hole - 6, x + hole, h - 6), fill="#dfe3ef")
        elif style == "Arcade":
            rainbow = ["#ff4f8b", "#ffcf4a", "#62f6a2", "#5dc5ff", "#ba7dff"]
            for i in range(size):
                draw.rectangle((i, i, w - i - 1, h - i - 1), outline=rainbow[i % len(rainbow)], width=1)
        elif style == "Sticker Bomb":
            draw.rectangle((0, 0, w - 1, h - 1), outline="#ffffff", width=max(2, size // 5))
            rng = random.Random(w + h + size)
            for _ in range(max(10, size // 3)):
                x = rng.randint(0, w - 40)
                y = rng.randint(0, h - 40)
                r = rng.randint(10, 24)
                c = rng.choice(["#ff5da8", "#5bc9ff", "#55f1b4", "#ffd553", "#ffffff"])
                draw.ellipse((x, y, x + r, y + r), fill=c)

    def _draw_stickers(self, img: Image.Image) -> None:
        pack = self.sticker_pack_var.get()
        if pack == "None":
            return
        density = self.sticker_density.get()
        if density <= 0:
            return
        draw = ImageDraw.Draw(img)
        rng = random.Random(img.width * 3 + img.height + density)
        count = max(6, density // 2)
        colors = ["#ff5da8", "#5bc9ff", "#55f1b4", "#ffd553", "#ffffff"]
        for _ in range(count):
            x = rng.randint(20, img.width - 20)
            y = rng.randint(20, img.height - 20)
            size = rng.randint(8, 24)
            c = rng.choice(colors)
            if pack == "Stars":
                draw.line((x - size, y, x + size, y), fill=c, width=2)
                draw.line((x, y - size, x, y + size), fill=c, width=2)
            elif pack == "Hearts":
                draw.pieslice((x - size, y - size, x, y), 180, 360, fill=c)
                draw.pieslice((x, y - size, x + size, y), 180, 360, fill=c)
                draw.polygon([(x - size, y - 2), (x + size, y - 2), (x, y + size)], fill=c)
            else:
                if rng.random() > 0.5:
                    draw.ellipse((x - size, y - size, x + size, y + size), outline=c, width=2)
                else:
                    draw.rectangle((x - size, y - size, x + size, y + size), outline=c, width=2)

    def _draw_stamp(self, img: Image.Image) -> None:
        text = self.stamp_var.get().strip()
        if not text:
            return
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        tw, th = right - left, bottom - top
        x = img.width - tw - 24
        y = img.height - th - 18
        draw.rectangle((x - 8, y - 6, x + tw + 8, y + th + 6), fill=(7, 11, 18, 180), outline=ACCENT, width=2)
        draw.text((x, y), text, fill="#f7f8ff", font=font)

    def _render_preview(self) -> None:
        img = self._compose()
        c_w = max(100, self.canvas.winfo_width())
        c_h = max(100, self.canvas.winfo_height())
        p = ImageOps.contain(img, (c_w - 16, c_h - 16), method=Image.Resampling.LANCZOS)
        self.preview_image = ImageTk.PhotoImage(p)
        self.canvas.delete("all")
        self.canvas.create_image(c_w // 2, c_h // 2, image=self.preview_image, anchor="center")

    def _apply_export_preset(self, img: Image.Image) -> Image.Image:
        preset = EXPORT_PRESETS[self.export_var.get()]
        if preset is None:
            return img
        if preset == "2x":
            return img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
        return ImageOps.fit(img, preset, method=Image.Resampling.LANCZOS)

    def _save_png(self) -> None:
        path = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("PNG", "*.png")])
        if not path:
            return
        img = self._compose()
        out = self._apply_export_preset(img).convert("RGB")
        out.save(path, "PNG")
        messagebox.showinfo("Export complete", f"Saved edited print to:\n{path}")

    def _save_project(self) -> None:
        state = self._snapshot_state()
        path = filedialog.asksaveasfilename(defaultextension=".vrcprint.json", filetypes=[("VRC Print Project", "*.vrcprint.json")])
        if not path:
            return
        Path(path).write_text(json.dumps(asdict(state), indent=2), encoding="utf-8")
        messagebox.showinfo("Saved", f"Project saved:\n{path}")

    def _load_project(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("VRC Print Project", "*.vrcprint.json"), ("JSON", "*.json")])
        if not path:
            return
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        state = EditState(**payload)
        self._apply_state(state)

    def _randomize_look(self) -> None:
        self._push_undo()
        self.brightness.set(random.randint(88, 125))
        self.contrast.set(random.randint(90, 145))
        self.saturation.set(random.randint(80, 180))
        self.sharpness.set(random.randint(85, 170))
        self.warmth.set(random.randint(-35, 35))
        self.tint.set(random.randint(-22, 22))
        self.vignette.set(random.randint(0, 55))
        self.grain.set(random.randint(0, 50))
        self.glitch.set(random.randint(0, 14))
        self.border_style_var.set(random.choice(["None", "Clean", "Neon Pulse", "Filmstrip", "Arcade", "Sticker Bomb"]))
        self.border_size.set(random.randint(10, 65))
        self.sticker_pack_var.set(random.choice(["None", "Stars", "Hearts", "Chaos"]))
        self.sticker_density.set(random.randint(8, 56))
        self._render_preview()

    def _reset_edits(self) -> None:
        self._push_undo()
        source = self.state.source_image
        self._apply_state(EditState(source_image=source))

    def _copy_state_json(self) -> None:
        payload = json.dumps(asdict(self._snapshot_state()), indent=2)
        self.clipboard_clear()
        self.clipboard_append(payload)
        messagebox.showinfo("Copied", "Current settings JSON copied to clipboard.")

    def _undo(self) -> None:
        if not self.undo_stack:
            return
        self.redo_stack.append(self._snapshot_state())
        state = self.undo_stack.pop()
        self._apply_state(state)

    def _redo(self) -> None:
        if not self.redo_stack:
            return
        self.undo_stack.append(self._snapshot_state())
        state = self.redo_stack.pop()
        self._apply_state(state)

    def run(self) -> None:
        self.mainloop()


if __name__ == "__main__":
    PrintEditorApp().run()
