# Light Apple-like UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the entire CrudeMap frontend (app chrome, panels, dashboard, AND the deck.gl map) from the dark "terminal" theme to a light, Apple-like design: pearl-grey backgrounds, white floating rounded cards, pill controls, Inter typography, and soft copper/blue-green accents replacing the aggressive amber/cyan.

**Architecture:** Token-first: Task 1 swaps the Tailwind palette + fonts + CSS helper classes to light values (keeping old token *names* as transitional aliases so nothing breaks mid-plan). Tasks 2 and 4 relight the map through `mapTheme.ts`/`countryMetrics.ts` (already the single source of map color); Task 3 derives UI hex tokens from it. Tasks 5–12 restyle each UI surface using two new shared modules: `uiTheme.ts` (hex tokens for React/recharts) and `panelKit.tsx` (iOS-style inset-group primitives). Task 13 deletes the transitional aliases and enforces the "no raw hex" acceptance rule; Task 14 is visual QA.

**Tech Stack:** React 18, deck.gl 9, Tailwind 3, recharts 2, vitest, Vite 5.

**Spec:** `docs/superpowers/specs/2026-07-05-light-ui-redesign-design.md` (approved).

## Global Constraints

- Light theme only — no dark-mode toggle.
- Accents: oil `#B77A4B`, gas `#4A9BAA`, alert `#DE5B4E`, safe `#3E9E6E`. The old `#DCA54A` / `#46C8DC` / `#D9544D` must not survive anywhere.
- Radius: 12px small controls (`rounded-ctl`), 16px cards (`rounded-card`), 20px large panels (`rounded-panel`), pills (`rounded-full`) for buttons/toggles/inputs. No `rounded-sm`/bare `rounded` (4px) in chrome after Task 13.
- Shadows: only `shadow-float` and `shadow-pop` (defined Task 1).
- Typography: Inter (sans) everywhere; IBM Plex Mono only for numeric values; titles sentence case (no new tracked-uppercase labels).
- Map constraints preserved verbatim from the previous redesign: `parameters: globeParams(globe)` + hemisphere culling on every layer; integer animation-clock multipliers; invisible ScatterplotLayer hit-targets; stable choropleth data identity, NO fill-color transitions; no RGBA color literals in map layer files outside `mapTheme.ts`/`countryMetrics.ts` (exceptions: `[0,0,0,1]` hit fills, `[0,0,0,0]` transparent).
- After Task 13, no hex color literals in `frontend/src` components outside `mapTheme.ts`, `countryMetrics.ts`, `uiTheme.ts`, `tailwind.config.ts`, `index.css`.
- Run all frontend commands from `C:\Project\CrudeMap\frontend`. `npm run build` (tsc + vite) must pass at the end of every task; `npx vitest run` must pass whenever tests exist for the touched module.
- Work on a feature branch `feat/light-ui-redesign` off `main`.

---

### Task 1: Light design tokens, fonts, base CSS

**Files:**
- Modify: `frontend/tailwind.config.ts` (full replacement below)
- Modify: `frontend/index.html` (font link)
- Modify: `frontend/src/index.css` (full replacement below)

**Interfaces:**
- Produces (Tailwind classes used by all later tasks): colors `bg`, `surface`, `border`, `inset`, `oil`, `gas`, `alert`, `safe`, `primary`, `text`, `text-muted`; radii `rounded-ctl` (12px), `rounded-card` (16px), `rounded-panel` (20px); shadows `shadow-float`, `shadow-pop`; CSS classes `.floating-card`, `.glass-bar`, `.section-label`.
- Transitional aliases kept until Task 13: Tailwind `amber`, `gascyan`, `disrupted`, `rerouted` (mapped to the NEW accent values) and CSS classes `.terminal-card`, `.caps-label`, `.display-caps` (restyled light) so unmigrated components keep compiling and looking coherent.

- [ ] **Step 1: Replace `frontend/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light "Apple" palette — pearl ground, white surfaces, ink text,
        // soft copper (oil) / blue-green (gas) accents.
        primary: '#3B7BC4', // interactive blue (links, focus)
        bg: '#F5F5F7',
        surface: '#FFFFFF',
        border: 'rgba(0,0,0,0.08)',
        inset: '#F2F2F4', // iOS inset-group background inside white cards
        oil: '#B77A4B',
        gas: '#4A9BAA',
        alert: '#DE5B4E',
        safe: '#3E9E6E',
        // Transitional aliases — deleted in the cleanup task once all
        // component usages are migrated to the tokens above.
        amber: { DEFAULT: '#B77A4B', light: '#C89468' },
        gascyan: '#4A9BAA',
        disrupted: '#DE5B4E',
        rerouted: '#E08D4C',
        text: { DEFAULT: '#1D1D1F', muted: '#6E6E73' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        ctl: '12px',
        card: '16px',
        panel: '20px',
      },
      boxShadow: {
        float: '0 8px 30px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 16px 48px rgba(0,0,0,0.14)',
      },
      letterSpacing: {
        caps: '0.18em', // transitional — removed with .caps-label in cleanup
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Swap Archivo → Inter in `frontend/index.html`**

Replace the Archivo font link line with:

```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

(Keep the Material Symbols link untouched.)

- [ ] **Step 3: Replace `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: #F5F5F7;
  color: #1D1D1F;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Material Symbols */
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
  vertical-align: middle;
}

/* White floating card — the one elevation used by all map overlays/panels */
.floating-card {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* Translucent blurred bar (header) */
.glass-bar {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

/* Small muted section heading, sentence case */
.section-label {
  font-size: 11px;
  font-weight: 500;
  color: #6E6E73;
}

/* Light ground under the map canvas */
.ocean-ground {
  background: radial-gradient(120% 90% at 50% 38%, #EEF1F4 0%, #E8EDF2 58%, #E2E8EE 100%);
  position: relative;
}

/* ── Transitional aliases (deleted in cleanup once unmigrated components are gone) ── */
.terminal-card {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  backdrop-filter: none;
}
.caps-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: #6E6E73;
}
.display-caps {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  text-transform: none;
  letter-spacing: -0.01em;
}

/* Custom scrollbar — light */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.14);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.24);
}

select, input {
  font-family: inherit;
}
```

- [ ] **Step 4: Build**

