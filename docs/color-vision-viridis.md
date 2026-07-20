# Color-Vision Palette · Viridis

Research and implementation notes for the first real Color Vision palette
(`ColorVisionMode = "viridis"`). Default mode is untouched; this palette is
**additive** and affects **data-visualization colours only**.

## 1 · Sources reviewed

- **Matplotlib — Choosing Colormaps in Matplotlib** (v3.11 docs,
  `users/explain/colors/colormaps.html`, fetched 2026-07-18): perceptual
  uniformity rationale, CIELAB lightness analysis (L\* monotonicity for the
  "Perceptually Uniform Sequential" family: viridis, plasma, inferno, magma,
  cividis), grayscale-conversion guidance, CVD guidance ("avoiding colormaps
  with both red and green will avoid many problems"), and its references:
  Kovesi, *Good Colour Maps: How to Design Them* (arXiv:1509.03700);
  Moreland, *Diverging Color Maps*; IBM perception research
  (doi:10.1109/VISUAL.1995.480803); color-blindness.com simulation resources.
- **Viridis origin**: designed by Stéfan van der Walt & Nathaniel Smith for
  matplotlib 2.0 ("mpl colormaps", BIDS; the `viridis` entry in matplotlib's
  Colormap Reference is the canonical artifact). Design goals: perceptually
  uniform in CAM02-UCS, monotonically increasing lightness, colorful,
  readable under common CVD forms and in grayscale.
- **W3C WCAG 2.2** — 1.4.1 *Use of Color* (colour must not be the only means
  of conveying information) and 1.4.11 *Non-text Contrast* (≥ 3:1 for
  graphical objects required to understand content).

## 2 · Why Viridis / lightness behaviour

Viridis is *perceptually uniform*: equal steps in data map to equal
perceived steps in CAM02-UCS colour space, and its CIELAB **lightness rises
monotonically** from the dark-purple end to the yellow end. Because value
order is carried primarily by lightness (not hue), the scale stays ordered
under all three dichromacies and under grayscale conversion. WCAG relative
luminance of the five samples used here (see §4) confirms strict ordering:
`0.019 → 0.088 → 0.225 → 0.450 → 0.782`.

**CVD behaviour** (per the design goals + matplotlib's CVD guidance):
- *Protanopia / deuteranopia* (red-green, the common forms): viridis avoids
  red–green opposition entirely (purple→blue→teal→green→yellow); ordering is
  preserved because lightness carries the ramp.
- *Tritanopia* (blue-yellow, rare): hue distinctions compress
  (blue/teal shift), but the monotone lightness ramp keeps the ORDER legible.
  Viridis is not a tritanopia-specific palette — this is documented as a
  limitation, not solved.
- *Grayscale*: monotone lightness → monotone gray ramp (matplotlib's
  grayscale-conversion section).

**Appropriate uses**: continuous values, ordered ranges, density/intensity,
sequential data. **Not** a fix for arbitrary categorical accessibility, and
**never** a replacement for semantic success/warning/danger/info status
colours (kept untouched here). Colour alone must not carry meaning (WCAG
1.4.1) — all existing shape/dash/label cues are preserved.

## 3 · Selected values (canonical, fixed samples)

Fixed discrete samples of the canonical matplotlib `viridis` colormap at
normalized positions t ∈ {0, 0.25, 0.5, 0.75, 1.0}. Values are the standard
published sRGB samples (stable tokens; no runtime plotting dependency).

| Token | t | Hex | Colour | WCAG rel-luminance |
|---|---|---|---|---|
| `--color-vision-viridis-1` | 0.00 | `#440154` | dark purple (low) | 0.019 |
| `--color-vision-viridis-2` | 0.25 | `#3b528b` | blue | 0.088 |
| `--color-vision-viridis-3` | 0.50 | `#21918c` | teal | 0.225 |
| `--color-vision-viridis-4` | 0.75 | `#5ec962` | green | 0.450 |
| `--color-vision-viridis-5` | 1.00 | `#fde725` | yellow (high) | 0.782 |

A sixth sample was **not** added: no current visualization needs six ordered
data colours (the six-region comparison is categorical and intentionally
left on its existing region tokens — see §6).

## 4 · Contrast findings (measured, WCAG contrast ratio)

Basemaps approximated from the CARTO styles: light (positron) ≈ `#f7f7f5`,
dark (dark-matter) ≈ `#0f1112`.

| Sample | vs light basemap | vs dark basemap |
|---|---|---|
| v1 `#440154` | **14.2:1** | 1.2:1 |
| v2 `#3b528b` | **7.1:1** | 2.5:1 |
| v3 `#21918c` | **3.6:1** | **5.0:1** |
| v4 `#5ec962` | 2.0:1 | **9.0:1** |
| v5 `#fde725` | 1.2:1 | **15.0:1** |

Consequence: **role assignment is theme-aware** — the light theme uses the
dark end (v1/v2/v3 all ≥ 3:1), the dark theme uses the light end (v3/v4/v5
all ≥ 3:1). Every colour actually rendered against the basemap meets WCAG
1.4.11's ≥ 3:1.

Adjacent samples sit ~1.7–2.0:1 apart (inherent to a smooth sequential
ramp). Where adjacency matters the UI never relies on hue alone: flood
polygons carry outlines, the analysis radius is a *dashed* ring + hollow
centre marker, hospitals are *round markers* (in the 5 km analysis they are
the semantic danger red, unchanged), charts keep text labels/values, and
compare sides keep their labels + divider. Compare A/B use non-adjacent
samples: light v3↔v1 = **4.0:1**, dark v3↔v5 = **3.0:1**.

## 5 · Role mapping (Default → Viridis)

Data roles are CSS variables (`--color-data-*` → `--data-viz-*`, globals.css)
— the single indirection map paint (lib/map-tokens), chart fills, legend
swatches and compare sides all read. **Default mode aliases the exact
pre-existing tokens** (bit-identical rendering); Viridis overrides only under
`html[data-color-vision="viridis"]`.

| Role | Default (existing token) | Viridis · light | Viridis · dark |
|---|---|---|---|
| hospitals | `background-primary-default` | v1 | v5 |
| flood | `background-info-default` | v2 | v3 |
| analysis (5 km radius) | `background-success-default` | v3 | v4 |
| compare A | `background-info-default` | v3 | v3 |
| compare B | `background-primary-default` | v1 | v5 |
| chart series 1–4 | primary/info/success/warning | v1/v2/v3/v4 | v5/v4/v3/v2 |
| admin band fill (ADM2/ADM3 context) | `background-primary-default` | v3 | v3 |
| admin outline (bands + LAYER boundaries) | `border-primary-default` | v1 | v5 |
| selected admin AREA (single province) | per-REGION categorical token | v2 | v3 |
| hospital analysis result (inside 5 km) | `background-error-default` (alias — token untouched) | v1 | v5 |

Unchanged in every mode: semantic status colours as UI STATUS (the
analysis-result markers now go through the `hospital-highlight` DATA role,
whose default aliases the same error red — the semantic token itself is
untouched), all UI tokens, the manual "Administrative boundaries" toggle
layer, and the **categorical region comparison** (six region colours):
mapping a sequential ramp onto regions would falsely imply ranking, so the
region tokens are intentionally kept in BOTH modes for multi-region views
(regions carry text labels + boundaries, satisfying 1.4.1). The SINGLE
selected-province highlight is not categorical, so it maps to the
`admin-area` role under Viridis (`resolveAdminAreaColor` in
lib/data-palette is the one place that branches on the mode).

## 6 · Limitations

- Viridis does **not** solve every CVD form (tritanopia support is partial;
  monochromacy relies on the lightness ramp alone).
- Adjacent ramp samples are low-contrast against each other by design;
  boundaries/labels/shapes remain required cues.
- The categorical region palette is not CVD-remapped in this phase.
- Semantic status colours were deliberately not analysed/remapped here.
- On a full page reload with Viridis persisted there is a sub-frame window
  before the client attribute applies (SSR renders no attribute).

## 7 · Future work — Blues

Blues (single-hue monochrome ramp) needs: canonical sample selection (e.g.
ColorBrewer `Blues` 5-class), the same theme-aware contrast analysis (a
light-end blue fails on light basemaps), a conflict review against the
default flood blue and compare-side blues (likely requiring outline/dash
differentiation rather than hue), role overrides in globals.css +
`COLOR_VISION_OPTIONS` enablement, and the same test/browser matrix.
