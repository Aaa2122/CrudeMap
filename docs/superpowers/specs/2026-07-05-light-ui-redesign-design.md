# CrudeMap Light UI Redesign — Design Spec

**Date:** 2026-07-05
**Status:** Approved by user (brainstorming session)
**Scope:** Full frontend visual redesign — light "Apple-like" theme across app chrome, panels, dashboard, AND the deck.gl map itself. Includes internal layout reorganization of panels and dashboard (user chose the widest scope option).

## Goals

1. Leave the dark theme entirely: light, clean, professional look inspired by Apple (macOS/iOS design language, Apple Maps light style).
2. Soft rounded shapes everywhere — floating cards, pills, no sharp corners, no elements glued to screen edges.
3. Replace the aggressive amber/yellow accent with softer hues.
4. Keep the existing information architecture (same features, same data), but reorganize panel/dashboard internals into calmer iOS-style groupings.

## Non-Goals

- No dark mode toggle (light only, YAGNI).
- No new features, no new data, no backend changes.
- No change to deck.gl layer *behavior* (LOD, culling, picking, animation architecture stay as-is).

## 1. Design System (tokens)

### Colors (Tailwind `tailwind.config.ts` + `frontend/src/components/Map/mapTheme.ts` + new `frontend/src/uiTheme.ts` for charts)

| Token | Value | Usage |
|---|---|---|
| `bg` | `#F5F5F7` | App background (Apple grey) |
| `surface` | `#FFFFFF` | Cards, panels |
| `surface-glass` | `rgba(255,255,255,0.72)` | Floating translucent chrome (+ backdrop-blur-xl) |
| `border` | `rgba(0,0,0,0.08)` | Hairlines everywhere |
| `text` | `#1D1D1F` | Primary ink |
| `text-muted` | `#6E6E73` | Secondary |
| `oil` | `#B77A4B` | Oil accent (soft copper) — replaces `#DCA54A` |
| `gas` | `#4A9BAA` | Gas accent (calm blue-green) — replaces `#46C8DC` |
| `alert` | `#DE5B4E` | Alert/critical (softened red) — replaces `#D9544D` |
| `safe` | `#3E9E6E` | Positive/active (calm green) |
| `inset` | `#F2F2F4` | iOS-style inset group background inside white cards |

Pastel badge backgrounds = accent at ~12% opacity with the accent as text color (e.g. risk badges).

### Shape & elevation

- Radius: 12px small controls, 16px cards, 20px large panels, `9999px` pills for all buttons/toggles/inputs.
- Shadows (only two): `shadow-float` = `0 8px 30px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`; `shadow-pop` = `0 16px 48px rgba(0,0,0,0.14)` (modals).
- No hard borders for elevation — hairline + shadow.

### Typography

- **Inter** (Google Fonts, weights 400/500/600) replaces Archivo as `font-sans`. Titles in sentence case; uppercase-tracking labels (`caps-label`, `display-caps`) are retired except tiny section labels which become 11px/500 sentence-case `text-muted`.
- **IBM Plex Mono** kept ONLY for numeric values (stats, counts, units).
- CSS helper classes in `index.css`: `.floating-card` (white, radius 16, shadow-float, hairline), `.glass-bar` (surface-glass + blur + hairline), `.section-label` (11px, 500, text-muted). `.terminal-card`, `.caps-label`, `.display-caps` are deleted.

## 2. Light Map (deck.gl `mapTheme.ts`)

All map colors remain centralized in `mapTheme.ts`; the hue-budget test updates to the new accents.

| Token | New value (RGBA) | Notes |
|---|---|---|
| `OCEAN` | `[229, 234, 239, 255]` | Pearl grey-blue water |
| `GRATICULE` | `[70, 90, 110, 14]` | Near-invisible |
| `HAIRLINE` | `[120, 130, 140, 90]` | Country borders |
| `NEUTRAL_MARK` | `[110, 120, 130, 205]` | Infrastructure marks, pipelines |
| `NEUTRAL_MARK_DIM` | `[150, 158, 166, 150]` | Offline/declining |
| `LABEL` | `[45, 55, 65, 230]` / halo `[255,255,255,235]` | Dark labels, white halo |
| `NO_DATA` | `[237, 235, 231, 242]` | Off-white land |
| `LAND_DIM` | `[228, 228, 226, 242]` | Countries outside selection |
| `OIL` | `[183, 122, 75, 255]` | `#B77A4B` |
| `GAS` | `[74, 155, 170, 255]` | `#4A9BAA` |
| `ALERT` | `[222, 91, 78, 255]` | `#DE5B4E` |
| `SELECTED` | `[29, 29, 31, 255]` | Ink outline (white is invisible on light map) |
| `HIGHLIGHT` | `[29, 29, 31, 30]` | Hover tint |