Run: `npm run build` — expected: success. (App now renders light with legacy layout — fine, later tasks restyle each surface.)

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.ts frontend/index.html frontend/src/index.css
git commit -m "feat(ui): light design tokens, Inter typography, floating-card primitives"
```

---

### Task 2: Light `mapTheme.ts`

**Files:**
- Modify: `frontend/src/components/Map/mapTheme.ts` (token values only — helpers unchanged)
- Modify: `frontend/src/components/Map/mapTheme.test.ts` (accent expectations)

**Interfaces:**
- Produces: same exports as before with new values. `SELECTED` becomes ink (white outline would vanish on a light map). Consumers (all map layers, Task 3's uiTheme) pick the change up automatically.

- [ ] **Step 1: Update the accent test in `mapTheme.test.ts`**

Replace the first test body with:

```ts
  it('uses the light-theme accents (soft copper, blue-green, soft red)', () => {
    expect(OIL.slice(0, 3)).toEqual([183, 122, 75])
    expect(GAS.slice(0, 3)).toEqual([74, 155, 170])
    expect(ALERT.slice(0, 3)).toEqual([222, 91, 78])
  })
```

Also update the `withAlpha` expectation: `expect(withAlpha(OIL, 40)).toEqual([183, 122, 75, 40])`, and the `toCss` test to `expect(toCss([183, 122, 75, 255])).toBe('rgba(183, 122, 75, 1)')`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/Map/mapTheme.test.ts` — expected: FAIL (old values).

- [ ] **Step 3: Update token values in `mapTheme.ts`**

Replace the token block (keep `RGBA`, helpers, `flowWidth` untouched):

```ts
// ---- Neutral base (light map: pearl water, off-white land, ink labels) ----
export const OCEAN: RGBA = [229, 234, 239, 255]
export const GRATICULE: RGBA = [70, 90, 110, 14]
export const HAIRLINE: RGBA = [120, 130, 140, 90] // country borders, thin strokes
export const HAIRLINE_STRONG: RGBA = [95, 105, 115, 150]
export const NEUTRAL_MARK: RGBA = [110, 120, 130, 205] // default infrastructure mark
export const NEUTRAL_MARK_DIM: RGBA = [150, 158, 166, 150] // offline / declining
export const LABEL: RGBA = [45, 55, 65, 230]
export const LABEL_MUTED: RGBA = [90, 100, 110, 210]
export const LABEL_HALO: RGBA = [255, 255, 255, 235]
export const NO_DATA: RGBA = [237, 235, 231, 242]
export const LAND_DIM: RGBA = [228, 228, 226, 242] // countries outside the current selection

// ---- Functional accents (the ONLY hues) ---------------------------------
export const OIL: RGBA = [183, 122, 75, 255] // #B77A4B — soft copper
export const GAS: RGBA = [74, 155, 170, 255] // #4A9BAA — calm blue-green
export const ALERT: RGBA = [222, 91, 78, 255] // #DE5B4E — softened red

// ---- Interaction states --------------------------------------------------
export const SELECTED: RGBA = [29, 29, 31, 255] // ink — white is invisible on light
export const HIGHLIGHT: RGBA = [29, 29, 31, 30] // deck.gl autoHighlight tint
```

Also update the module docstring first line to: `Single source of truth for every color drawn on the (light) map.`

- [ ] **Step 4: Run all tests, build**

Run: `npx vitest run` — expected: ALL PASS. Run: `npm run build` — expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Map/mapTheme.ts frontend/src/components/Map/mapTheme.test.ts
git commit -m "feat(map): light basemap tokens - pearl ocean, ink selection, copper/teal accents"
```

---

### Task 3: `uiTheme.ts` — hex tokens for React & recharts

**Files:**
- Create: `frontend/src/uiTheme.ts`
- Test: `frontend/src/uiTheme.test.ts`

**Interfaces:**
- Consumes: `OIL`, `GAS`, `ALERT`, type `RGBA` from `./components/Map/mapTheme` (map accents stay the single source; uiTheme derives hexes so map and UI can never diverge).
- Produces (used by Tasks 5–12):
  - `ui` object: `{ oil, gas, alert, safe, blue, orange, ink, muted, axis, grid, neutral, inset, hairline }` — all `string` (hex or rgba css).
  - `accentHex(commodity: string): string` — gas → `ui.gas`, else `ui.oil`.
  - `riskColor(level: string): string` — critical→`ui.alert`, high→`ui.orange`, medium→`ui.neutral`, low→`ui.safe`, unknown→`ui.neutral`.
  - `statusColor(status: string): string` — active/producing→`ui.safe`, limited/declining→`ui.orange`, offline→`ui.alert`, developing→`ui.blue`, unknown→`ui.neutral`.
  - `pastel(color: string): { background: string; color: string }` — 12% background tint + full-strength text.

- [ ] **Step 1: Write the failing test** — `frontend/src/uiTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { accentHex, pastel, riskColor, statusColor, ui } from './uiTheme'

describe('uiTheme', () => {
  it('derives accent hexes from mapTheme (single source of truth)', () => {
    expect(ui.oil).toBe('#b77a4b')
    expect(ui.gas).toBe('#4a9baa')
    expect(ui.alert).toBe('#de5b4e')
  })

  it('accentHex follows commodity, defaulting to oil', () => {
    expect(accentHex('gas')).toBe(ui.gas)
    expect(accentHex('oil')).toBe(ui.oil)
    expect(accentHex('products')).toBe(ui.oil)
  })

  it('risk and status map to the calm palette', () => {
    expect(riskColor('critical')).toBe(ui.alert)
    expect(riskColor('low')).toBe(ui.safe)
    expect(riskColor('nope')).toBe(ui.neutral)
    expect(statusColor('active')).toBe(ui.safe)
    expect(statusColor('offline')).toBe(ui.alert)
  })

  it('pastel gives a 12% background with full-strength text', () => {
    expect(pastel('#de5b4e')).toEqual({ background: '#de5b4e1f', color: '#de5b4e' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/uiTheme.test.ts` — expected: FAIL, cannot resolve `./uiTheme`.

- [ ] **Step 3: Implement `frontend/src/uiTheme.ts`**

```ts
/**
 * Hex color tokens for React surfaces and recharts. Accents are DERIVED
 * from mapTheme so the map and the UI can never disagree. Components must
 * import from here instead of hardcoding hex literals.
 */
import { ALERT, GAS, OIL, type RGBA } from './components/Map/mapTheme'

function hex(color: RGBA): string {
  return (
    '#' +
    color
      .slice(0, 3)
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

export const ui = {
  oil: hex(OIL),
  gas: hex(GAS),
  alert: hex(ALERT),
  safe: '#3e9e6e',
  blue: '#4e7ca6', // data blue (importers, developing)
  orange: '#e08d4c', // warning mid-tone (limited, high risk)
  ink: '#1d1d1f',
  muted: '#6e6e73',
  axis: '#9a9aa0', // chart axis ticks
  grid: 'rgba(0,0,0,0.06)',
  neutral: '#8e98a2', // neutral data series
  inset: '#f2f2f4',
  hairline: 'rgba(0,0,0,0.08)',
} as const

export function accentHex(commodity: string): string {
  return commodity === 'gas' ? ui.gas : ui.oil
}

export function riskColor(level: string): string {
  if (level === 'critical') return ui.alert
  if (level === 'high') return ui.orange
  if (level === 'low') return ui.safe
  return ui.neutral
}

export function statusColor(status: string): string {
  if (status === 'active' || status === 'producing') return ui.safe
  if (status === 'limited' || status === 'declining') return ui.orange
  if (status === 'offline') return ui.alert
  if (status === 'developing') return ui.blue
  return ui.neutral
}

/** Pastel badge style: 12% tint background, full-strength text. */
export function pastel(color: string): { background: string; color: string } {
  return { background: `${color}1f`, color }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/uiTheme.test.ts` — expected: PASS (mapTheme already flipped to the light accents in Task 2, so the derived hexes match).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/uiTheme.ts frontend/src/uiTheme.test.ts
git commit -m "feat(ui): uiTheme hex tokens derived from mapTheme"
```

---

### Task 4: Light choropleth ramps

**Files:**
- Modify: `frontend/src/components/Map/countryMetrics.ts` (the seven palette constants only)

**Interfaces:**
- Produces: same `buildMetricScale` API; ramps now light→saturated-soft. `countryMetrics.test.ts` is behavioral and must stay green unchanged.

- [ ] **Step 1: Replace the palette constants**

```ts
// Light map: ramps run pale → saturated-soft. Alpha 242 everywhere.
const VOLUME_PALETTE: RGBA[] = [
  [227, 233, 239, 242],
  [186, 201, 216, 242],
  [141, 166, 192, 242],
  [104, 136, 166, 242],
  [78, 124, 166, 242],
]

const RISK_PALETTE: RGBA[] = [
  [239, 238, 234, 242],
  [233, 203, 193, 242],
  [229, 166, 150, 242],
  [226, 128, 113, 242],
  [222, 91, 78, 242],
]

const RESILIENCE_PALETTE: RGBA[] = [
  [239, 238, 234, 242],
  [200, 222, 208, 242],
  [157, 201, 175, 242],
  [107, 175, 140, 242],
  [62, 158, 110, 242],
]

const SCORE_PALETTE: RGBA[] = [
  [231, 235, 240, 242],
  [192, 204, 217, 242],
  [150, 172, 193, 242],
  [110, 142, 170, 242],
  [84, 120, 152, 242],
]

// Teal ramp for natural gas volumes — visually distinct from the oil blue ramp
const GAS_VOLUME_PALETTE: RGBA[] = [
  [226, 237, 238, 242],
  [178, 209, 212, 242],
  [128, 178, 184, 242],
  [90, 150, 158, 242],
  [62, 141, 155, 242],
]

// Diverging ramps for net balance (production − consumption):
// importer blue <- near-white neutral -> exporter in the commodity hue
const OIL_BALANCE_PALETTE: RGBA[] = [
  [78, 124, 166, 242], // strong net importer (data blue)
  [150, 175, 199, 242],
  [239, 238, 234, 242], // balanced (near-white)
  [209, 178, 148, 242],
  [183, 122, 75, 242], // strong net exporter (copper)
]

const GAS_BALANCE_PALETTE: RGBA[] = [
  [78, 124, 166, 242],
  [150, 175, 199, 242],
  [239, 238, 234, 242],
  [156, 196, 201, 242],
  [62, 141, 155, 242], // strong net exporter (blue-green)
]
```

Also update the comment above `VOLUME_PALETTE` from the "Land IS the basemap…" pair of lines to the single line shown above.

- [ ] **Step 2: Tests + build**

Run: `npx vitest run` — expected: PASS (behavioral tests only).
Run: `npm run build` — expected: success.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Map/countryMetrics.ts
git commit -m "feat(map): light choropleth ramps - pale-to-soft luminance scales"
```

---

### Task 5: Header — glass bar, segmented controls, pill search

**Files:**
- Modify: `frontend/src/App.tsx` (header JSX only in this task)
- Modify: `frontend/src/components/Controls/CommodityToggle.tsx` (full replacement)
- Modify: `frontend/src/components/Controls/SearchBox.tsx` (chrome classes only)

**Interfaces:**
- Consumes: `ui`, `accentHex` from `../../uiTheme` (Task 2); Tailwind tokens (Task 1).
- Produces: header height becomes 52px (`h-[52px]`); no other component contract changes.

- [ ] **Step 1: Replace `CommodityToggle.tsx`**

```tsx
import type { Commodity } from '../../api/types'
import { useMapStore } from '../../store/mapStore'
import { ui } from '../../uiTheme'

const OPTIONS: { key: Commodity; label: string; color: string }[] = [
  { key: 'oil', label: 'Oil', color: ui.oil },
  { key: 'gas', label: 'Gas', color: ui.gas },
]

/** Primary mode switch, iOS-segmented-control style. */
export function CommodityToggle() {
  const { commodity, setCommodity } = useMapStore()

  return (
    <div className="flex items-center rounded-full bg-inset p-0.5">
      {OPTIONS.map(option => {
        const active = commodity === option.key
        return (
          <button
            key={option.key}
            onClick={() => setCommodity(option.key)}
            className={`flex h-7 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all ${
              active ? 'bg-surface text-text shadow-float' : 'text-text-muted hover:text-text'
            }`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: option.color, opacity: active ? 1 : 0.45 }}
            />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the header block in `App.tsx`**

Replace the entire `<header>…</header>` element with:

```tsx
      {/* ── Header ── */}
      <header className="glass-bar z-50 flex h-[52px] shrink-0 items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-center gap-5">
          {/* Wordmark */}
          <div className="flex select-none items-baseline gap-2">
            <span className="text-[16px] font-semibold tracking-tight text-text">CrudeMap</span>
            <span className="text-[11px] text-text-muted">Energy flows</span>
          </div>

          <CommodityToggle />

          <nav className="flex items-center rounded-full bg-inset p-0.5">
            {(
              [
                { key: 'network', label: 'Map' },
                { key: 'overview', label: 'Overview' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`h-7 rounded-full px-3.5 text-[12px] font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-surface text-text shadow-float'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <SearchBox />

          <button
            onClick={() => setViewMode(viewMode === 'flat' ? 'globe' : 'flat')}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${
              viewMode === 'globe'
                ? 'bg-inset text-text'
                : 'text-text-muted hover:bg-inset hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
              {viewMode === 'globe' ? 'public' : 'map'}
            </span>
            {viewMode === 'globe' ? 'Globe' : 'Flat'}
          </button>

          <button
            onClick={() => setShowSources(true)}
            title="Data sources & methodology"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-inset hover:text-text"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>info</span>
          </button>
        </div>
      </header>
```

(The `isGas` variable stays — the layer-count memo uses it.)

- [ ] **Step 3: Restyle `SearchBox.tsx` chrome**

Replace the input container div (`<div className="flex h-7 items-center …">`) with:

```tsx
      <div className="flex h-8 items-center gap-2 rounded-full bg-inset px-3 transition-shadow focus-within:ring-2 focus-within:ring-primary/30">
```

Replace the `<kbd>` element with:

```tsx
        <kbd className="rounded-md bg-surface px-1.5 font-mono text-[9px] text-text-muted shadow-sm">/</kbd>
```

Replace the dropdown container (`terminal-card absolute left-0 right-0 top-full z-50 mt-1 max-h-[340px] overflow-y-auto rounded-sm py-1`) with:

```tsx
        <div className="floating-card absolute left-0 right-0 top-full z-50 mt-2 max-h-[340px] overflow-y-auto py-1.5">
```

Replace the group heading classes (`px-3 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted`) with `section-label px-3.5 pt-2 pb-0.5`, and the result-row classes: active state `bg-inset text-text` instead of `bg-primary/15 text-text`, and row padding `px-3.5 py-1.5 rounded-lg mx-1`.

- [ ] **Step 4: Build + visual sanity**

Run: `npm run build` — expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Controls/CommodityToggle.tsx frontend/src/components/Controls/SearchBox.tsx
git commit -m "feat(ui): glass header with segmented controls and pill search"
```

---

### Task 6: Remove footer, restyle DataSourcesModal (+ About block)

**Files:**
- Modify: `frontend/src/App.tsx` (delete footer)
- Modify: `frontend/src/components/Modals/DataSourcesModal.tsx` (full restyle)

**Interfaces:**
- Consumes: `ui`, `pastel` from `../../uiTheme`.
- Produces: no footer element; modal gains the Live/version/dataset line.

- [ ] **Step 1: Delete the `<footer>…</footer>` block in `App.tsx`** (the whole "Footer: status strip" section).

- [ ] **Step 2: Restyle `DataSourcesModal.tsx`**

Replace the two wrapper divs and header/disclaimer:

```tsx
import { pastel, ui } from '../../uiTheme'
```

Outer overlay: `className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-sm"`.
Sheet: `className="w-[580px] max-w-[92vw] rounded-panel bg-surface shadow-pop"`.
Header block:

```tsx
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Data sources</h2>
            <p className="mt-0.5 text-[12px] text-text-muted">What feeds this map, and how much to trust it</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-inset hover:text-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>
```

Body wrapper: `className="max-h-[62vh] overflow-y-auto px-6 pb-5"`. Table header row: `className="section-label"` on the `<tr>` (drop uppercase tracking classes on `<th>`, use `font-medium`). Row hairlines unchanged (`border-t border-border`).
Disclaimer box:

```tsx
          <div className="mt-4 rounded-ctl px-4 py-3 text-[12px] leading-relaxed" style={pastel(ui.oil)}>
            <span className="font-semibold">Curated demonstration dataset.</span>{' '}
            <span className="text-text-muted">
              Values are realistic 2024 orders of magnitude assembled from public sources for
              visualization and scenario exploration — not a live data feed. Each record carries its
              own source attribution and confidence level, visible in the detail panels.
            </span>
          </div>

          {/* About (migrated from the removed footer) */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-text-muted">
            <span>Crude oil & natural gas network · curated 2024 dataset</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ui.safe }} />
              Live · v1.2.0
            </span>
          </div>
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/src/App.tsx frontend/src/components/Modals/DataSourcesModal.tsx
git commit -m "feat(ui): drop footer, floating sheet modal with About block"
```

---

### Task 7: Floating map overlays — LayersPanel, MapLegend, tooltip

**Files:**
- Modify: `frontend/src/components/Controls/LayersPanel.tsx`
- Modify: `frontend/src/components/Map/MapLegend.tsx`
- Modify: `frontend/src/components/Map/WorldMap.tsx` (tooltip + loading card)

**Interfaces:**
- Consumes: `ui`, `accentHex` from uiTheme (LayersPanel row chips switch from hardcoded hexes to uiTheme/mapTheme-derived colors); `.floating-card`, `.section-label`.

- [ ] **Step 1: LayersPanel restyle**

In `LayersPanel.tsx`:
- Import: `import { ui } from '../../uiTheme'`.
- Replace all hardcoded chip hexes in `groups`: choropleth `isGas ? ui.gas : ui.blue`; flows `isGas ? ui.gas : ui.oil`; vessels same as flows; pipelines `ui.neutral`; lngTerminals `ui.gas`; fields `isGas ? ui.gas : ui.oil`; terminals `ui.oil`; refineries `ui.neutral`; chokepoints `ui.alert`; shippingLanes `ui.neutral`; containerPorts `ui.neutral`.
- Container: `className="floating-card absolute left-4 top-4 z-40 w-[212px]"`.
- Toggle button row: `className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"`; title `<span className="text-[12px] font-semibold text-text">Layers</span>`.
- Open body: `className="border-t border-border px-3.5 pb-3"`; group titles `className="section-label"`.
- Row buttons: `rounded-lg px-1.5 py-[4px]`, active `text-text hover:bg-inset`, inactive `text-text-muted/60 hover:text-text-muted`.
- Chip: `h-2 w-2 shrink-0 rounded-full border` and inactive borderColor `rgba(0,0,0,0.18)`.

- [ ] **Step 2: MapLegend restyle**

In `MapLegend.tsx`:
- Container: `className="floating-card absolute left-4 bottom-4 z-40 w-[252px] px-4 py-3.5"`.
- Top row label: replace `caps-label` span with `<span className="text-[12px] font-semibold text-text">Choropleth</span>`; commodity chip: `<span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase" style={{ background: accent + '1f', color: accent }}>` (accent already `toCss(accentFor(commodity))` — replace with the pastel style shown, importing nothing new: `accent` string works with `+ '1f'` only if hex — so switch `accent` to `accentHex(commodity)` from `../../uiTheme` and keep `toCss` for RGBA swatches only).
- `<select>`: `className="mt-2 w-full appearance-none rounded-ctl border-none bg-inset px-3 py-1.5 text-[12px] font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/30"`.
- Ramp bar: `className="mt-2.5 flex h-2 overflow-hidden rounded-full"`.
- Key rows and flows label: replace `border-t border-border` separators (keep), text sizes to `text-[11px]`, drop `uppercase tracking-caps` on the flows label → `className="mt-2.5 border-t border-border pt-2 text-[10px] text-text-muted"`.

- [ ] **Step 3: WorldMap tooltip + loading**

In `WorldMap.tsx`:
- Tooltip container: replace `terminal-card absolute pointer-events-none z-50 max-w-[250px] rounded-sm px-3 py-2` with `floating-card absolute pointer-events-none z-50 max-w-[260px] px-3.5 py-2.5 !rounded-ctl`.
- Loading overlay inner card: replace `rounded border border-border bg-surface/95 px-4 py-3 shadow-xl` with `floating-card px-5 py-3.5`; replace `uppercase tracking-widest` label classes with `text-[12px] text-text-muted`; ping dot `bg-primary` stays.

- [ ] **Step 4: Build + commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/src/components/Controls/LayersPanel.tsx frontend/src/components/Map/MapLegend.tsx frontend/src/components/Map/WorldMap.tsx
git commit -m "feat(ui): floating rounded map overlays (layers, legend, tooltip)"
```

---

### Task 8: Panel kit + floating SidePanel shell

**Files:**
- Create: `frontend/src/components/Panels/panelKit.tsx`
- Modify: `frontend/src/components/Panels/SidePanel.tsx`

**Interfaces:**
- Produces (used by Tasks 9–10):
  - `SectionLabel({ children: ReactNode })` — sentence-case muted 11px heading.
  - `InsetGroup({ children: ReactNode })` — iOS inset container (rounded-ctl, bg-inset, hairline dividers).
  - `InsetRow({ label: string; value: ReactNode; valueColor?: string; onClick?: () => void })` — label left / mono value right.
  - `Pill({ color: string; children: ReactNode })` — pastel capsule badge.
  - `MeterBar({ pct: number; color: string })` — rounded 6px progress bar on inset track.

- [ ] **Step 1: Create `panelKit.tsx`**

```tsx
import type { ReactNode } from 'react'

/** Sentence-case muted section heading. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label mt-1">{children}</div>
}

/** iOS-style inset group: rounded grey container with hairline-divided rows. */
export function InsetGroup({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-ctl bg-inset">{children}</div>
}

export function InsetRow({
  label,
  value,
  valueColor,
  onClick,
}: {
  label: string
  value: ReactNode
  valueColor?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="text-[12px] text-text-muted">{label}</span>
      <span
        className="font-mono text-[12px] font-medium text-text"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </>
  )
  if (onClick) {
    return (
      <button onClick={onClick} className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-black/[0.03]">
        {content}
      </button>
    )
  }
  return <div className="flex items-center justify-between px-3.5 py-2">{content}</div>
}

/** Pastel capsule badge (12% tint background, full-strength text). */
export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
      style={{ background: `${color}1f`, color }}
    >
      {children}
    </span>
  )
}

/** Rounded progress bar on an inset track. */
export function MeterBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Floating SidePanel shell**

Replace the outer div in `SidePanel.tsx` with:

```tsx
    <div className="absolute top-4 right-4 bottom-4 z-40 flex w-[380px] flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-float">
```

Header row: `className="flex shrink-0 items-center justify-between px-5 py-3"` (no border-b); breadcrumb span: `className="font-mono text-[10px] uppercase tracking-wide text-text-muted"`; close button: `className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-inset hover:text-text"`.

- [ ] **Step 3: Build + commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/src/components/Panels/panelKit.tsx frontend/src/components/Panels/SidePanel.tsx
git commit -m "feat(ui): panel kit primitives and floating side panel shell"
```

---

### Task 9: CountryPanel — iOS inset groups

**Files:**
- Modify: `frontend/src/components/Panels/CountryPanel.tsx` (full replacement)

**Interfaces:**
- Consumes: `InsetGroup`, `InsetRow`, `MeterBar`, `Pill`, `SectionLabel` from `./panelKit`; `ui`, `statusColor`, `pastel` from `../../uiTheme`. Charts (SupplierBar/RouteDonut) untouched until Task 11.

- [ ] **Step 1: Replace `CountryPanel.tsx`**

```tsx
import { useCountry, useCountryFlows, useCountryChokeExposure, useCountryInfras } from '../../api/hooks/useCountries'
import { useMapStore } from '../../store/mapStore'
import { SupplierBar } from '../Charts/SupplierBar'
import { RouteDonut } from '../Charts/RouteDonut'
import { InsetGroup, InsetRow, MeterBar, Pill, SectionLabel } from './panelKit'
import { statusColor, ui } from '../../uiTheme'

function resilienceInfo(score: number) {
  if (score >= 70) return { label: 'Resilient', color: ui.safe }
  if (score >= 40) return { label: 'Moderate', color: ui.orange }
  return { label: 'Vulnerable', color: ui.alert }
}

function vulnColor(pct: number) {
  if (pct >= 70) return ui.alert
  if (pct >= 40) return ui.orange
  return ui.safe
}

interface Props { iso: string }

export function CountryPanel({ iso }: Props) {
  const { data: country, isLoading } = useCountry(iso)
  const { data: flows } = useCountryFlows(iso)
  const { data: exposure } = useCountryChokeExposure(iso)
  const { data: infras } = useCountryInfras(iso)
  const { setSelected } = useMapStore()

  if (isLoading || !country) {
    return <div className="p-5 text-sm text-text-muted">Loading…</div>
  }

  const res = resilienceInfo(country.resilience_score)
  const balanceNet = country.export_oil_mt - country.import_oil_mt
  const gasBalanceNet = country.export_gas_bcm - country.import_gas_bcm
  const hasGasData =
    country.production_gas_bcm > 0 || country.import_gas_bcm > 0 || country.consumption_gas_bcm > 0

  return (
    <div className="space-y-4 overflow-y-auto px-5 pb-5 text-sm text-text">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">{country.name}</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {country.region} · {country.role}
          </p>
        </div>
        <Pill color={res.color}>{res.label}</Pill>
      </div>

      {/* Crude oil */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Crude oil</SectionLabel>
          <span className="font-mono text-[10px] text-text-muted">Mt/yr</span>
        </div>
        <InsetGroup>
          <InsetRow label="Production" value={country.production_oil_mt} />
          <InsetRow label="Consumption" value={country.consumption_oil_mt} />
          <InsetRow label="Import" value={country.import_oil_mt} />
          <InsetRow label="Export" value={country.export_oil_mt} />
          <InsetRow
            label="Net balance"
            value={`${balanceNet >= 0 ? '+' : ''}${balanceNet.toFixed(1)}`}
            valueColor={balanceNet >= 0 ? ui.safe : ui.alert}
          />
          <InsetRow label="Refining capacity" value={country.refining_capacity_mt} />
        </InsetGroup>
      </div>

      {/* Natural gas */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Natural gas</SectionLabel>
          <span className="font-mono text-[10px] text-text-muted">bcm/yr</span>
        </div>
        {hasGasData ? (
          <InsetGroup>
            <InsetRow label="Production" value={country.production_gas_bcm} />
            <InsetRow label="Consumption" value={country.consumption_gas_bcm} />
            <InsetRow label="Import" value={country.import_gas_bcm} />
            <InsetRow label="Export" value={country.export_gas_bcm} />
            <InsetRow
              label="Net balance"
              value={`${gasBalanceNet >= 0 ? '+' : ''}${gasBalanceNet.toFixed(1)}`}
              valueColor={gasBalanceNet >= 0 ? ui.safe : ui.alert}
            />
            <InsetRow
              label="Import dependency"
              value={`${Math.round(country.dependency_score_gas * 100)}%`}
              valueColor={vulnColor(Math.round(country.dependency_score_gas * 100))}
            />
          </InsetGroup>
        ) : (
          <p className="text-[12px] text-text-muted">No significant gas trade tracked.</p>
        )}
      </div>

      {/* Vulnerability */}
      <div className="space-y-2">
        <SectionLabel>Vulnerability</SectionLabel>
        <VulnRow label="Oil import dependency" value={country.dependency_score} />
        {hasGasData && <VulnRow label="Gas import dependency" value={country.dependency_score_gas} />}
        <VulnRow label="Supplier concentration" value={Math.min(country.supplier_hhi / 10000, 1)} />
        {exposure && (
          <>
            <VulnRow label="Hormuz exposure" value={exposure.hormuz ?? 0} />
            <VulnRow label="Malacca exposure" value={exposure.malacca ?? 0} />
          </>
        )}
      </div>

      {/* Top suppliers */}
      <div className="space-y-1.5">
        <SectionLabel>Top suppliers</SectionLabel>
        {flows && flows.length > 0
          ? <SupplierBar flows={flows} targetIso={iso} />
          : <p className="text-[12px] text-text-muted">No import flows</p>}
      </div>

      {/* Route exposure */}
      <div className="space-y-1.5">
        <SectionLabel>Route exposure</SectionLabel>
        {exposure ? <RouteDonut exposure={exposure} /> : <p className="text-[12px] text-text-muted">Loading…</p>}
      </div>

      {/* Key infrastructures */}
      {infras && infras.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Infrastructures ({infras.length})</SectionLabel>
          <div className="space-y-1">
            {infras.slice(0, 8).map(inf => (
              <button
                key={inf.id}
                onClick={() => setSelected({ type: 'infrastructure', id: inf.id })}
                className="flex w-full items-center gap-2.5 rounded-ctl bg-inset px-3 py-2 text-left transition-colors hover:bg-black/[0.05]"
              >
                <span className="material-symbols-outlined text-text-muted" style={{ fontSize: '0.9rem' }}>
                  {inf.type === 'pipeline' ? 'schema' : inf.type === 'terminal' ? 'anchor' : 'factory'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{inf.name}</div>
                  <div className="text-[10px] text-text-muted">{inf.type} · {inf.subtype}</div>
                </div>
                <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor(inf.status) }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data provenance */}
      <p className="flex items-center gap-1 border-t border-border pt-3 text-[11px] text-text-muted">
        <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>info</span>
        {country.source} · {country.source_year} ·
        <span
          className="font-medium"
          style={{ color: country.confidence === 'high' ? ui.safe : country.confidence === 'medium' ? ui.orange : ui.alert }}
        >
          {country.confidence}
        </span>
      </p>
    </div>
  )
}

function VulnRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = vulnColor(pct)
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-36 shrink-0 truncate text-[11px] text-text-muted">{label}</span>
      <MeterBar pct={pct} color={color} />
      <span className="w-9 text-right font-mono text-[11px] font-medium" style={{ color }}>{pct}%</span>
    </div>
  )
}
```

(Note: the `MACRO` badge and `CommodityHeader`/`Stat`/`Divider` helpers are gone — inset groups replace them.)

- [ ] **Step 2: Build + commit**

Run: `npm run build` — expected: success (watch for unused-import errors).

```bash
git add frontend/src/components/Panels/CountryPanel.tsx
git commit -m "feat(ui): country panel with iOS inset groups and pastel badges"
```

---

### Task 10: Chokepoint / Infra / Field panels

**Files:**
- Modify: `frontend/src/components/Panels/ChokepointPanel.tsx`
- Modify: `frontend/src/components/Panels/InfraPanel.tsx`
- Modify: `frontend/src/components/Panels/FieldPanel.tsx`

**Interfaces:**
- Consumes: `InsetGroup`, `InsetRow`, `MeterBar`, `Pill`, `SectionLabel` from `./panelKit`; `riskColor`, `statusColor`, `ui` from `../../uiTheme`.

- [ ] **Step 1: ChokepointPanel**

- Delete the local `RISK_COLOR` map and `Stat`/`Divider` helpers; import `{ InsetGroup, InsetRow, MeterBar, Pill, SectionLabel }` and `{ riskColor, ui }`.
- `const riskCol = riskColor(choke.risk_level)`; header badge → `<Pill color={riskCol}>{choke.risk_level}</Pill>`.
- The 3-stat grid becomes:

```tsx
        <InsetGroup>
          <InsetRow label="Oil transit" value={`${choke.oil_transit_mbd} Mb/d`} />
          <InsetRow label="Share of world trade" value={`${choke.pct_world_trade}%`} />
          <InsetRow label="Criticality rank" value={rank ? `#${rank}` : '—'} />
          <InsetRow label={`Volume via ${choke.name}`} value={`${totalTraversingVolume.toFixed(1)} Mt/yr`} valueColor={ui.ink} />
        </InsetGroup>
```

- Section headings → `<SectionLabel>Flows traversing ({traversingFlows.length})</SectionLabel>` and `<SectionLabel>Exposed countries ({choke.exposed_countries.length})</SectionLabel>`.
- Flow rows / exposed-country rows: replace the inline track divs (`bg-bg rounded-full h-1…`) with `<MeterBar pct={…} color={…} />` — flows use `ui.oil`, exposed countries use `riskCol`; row text `text-[11px] text-text-muted font-mono` for values; exposed-country buttons get `rounded-lg px-1.5 py-1 hover:bg-inset`.
- Provenance footer: same pattern as CountryPanel (border-t hairline, 11px muted).
- Outer wrapper: `className="space-y-4 overflow-y-auto px-5 pb-5 text-sm text-text"`.

- [ ] **Step 2: InfraPanel**

- Delete local `Stat`; import panelKit + `{ statusColor, ui }`.
- Status colors: `const statusCol = statusColor(infra.status)`, `const critColor = infra.criticality_score >= 70 ? ui.alert : infra.criticality_score >= 40 ? ui.orange : ui.safe`.
- Badge → `<Pill color={statusCol}>{infra.status}</Pill>`.
- The stat grid becomes one `InsetGroup` with `InsetRow`s: Capacity, Route length (conditional), Criticality (`valueColor={critColor}`), Operator, and Country (conditional) as a clickable row: `<InsetRow label="Country" value={infra.country_iso} valueColor={ui.blue} onClick={() => setSelected({ type: 'country', iso: infra.country_iso! })} />`.
- Criticality bar: `<SectionLabel>Criticality score</SectionLabel>` + `<div className="flex items-center gap-2.5"><MeterBar pct={infra.criticality_score} color={critColor} /><span className="w-9 text-right font-mono text-[11px]" style={{ color: critColor }}>{infra.criticality_score}</span></div>`.
- Wrapper/provenance: same pattern as Step 1.

- [ ] **Step 3: FieldPanel**

- Delete local `STATUS_COLOR` and `Stat`; import panelKit + `{ statusColor, ui }`.
- Badge → `<Pill color={statusColor(field.status)}>{field.status}</Pill>`.
- Stat grid → one `InsetGroup`: Oil production (conditional), Gas production (conditional), Discovered, Operator, Country (clickable row, `valueColor={ui.blue}`).
- Wrapper/provenance: same pattern.

- [ ] **Step 4: Build + commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/src/components/Panels/ChokepointPanel.tsx frontend/src/components/Panels/InfraPanel.tsx frontend/src/components/Panels/FieldPanel.tsx
git commit -m "feat(ui): chokepoint/infra/field panels on the panel kit"
```

---

### Task 11: Charts recolor (SupplierBar, RouteDonut)

**Files:**
- Modify: `frontend/src/components/Charts/SupplierBar.tsx`
- Modify: `frontend/src/components/Charts/RouteDonut.tsx`

**Interfaces:**
- Consumes: `ui` from `../../uiTheme`.
- Produces: shared recharts tooltip style used again in Task 12: `{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, fontSize: 11, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }`.

- [ ] **Step 1: SupplierBar**

```tsx
import { ui } from '../../uiTheme'
```

- XAxis tick: `{ fill: ui.axis, fontSize: 10 }`; YAxis tick: `{ fill: ui.ink, fontSize: 11 }`.
- Tooltip `contentStyle`: the shared style above.
- Cells: `fill={i === 0 ? ui.oil : `${ui.oil}${Math.round((0.75 - i * 0.08) * 255).toString(16).padStart(2, '0')}`}` — i.e. copper with decreasing alpha. Bar `radius={[0, 6, 6, 0]}`.

- [ ] **Step 2: RouteDonut**

- Replace `COLORS` with: `const COLORS = [ui.alert, ui.orange, ui.oil, ui.safe, ui.gas, ui.blue, ui.neutral]` (import `ui`).
- "Direct/Other" slice color: `'#C9CDD2'`.
- Tooltip `contentStyle`: shared style above. Legend `wrapperStyle`: `{ fontSize: 10, color: ui.muted }`.

- [ ] **Step 3: Build + commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/src/components/Charts/SupplierBar.tsx frontend/src/components/Charts/RouteDonut.tsx
git commit -m "feat(ui): charts recolored to uiTheme tokens with white tooltips"
```

---

### Task 12: OverviewDashboard restyle

**Files:**
- Modify: `frontend/src/components/Overview/OverviewDashboard.tsx`

**Interfaces:**
- Consumes: `accentHex`, `pastel`, `riskColor`, `ui` from `../../uiTheme`; `Pill`, `MeterBar` from `../Panels/panelKit`.

- [ ] **Step 1: Restyle the dashboard**

- Delete the local `RISK_COLOR` map. Imports: `import { accentHex, riskColor, ui } from '../../uiTheme'` and `import { MeterBar, Pill } from '../Panels/panelKit'`.
- `const accent = accentHex(commodity)` (replaces the `#22d3ee`/`#f59e0b` ternary).
- `Kpi` component becomes ink-valued:

```tsx
function Kpi({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-float">
      <div className="text-[11px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-text">{value}</div>
      {unit && <div className="text-[11px] text-text-muted">{unit}</div>}
    </div>
  )
}
```

(Drop the `accent` prop at all six call sites.)
- Section cards: `className="rounded-card border border-border bg-surface p-5 shadow-float"`; headings: `<h2 className="text-[13px] font-semibold text-text">…</h2>` in sentence case (e.g. `Top {commodity} trade corridors`).
- Corridors chart: XAxis tick fill `ui.axis`; YAxis tick `{ fill: ui.ink, fontSize: 11, fontFamily: 'IBM Plex Mono' }`; Tooltip `contentStyle` = shared white style from Task 11; `cursor={{ fill: 'rgba(0,0,0,0.03)' }}`; Bar `radius={[0, 6, 6, 0]}`; Cell fill `entry.mode === 'pipeline' ? ui.neutral : accent`. Legend swatches: seaborne = `accent`, pipeline = `ui.neutral`, swatch spans `rounded-full`.
- Chokepoint table: header row `section-label` (drop uppercase classes); body rows `hover:bg-inset` instead of `hover:bg-white/5`; risk badge → `<Pill color={riskColor(cp.risk_level)}>{cp.risk_level}</Pill>`; numeric cells keep `font-mono text-text-muted`.
- Producers/importers lists: replace the inline track spans with `<MeterBar pct={(value / (max || 1)) * 100} color={accent} />` (importers use `color={ui.blue}`); row hover `hover:bg-inset rounded-lg px-1 -mx-1`; ISO/mono styles unchanged.

- [ ] **Step 2: Build + commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/src/components/Overview/OverviewDashboard.tsx
git commit -m "feat(ui): light dashboard - ink KPIs, pastel risk pills, themed charts"
```

---

### Task 13: Cleanup — kill transitional aliases and stray hexes

**Files:**
- Modify: `frontend/tailwind.config.ts` (remove aliases)
- Modify: `frontend/src/index.css` (remove `.terminal-card`, `.caps-label`, `.display-caps`)
- Modify: any file the greps below still flag

**Interfaces:** none new — this task enforces the acceptance rules.

- [ ] **Step 1: Find remaining legacy-class users**

Run (repo root): `grep -rn "terminal-card\|caps-label\|display-caps\|tracking-caps" frontend/src --include="*.tsx" --include="*.ts"`
Expected: zero hits (Tasks 5–12 removed them all). If any remain, restyle them with `.floating-card`/`.section-label`/plain Tailwind before continuing.

- [ ] **Step 2: Find banned hex literals**

Run: `grep -rniE "#(DCA54A|46C8DC|D9544D|ef4444|f97316|f59e0b|22c55e|10b981|eab308|22d3ee|38bdf8|64748b|84cc16|818cf8|e879f9|334155|64a1bb|3E6E98|111118|1f1f2e|162631|2e546b|e2e8f0|94a3b8)" frontend/src --include="*.tsx" --include="*.ts"`
Expected: zero hits. Fix any survivors by importing from `uiTheme`.

- [ ] **Step 3: Delete transitional aliases**

- `tailwind.config.ts`: remove the `amber`, `gascyan`, `disrupted`, `rerouted` color entries and the `letterSpacing.caps` block (grep first: `grep -rn "text-amber\|bg-amber\|border-amber\|gascyan\|disrupted\|rerouted\|tracking-caps" frontend/src` must be empty; `text-safe` etc. stay — `safe` is a real token).
- `index.css`: delete the whole "Transitional aliases" block (`.terminal-card`, `.caps-label`, `.display-caps`).

- [ ] **Step 4: Round-corner audit**

Run: `grep -rn "rounded-sm\b\|rounded\b " frontend/src --include="*.tsx" | grep -v "rounded-full\|rounded-ctl\|rounded-card\|rounded-panel\|rounded-lg\|rounded-xl\|rounded-md"`
Expected: zero hits in chrome components. Fix survivors (usually `rounded` → `rounded-ctl`).

- [ ] **Step 5: Tests + build + commit**

Run: `npx vitest run` — expected: PASS. Run: `npm run build` — expected: success.

```bash
git add -A frontend/src frontend/tailwind.config.ts
git commit -m "chore(ui): remove dark-theme aliases, enforce token-only colors"
```

---

### Task 14: Full visual QA pass

**Files:** none planned — fix regressions found, in the file that owns them.

- [ ] **Step 1: Start the stack**

Backend: `docker compose up -d` (repo root). Frontend: preview server on port 5173.

- [ ] **Step 2: Checklist — light map (flat, oil)**

1. Ocean pearl grey, land off-white, hairline grey borders, graticule barely visible.
2. Choropleth: exporters soft copper, importers data blue, balanced near-white — nothing garish.
3. Flows: thin copper lines + calm particles; pipelines mid-grey; chokepoints small soft-red diamonds; labels dark with white halo, readable.
4. Selected country outline is INK and visible.

- [ ] **Step 3: Checklist — chrome**

1. Header: translucent blur bar, ink wordmark, segmented Oil/Gas + Map/Overview pills with sliding white thumb, pill search with focus ring, round icon buttons. No footer.
2. Layers panel and legend: white floating rounded cards with soft shadows, detached from edges.
3. Click a country: side panel floats with 16px margins, radius 20, inset stat groups, pastel pills, rounded meter bars.
4. Tooltip on hover: white rounded card.
5. Overview tab: white KPI cards with ink values, pastel risk pills, light chart axes/tooltips.
6. Info modal: centered rounded sheet, blurred overlay, About block shows Live · v1.2.0.

- [ ] **Step 4: Checklist — switches**

1. Gas mode: flows/vessels/LNG turn blue-green, choropleth teal ramps, dashboard accent follows. No leftover copper on gas surfaces.
2. Globe view: light globe renders correctly, no z-fighting, culling intact.
3. Zoom in: field markers + muted labels legible on light land.

- [ ] **Step 5: Fix anything failed, final commit**

```bash
git add -A
git commit -m "style(ui): visual QA fixes for light redesign"
```

(Skip if nothing to fix.)

---

## Self-Review Notes

- **Spec coverage:** §1 tokens → Tasks 1–2; §2 light map → Tasks 3–4; §3 floating chrome → Tasks 5–8 (header 5, footer/modal 6, overlays 7, side panel 8); §4 internal layouts → Tasks 9–10 (panels), 11 (charts), 12 (dashboard); §5 technical/acceptance → Tasks 2, 13, 14.
- **Type consistency:** panelKit prop names (`pct`, `color`, `label`, `value`, `valueColor`, `onClick`) match usages in Tasks 9, 10, 12; uiTheme exports (`ui`, `accentHex`, `riskColor`, `statusColor`, `pastel`) match usages in Tasks 5–12; Tailwind token names in Task 1 match classes used throughout.
- **Sequencing:** mapTheme flips (Task 2) before uiTheme derives from it (Task 3), so every commit lands with green tests.