Choropleth ramps in `countryMetrics.ts` recalibrated light→saturated-soft (5 steps, alpha 242):
- Volume (oil): `#E3E9EF → #4E7CA6` blue-grey luminance.
- Volume (gas): `#E2EDEE → #3E8D9B` blue-green luminance.
- Balance diverging: importer blue `#4E7CA6` ← near-white neutral `#EFEEEA` → exporter copper `#B77A4B` (gas variant ends at `#3E8D9B`).
- Risk: `#EFEEEA → #DE5B4E`. Resilience: `#EFEEEA → #3E9E6E`. Score: blue-grey.
- Flow underlay alpha stays ~46; particles ~200. Vessel/icon alphas unchanged.
- The CSS `.ocean-ground` vignette becomes a light radial (`#EEF1F4 → #E5EAEF`).

Constraints preserved: `globeParams`/hemisphere culling on every layer, integer animation-clock multipliers, invisible hit-target layers, stable choropleth data identity (no fill transitions), no color literals outside `mapTheme.ts`/`countryMetrics.ts`.

## 3. Floating Chrome

- **Header** → `.glass-bar`, height 52px: ink wordmark "CrudeMap" (Inter 600, sentence case) + small muted "Energy flows"; Oil/Gas as iOS segmented control (grey pill track `#EBEBED`, white sliding thumb with shadow, active label ink); Map/Overview same segmented style; search = pill input (grey `#EBEBED` fill, no border, focus ring accent at 30%); Globe/Flat + info = round icon buttons (hover grey fill).
- **Footer deleted.** "Live · v1.2.0 · dataset" info moves into the DataSources modal.
- **LayersPanel** (top-left) → `.floating-card` with 16px margin; group titles `.section-label`; rows with rounded hover; color chips become small rounded dots; counts in mono muted.
- **MapLegend** (bottom-left) → `.floating-card`; metric `<select>` styled as pill; ramp bar with rounded ends; key rows unchanged in content.
- **Tooltip** → white floating card, radius 12, shadow-float, ink text, accent-colored value line.
- **SidePanel** → floating detached card: 16px margin on top/right/bottom, radius 20, shadow-float, internal scroll; close button = round grey hover circle with ×.

## 4. Internal Layouts

- **CountryPanel**: big country name (Inter 600 17px) + region/role muted below; resilience badge = pastel pill. Oil/Gas stat blocks become **iOS inset groups**: rounded `inset` container, rows `label — mono value` separated by hairlines (replaces the 2×2 boxed grid). Balance/refining/dependency rows live in the same groups with colored values. Vulnerability bars: 6px tall, fully rounded, track `inset` grey. Suppliers/route sections keep charts, recolored via `uiTheme.ts`. Infrastructure list rows: rounded 12, `inset` hover, status dot.
- **Chokepoint/Infra/Field panels**: same inset-group treatment (they reuse Stat/Divider patterns — those shared helpers get restyled once and reused; Divider becomes `.section-label` headings without rule lines).
- **OverviewDashboard**: KPI cards white radius 16, label sentence-case muted 12px, value Inter 600 22px **ink** (not accent-colored), unit muted; grid unchanged. Chart cards white rounded; recharts colors from `uiTheme.ts` (`axis #9A9AA0`, `grid rgba(0,0,0,0.06)`, tooltip white rounded, bars oil/gas accent, pipeline bars `NEUTRAL #8E98A2`). Chokepoint table: pastel pill risk badges (alert/oil/gas-family hues at 12%), row hover `#F7F7F8`. Producer/importer bars: rounded, track `inset`.
- **DataSourcesModal**: centered sheet radius 20, `shadow-pop`, overlay `rgba(0,0,0,0.25)` + blur, round close button; gains a small "About" footer block (Live status, version, dataset note — migrated from deleted footer).

## 5. Technical Notes

- New `frontend/src/uiTheme.ts`: exports hex strings for React/recharts surfaces (accents, risk colors, chart greys) so components stop hardcoding `#ef4444`-style literals. `mapTheme.ts` stays the source for RGBA map colors; `uiTheme.ts` mirrors the accent hexes (single place to change both: uiTheme imports from mapTheme via `toCss`/hex conversion).
- `index.html`: swap Google Fonts link Archivo → Inter (keep IBM Plex Mono, keep Material Symbols).
- Tests: `mapTheme.test.ts` accent values updated; hue-budget test in `iconAtlas.test.ts` unchanged in structure; `countryMetrics.test.ts` unchanged (behavioral).
- Acceptance: no `#DCA54A`/`#46C8DC`/`#D9544D` or Tailwind palette literals (`#ef4444`, `#f59e0b`, `#22c55e`, `#f97316`, `#10b981`, `#eab308`) anywhere in `frontend/src` outside theme files; no `rounded-sm`/`rounded` (4px) corners in chrome components; visual QA on flat/globe × oil/gas + panels + dashboard + modal.
