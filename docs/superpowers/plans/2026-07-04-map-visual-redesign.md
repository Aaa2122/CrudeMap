# Map Visual Redesign ("Épuré / Pro") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire CrudeMap deck.gl map into a restrained, professional look: a strict 3-accent color budget (oil amber / gas cyan / alert red) over a neutral ink base, geometric markers instead of pictogram icons, hairline strokes, and calmer animation — with every map color centralized in one theme module.

**Architecture:** Create `frontend/src/components/Map/mapTheme.ts` as the single source of truth for all map RGBA tokens and shared sizing helpers. Every layer file (`FlowLayer`, `PipelineLayer`, `ChokeLayer`, `VesselLayer`, `FieldLayer`, `InfraIconLayer`, `ShippingLaneLayer`, `CountryChoroplethLayer`, `gisBasemap`, `iconAtlas`, `countryMetrics`, `MapLegend`) is then updated to consume the theme. Decorative effects (pipeline glow, chokepoint halos, critical-pulse rings, noise grain) are removed; animation speeds are reduced (integer clock multipliers preserved).

**Tech Stack:** React 18, deck.gl 9, Tailwind 3, Vite 5. Adds `vitest` as dev dependency for pure-function tests.

## Design Direction (the "why" — read before implementing)

The current map mixes ~11 hues and several decorative effects. The target look is the sober style of professional energy-intelligence tools (Kpler / Vortexa / Bloomberg-terminal maps):

- **Hue budget = 3 functional accents.** Oil amber `#DCA54A`, gas cyan `#46C8DC`, alert red `#D9544D` (these are already the app's brand accents — keep them). Everything else on the map is neutral: ink ground, steel-grey marks, hairline strokes. Choropleth ramps are data encodings and may use muted hues, but must stay desaturated.
- **Shapes, not colors, distinguish asset types.** Pictogram SVG icons (derrick, flame, harbor crane, distillation columns, LNG hull) are replaced by minimal geometric glyphs: filled dot, hollow ring, square, diamond, vessel triangle.
- **Hairlines everywhere.** Flow underlays, pipelines, country borders and graticule get thinner and more transparent.
- **Calm the motion.** Particle clock ×10 → ×4, shorter trails, no pulsing ring on merely "critical" chokepoints (only truly disrupted ones pulse), no halo disks, no glow underlays.
- **Neutral labels.** Muted steel-grey text, consistent halo, smaller sizes.

## Global Constraints

- No external map tiles ever (self-rendered basemap stays; no MapLibre/CARTO/OSM).
- All animation clock multipliers MUST be integers (shared 60 s clock wraps; non-integer multipliers cause a visible discontinuity at wrap).
- `animTime` must never appear in the dependency array of any `useMemo` that builds layer *data* (only in per-frame accessors / `currentTime`).
- Every new/modified deck.gl layer must keep `parameters: globeParams(globe)` and the existing `pointVisibleOnGlobe` / `pathVisibleOnGlobe` hemisphere culling — GlobeView breaks without them.
- Icon layers must keep their invisible `ScatterplotLayer` hit-targets (transparent icon pixels are not pickable).
- After this plan, **no map layer file may contain a hardcoded RGBA color literal** — all colors import from `mapTheme.ts` (the only exceptions: `[0,0,0,1]` invisible hit-target fills and `[0,0,0,0]` transparent fills).
- Run all frontend commands from `C:\Project\CrudeMap\frontend`.
- TypeScript must compile (`npm run build`) at the end of every task.

---

### Task 1: Test harness + map theme module

**Files:**
- Modify: `frontend/package.json` (add vitest + test script)
- Create: `frontend/src/components/Map/mapTheme.ts`
- Test: `frontend/src/components/Map/mapTheme.test.ts`

**Interfaces:**
- Produces (consumed by every later task):
  - `type RGBA = [number, number, number, number]`
  - Tokens: `OCEAN`, `GRATICULE`, `HAIRLINE`, `HAIRLINE_STRONG`, `NEUTRAL_MARK`, `NEUTRAL_MARK_DIM`, `LABEL`, `LABEL_MUTED`, `LABEL_HALO`, `OIL`, `GAS`, `ALERT`, `SELECTED`, `HIGHLIGHT`, `NO_DATA` — all `RGBA`
  - `withAlpha(color: RGBA, alpha: number): RGBA`
  - `accentFor(commodity: 'oil' | 'gas' | string): RGBA` (gas → GAS, anything else → OIL)
  - `toCss(color: RGBA): string` (returns `rgba(r, g, b, a/255)` CSS string)
  - `flowWidth(volume: number): number` = `0.5 + Math.min(1.6, Math.log1p(Math.max(0, volume)) * 0.35)`

- [ ] **Step 1: Install vitest and add the test script**

Run: `npm install -D vitest` (in `frontend/`)
Then in `frontend/package.json` add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/components/Map/mapTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ALERT, GAS, OIL, accentFor, flowWidth, toCss, withAlpha } from './mapTheme'

describe('mapTheme', () => {
  it('keeps the existing brand accents (oil amber, gas cyan, alert red)', () => {
    expect(OIL.slice(0, 3)).toEqual([220, 165, 74])
    expect(GAS.slice(0, 3)).toEqual([70, 200, 220])
    expect(ALERT.slice(0, 3)).toEqual([217, 84, 77])
  })

  it('withAlpha replaces only the alpha channel', () => {
    expect(withAlpha(OIL, 40)).toEqual([220, 165, 74, 40])
  })

  it('accentFor maps commodity to its accent, defaulting to oil', () => {
    expect(accentFor('gas')).toBe(GAS)
    expect(accentFor('oil')).toBe(OIL)
    expect(accentFor('products')).toBe(OIL)
  })

  it('toCss renders a css rgba() string', () => {
    expect(toCss([220, 165, 74, 255])).toBe('rgba(220, 165, 74, 1)')
  })

  it('flowWidth is thin, monotonic and capped', () => {
    expect(flowWidth(0)).toBeCloseTo(0.5)
    expect(flowWidth(50)).toBeGreaterThan(flowWidth(5))
    expect(flowWidth(100000)).toBeLessThanOrEqual(2.1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/Map/mapTheme.test.ts`
Expected: FAIL — cannot resolve `./mapTheme`

- [ ] **Step 4: Write the theme module**

Create `frontend/src/components/Map/mapTheme.ts`:

```ts
/**
 * Single source of truth for every color drawn on the map.
 *
 * Hue budget: exactly three functional accents (oil amber, gas cyan,
 * alert red) over a neutral ink/steel base. Choropleth ramps live in
 * countryMetrics.ts but must stay desaturated. No other map file may
 * define a color literal.
 */

export type RGBA = [number, number, number, number]

// ---- Neutral base -------------------------------------------------------
export const OCEAN: RGBA = [6, 14, 24, 255]
export const GRATICULE: RGBA = [112, 150, 182, 10]
export const HAIRLINE: RGBA = [46, 66, 84, 100] // country borders, thin strokes
export const HAIRLINE_STRONG: RGBA = [70, 96, 118, 160]
export const NEUTRAL_MARK: RGBA = [148, 167, 184, 205] // default infrastructure mark
export const NEUTRAL_MARK_DIM: RGBA = [104, 122, 138, 150] // offline / declining
export const LABEL: RGBA = [190, 204, 216, 225]
export const LABEL_MUTED: RGBA = [140, 158, 173, 205]
export const LABEL_HALO: RGBA = [8, 14, 21, 235]
export const NO_DATA: RGBA = [13, 22, 33, 242]

// ---- Functional accents (the ONLY hues) ---------------------------------
export const OIL: RGBA = [220, 165, 74, 255] // #DCA54A — brand amber
export const GAS: RGBA = [70, 200, 220, 255] // #46C8DC — brand cyan
export const ALERT: RGBA = [217, 84, 77, 255] // #D9544D — brand red

// ---- Interaction states --------------------------------------------------
export const SELECTED: RGBA = [255, 255, 255, 255]
export const HIGHLIGHT: RGBA = [255, 255, 255, 60] // deck.gl autoHighlight

// ---- Helpers --------------------------------------------------------------
export function withAlpha(color: RGBA, alpha: number): RGBA {
  return [color[0], color[1], color[2], alpha]
}

export function accentFor(commodity: 'oil' | 'gas' | string): RGBA {
  return commodity === 'gas' ? GAS : OIL
}

export function toCss(color: RGBA): string {
  const alpha = color[3] / 255
  const rounded = Math.round(alpha * 1000) / 1000
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${rounded})`
}

/** Shared width scale for flow lines — hairline, log-scaled, hard-capped. */
export function flowWidth(volume: number): number {
  return 0.5 + Math.min(1.6, Math.log1p(Math.max(0, volume)) * 0.35)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Map/mapTheme.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Verify build and commit**

Run: `npm run build` — expected: success.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/Map/mapTheme.ts frontend/src/components/Map/mapTheme.test.ts
git commit -m "feat(map): add vitest and centralized mapTheme color module"
```

---

### Task 2: Basemap and page-ground cleanup

**Files:**
- Modify: `frontend/src/components/Map/gisBasemap.ts`
- Modify: `frontend/src/index.css` (remove noise grain overlay)

**Interfaces:**
- Consumes: `OCEAN`, `GRATICULE` from `./mapTheme` (Task 1)
- Produces: nothing new — same `OceanLayer()` / `GraticuleLayer()` exports.

- [ ] **Step 1: Point the basemap at the theme**

In `frontend/src/components/Map/gisBasemap.ts`, replace the import block and local color constants:

```ts
import { PathLayer, SolidPolygonLayer } from '@deck.gl/layers'
import { GRATICULE, OCEAN } from './mapTheme'
```

Delete these two lines:

```ts
const OCEAN_COLOR: [number, number, number, number] = [6, 14, 24, 255]
const GRATICULE_COLOR: [number, number, number, number] = [112, 150, 182, 16]
```

Then in `OceanLayer()` use `getFillColor: OCEAN`, and in `GraticuleLayer()` use `getColor: GRATICULE` and change `getWidth: 0.6` to `getWidth: 0.5`.

- [ ] **Step 2: Remove the noise-grain overlay from the ocean ground**

In `frontend/src/index.css`, delete the entire `.ocean-ground::after { ... }` rule (the fractal-noise data-URL block, lines with `content: ''` through the closing brace). Keep the `.ocean-ground` radial-gradient rule itself.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success, no unused-variable errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Map/gisBasemap.ts frontend/src/index.css
git commit -m "style(map): quieter basemap - themed ocean/graticule, drop noise grain"
```

---

### Task 3: Choropleth restraint (palettes + hairline borders)

**Files:**
- Modify: `frontend/src/components/Map/countryMetrics.ts` (palettes only — logic untouched)
- Modify: `frontend/src/components/Map/CountryChoroplethLayer.tsx` (border colors)
- Test: `frontend/src/components/Map/countryMetrics.test.ts`

**Interfaces:**
- Consumes: `HAIRLINE`, `SELECTED`, `withAlpha`, `NO_DATA` from `./mapTheme`
- Produces: same `buildMetricScale`, `getMetricOptions`, `getMetricConfig`, `formatMetricValue`, `getCountryMetricValue` signatures — palettes desaturated. `countryMetrics.ts` must import `NO_DATA` from `mapTheme` instead of defining `NO_DATA_COLOR`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/Map/countryMetrics.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NO_DATA } from './mapTheme'
import { buildMetricScale, getCountryMetricValue } from './countryMetrics'

const country = (over: Record<string, number>) =>
  ({
    iso: 'XXX',
    name: 'X',
    production_oil_mt: 0,
    consumption_oil_mt: 0,
    production_gas_bcm: 0,
    consumption_gas_bcm: 0,
    ...over,
  } as any)

describe('countryMetrics after restyle', () => {
  it('oil balance is production minus consumption', () => {
    expect(
      getCountryMetricValue(country({ production_oil_mt: 500, consumption_oil_mt: 200 }), 'oil_balance'),
    ).toBe(300)
  })

  it('diverging scale treats zero as data, not no-data', () => {
    const scale = buildMetricScale(
      [country({ production_oil_mt: 100 }), country({ consumption_oil_mt: 100 })],
      'oil_balance',
    )
    expect(scale.getColor(0)).not.toEqual(NO_DATA)
    expect(scale.getColor(null)).toEqual(NO_DATA)
  })

  it('volume scale uses the mapTheme NO_DATA token for missing values', () => {
    const scale = buildMetricScale([country({ production_oil_mt: 10 })], 'production_oil_mt')
    expect(scale.getColor(null)).toEqual(NO_DATA)
    expect(scale.getColor(0)).toEqual(NO_DATA)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Map/countryMetrics.test.ts`
Expected: FAIL — `NO_DATA` token not used by countryMetrics yet (import mismatch: `scale.getColor(null)` returns the locally defined `NO_DATA_COLOR`, which currently equals the token, so the first failure is actually the missing export/import compile step; if all three pass immediately, proceed — the test still locks the behavior).

- [ ] **Step 3: Re-palette `countryMetrics.ts`**

In `frontend/src/components/Map/countryMetrics.ts`:

Add import at top:

```ts
import { NO_DATA } from './mapTheme'
```

Delete the line `const NO_DATA_COLOR: RGBA = [13, 22, 33, 242]` and replace every usage of `NO_DATA_COLOR` with `NO_DATA` (three usages: legendItems push, `getColor`, none in `getBucketLabel`).

Replace the five ramp constants with these desaturated versions (alpha stays 242):

```ts
// Ramps are data encodings: desaturated luminance scales only.
const VOLUME_PALETTE: RGBA[] = [
  [14, 24, 35, 242],
  [22, 40, 56, 242],
  [35, 63, 86, 242],
  [60, 100, 130, 242],
  [112, 156, 184, 242],
]

const RISK_PALETTE: RGBA[] = [
  [26, 30, 35, 242],
  [52, 48, 50, 242],
  [96, 64, 62, 242],
  [160, 80, 72, 242],
  [217, 84, 77, 242],
]

const RESILIENCE_PALETTE: RGBA[] = [
  [22, 30, 27, 242],
  [30, 50, 41, 242],
  [42, 76, 60, 242],
  [64, 112, 86, 242],
  [104, 160, 126, 242],
]

const SCORE_PALETTE: RGBA[] = [
  [20, 28, 40, 242],
  [30, 48, 68, 242],
  [44, 74, 102, 242],
  [70, 110, 142, 242],
  [124, 160, 188, 242],
]

const GAS_VOLUME_PALETTE: RGBA[] = [
  [13, 28, 32, 242],
  [19, 46, 51, 242],
  [28, 72, 78, 242],
  [44, 110, 117, 242],
  [96, 170, 178, 242],
]

const OIL_BALANCE_PALETTE: RGBA[] = [
  [56, 96, 130, 242], // strong net importer (cold steel)
  [34, 58, 80, 242],
  [19, 28, 39, 242], // balanced
  [96, 74, 42, 242],
  [188, 142, 66, 242], // strong net exporter (amber family)
]

const GAS_BALANCE_PALETTE: RGBA[] = [
  [56, 96, 130, 242],
  [34, 58, 80, 242],
  [19, 28, 39, 242],
  [28, 80, 80, 242],
  [72, 158, 152, 242], // strong net exporter (cyan family)
]
```

- [ ] **Step 4: Hairline country borders**

In `frontend/src/components/Map/CountryChoroplethLayer.tsx`:

Add import:

```ts
import { HAIRLINE, HIGHLIGHT, SELECTED, withAlpha } from './mapTheme'
```

Replace the stroke props of the `GeoJsonLayer`:

```ts
    getLineColor: (feature: any) =>
      feature.properties?.__iso === selectedIso ? SELECTED : HAIRLINE,
    getLineWidth: (feature: any) => (feature.properties?.__iso === selectedIso ? 1.5 : 0.5),
```

And replace `highlightColor: [255, 255, 255, 40]` with `highlightColor: withAlpha(SELECTED, 40)`.
(Note: the amber selected-outline `[220, 165, 74, 255]` becomes white — selection is an interaction state, not a commodity.)

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run` — expected: PASS (all files).
Run: `npm run build` — expected: success.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Map/countryMetrics.ts frontend/src/components/Map/countryMetrics.test.ts frontend/src/components/Map/CountryChoroplethLayer.tsx
git commit -m "style(map): desaturated choropleth ramps, hairline borders, white selection"
```

---

### Task 4: Geometric icon atlas (kill the pictograms)

**Files:**
- Modify: `frontend/src/components/Map/iconAtlas.ts` (replace glyphs + color map, keep exports)
- Test: `frontend/src/components/Map/iconAtlas.test.ts`

**Interfaces:**
- Consumes: `ALERT`, `GAS`, `NEUTRAL_MARK`, `NEUTRAL_MARK_DIM`, `OIL`, `withAlpha`, type `RGBA` from `./mapTheme`
- Produces (unchanged signatures — callers in FieldLayer/InfraIconLayer/ChokeLayer/VesselLayer/ShippingLaneLayer keep working):
  - `type IconKey` (same union)
  - `getIcon(key: IconKey): { id; url; width; height; mask }`
  - `TYPE_COLOR: Record<string, RGBA>`, `STATUS_COLOR: Record<string, RGBA>`
  - `infraIconKey(infra): IconKey`, `infraColor(infra): RGBA`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/Map/iconAtlas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GAS, NEUTRAL_MARK, OIL } from './mapTheme'
import { TYPE_COLOR, infraColor, infraIconKey } from './iconAtlas'

describe('geometric icon atlas', () => {
  it('maps infra rows to icon keys unchanged', () => {
    expect(infraIconKey({ type: 'lng_terminal', subtype: 'export_terminal' })).toBe('lng_export')
    expect(infraIconKey({ type: 'lng_terminal', subtype: null })).toBe('lng_import')
    expect(infraIconKey({ type: 'refinery', subtype: null })).toBe('refinery')
    expect(infraIconKey({ type: 'port', subtype: null })).toBe('port')
    expect(infraIconKey({ type: 'terminal', subtype: null })).toBe('terminal')
  })

  it('uses only the 3-accent budget: oil hue, gas hue, neutrals', () => {
    const allowedHues = new Set(
      [OIL, GAS, NEUTRAL_MARK].map(c => c.slice(0, 3).join(',')),
    )
    for (const [key, color] of Object.entries(TYPE_COLOR)) {
      if (key === 'chokepoint') continue // alert red allowed
      expect(allowedHues.has(color.slice(0, 3).join(',')), `hue of ${key}`).toBe(true)
    }
  })

  it('offline status dims the mark', () => {
    const online = infraColor({ type: 'terminal', subtype: null, status: 'active' })
    const offline = infraColor({ type: 'terminal', subtype: null, status: 'offline' })
    expect(offline[3]).toBeLessThan(online[3])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Map/iconAtlas.test.ts`
Expected: FAIL — `TYPE_COLOR` still contains rose/olive/violet hues.

- [ ] **Step 3: Rewrite the atlas glyphs and colors**

Replace the `GLYPHS` map, `TYPE_COLOR` and `STATUS_COLOR` in `frontend/src/components/Map/iconAtlas.ts` (keep `IconKey`, `svgDataUrl`, `ICON_URLS`, `getIcon`, `infraIconKey`, and the `infraColor` function body as-is). Add the theme import and delete the local `RGBA` type alias:

```ts
import { ALERT, GAS, NEUTRAL_MARK, NEUTRAL_MARK_DIM, OIL, withAlpha, type RGBA } from './mapTheme'
```

```ts
// Minimal geometric glyphs on a 24x24 viewBox — shape distinguishes type,
// color stays within the 3-accent budget. All alpha-only (mask compatible).
const GLYPHS: Record<IconKey, string> = {
  // filled dot: oil terminal
  terminal: '<circle cx="12" cy="12" r="6.5"/>',
  // hollow ring: port
  port:
    '<path fill-rule="evenodd" d="M12 4.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zm0 3a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"/>',
  // square: refinery
  refinery: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  // filled dot (small): oil field
  field_oil: '<circle cx="12" cy="12" r="5.5"/>',
  // hollow ring (small): gas field
  field_gas:
    '<path fill-rule="evenodd" d="M12 6a6 6 0 110 12 6 6 0 010-12zm0 2.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z"/>',
  // square with up-notch: LNG export
  lng_export: '<path d="M6 9h12v9a1 1 0 01-1 1H7a1 1 0 01-1-1zM12 3.6l3.4 4H8.6z"/>',
  // square with down-notch: LNG import
  lng_import: '<path d="M6 6h12v9H6zM12 20.4L8.6 16.4h6.8z"/>',
  // diamond: chokepoint
  chokepoint: '<path d="M12 3.2L20.8 12 12 20.8 3.2 12z"/>',
  // hollow square: container port
  container_port:
    '<path fill-rule="evenodd" d="M5.5 5.5h13v13h-13zm2.6 2.6v7.8h7.8V8.1z"/>',
  // tanker hull seen from above, bow pointing up (rotated by heading)
  vessel:
    '<path d="M12 1.6c2.6 2.8 4 5.4 4 8.6v9.2a2.6 2.6 0 01-2.6 2.6h-2.8A2.6 2.6 0 018 19.4v-9.2c0-3.2 1.4-5.8 4-8.6z"/>',
}
```

```ts
// Shape distinguishes type; hue only marks the commodity family.
export const TYPE_COLOR: Record<string, RGBA> = {
  terminal: withAlpha(OIL, 215),
  port: NEUTRAL_MARK,
  refinery: NEUTRAL_MARK,
  field_oil: withAlpha(OIL, 200),
  field_gas: withAlpha(GAS, 200),
  lng_export: withAlpha(GAS, 220),
  lng_import: withAlpha(GAS, 175),
  chokepoint: withAlpha(ALERT, 230),
  container_port: NEUTRAL_MARK_DIM,
  pipeline_oil: NEUTRAL_MARK,
  pipeline_gas: NEUTRAL_MARK,
}

export const STATUS_COLOR: Record<string, RGBA> = {
  offline: withAlpha(NEUTRAL_MARK_DIM, 130),
  limited: withAlpha(NEUTRAL_MARK, 165),
}
```

Also delete the now-unused local line `type RGBA = [number, number, number, number]`.

- [ ] **Step 4: Run tests and build**

Run: `npx vitest run` — expected: PASS.
Run: `npm run build` — expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Map/iconAtlas.ts frontend/src/components/Map/iconAtlas.test.ts
git commit -m "style(map): geometric marker glyphs, neutral+accent color budget"
```

---

### Task 5: Flow lines — thin, single-accent, calmer particles

**Files:**
- Modify: `frontend/src/components/Map/FlowLayer.tsx`

**Interfaces:**
- Consumes: `ALERT`, `HIGHLIGHT`, `accentFor`, `flowWidth`, `withAlpha` from `./mapTheme` (Task 1)
- Produces: same `FlowLayer(props)` signature.

- [ ] **Step 1: Restyle FlowLayer**

In `frontend/src/components/Map/FlowLayer.tsx`:

Replace the six color constants at the top with a theme import:

```ts
import { ALERT, HIGHLIGHT, accentFor, flowWidth, withAlpha } from './mapTheme'
```

Delete `type RGBA = ...` and the `OIL_BASE`/`OIL_HEAD`/`GAS_BASE`/`GAS_HEAD`/`DISRUPTED_BASE`/`DISRUPTED_HEAD` constants.

Inside the component, replace:

```ts
  const baseColor = commodity === 'gas' ? GAS_BASE : OIL_BASE
  const headColor = commodity === 'gas' ? GAS_HEAD : OIL_HEAD
```

with:

```ts
  const accent = accentFor(commodity)
  const baseColor = withAlpha(accent, 46) // static underlay: barely-there
  const headColor = withAlpha(accent, 200) // particle heads
```

In the `data` mapping, replace `width: 0.7 + Math.min(2.2, Math.log1p(volumeOf(d)) * 0.5),` with:

```ts
      width: flowWidth(volumeOf(d)),
```

In `routeLayer`, change:
- `getColor: (d: any) => (d.isDisrupted ? DISRUPTED_BASE : baseColor)` → `getColor: (d: any) => (d.isDisrupted ? withAlpha(ALERT, 90) : baseColor)`
- `widthMinPixels: 1` → `widthMinPixels: 0.5`
- `highlightColor: [255, 255, 255, 110]` → `highlightColor: HIGHLIGHT`

In the particle layers (`TripsLayer`), change:
- The clock: `const particleClock = (animTime * 10) % 1` → `const particleClock = (animTime * 4) % 1` (integer multiplier — constraint).
- Update the comment above it: particles now run 4 cycles per clock cycle.
- `getColor: isDisruptedGroup ? DISRUPTED_HEAD : headColor` → `getColor: isDisruptedGroup ? withAlpha(ALERT, 210) : headColor`
- `getWidth: (d: any) => d.width + 0.8` → `getWidth: (d: any) => d.width + 0.4`
- `widthMinPixels: 1.5` → `widthMinPixels: 1`
- `trailLength: 220` → `trailLength: 140`

- [ ] **Step 2: Verify build and existing tests**

Run: `npm run build` — expected: success.
Run: `npx vitest run` — expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Map/FlowLayer.tsx
git commit -m "style(map): hairline flows, slower shorter particle trails"
```

---

### Task 6: Pipelines — neutral traces, no glow

**Files:**
- Modify: `frontend/src/components/Map/PipelineLayer.tsx`

**Interfaces:**
- Consumes: `HIGHLIGHT`, `NEUTRAL_MARK`, `NEUTRAL_MARK_DIM`, `SELECTED`, `withAlpha`, type `RGBA` from `./mapTheme`
- Produces: same `PipelineLayer(props)` signature, now returning a single `PathLayer` (no glow underlay).

- [ ] **Step 1: Restyle PipelineLayer**

In `frontend/src/components/Map/PipelineLayer.tsx`:

Replace the color constants and local RGBA alias with:

```ts
import { HIGHLIGHT, NEUTRAL_MARK, NEUTRAL_MARK_DIM, SELECTED, withAlpha, type RGBA } from './mapTheme'
```

Delete `OIL_COLOR`, `GAS_COLOR`, `PRODUCTS_COLOR`, `OFFLINE_COLOR` and replace `pipelineColor` with:

```ts
// Pipelines are ground infrastructure: neutral steel traces. Commodity is
// encoded by line style (gas dashed / oil+products solid), not by hue.
function pipelineColor(p: Infrastructure): RGBA {
  if (p.status === 'offline') return withAlpha(NEUTRAL_MARK_DIM, 140)
  return withAlpha(NEUTRAL_MARK, 185)
}
```

Delete the entire `glowLayer` (`new PathLayer({ id: 'pipeline-glow', ... })`) block and change the return to `return [lineLayer]`.

In the `data` mapping, replace the width formula:

```ts
      width: 0.8 + Math.min(1.6, Math.log1p(p.capacity_bcm ?? p.capacity_mt ?? 0) * 0.3),
```

In `lineLayer`, change:
- `d.id === selectedId ? ([255, 255, 255, 245] as RGBA) : d.color` → `d.id === selectedId ? SELECTED : d.color`
- `getWidth: (d: any) => (d.id === selectedId ? d.width + 1.2 : d.width)` → `getWidth: (d: any) => (d.id === selectedId ? d.width + 1 : d.width)`
- `highlightColor: [255, 255, 255, 110]` → `highlightColor: HIGHLIGHT`
- `getDashArray: (d: any) => (d.dashed ? [6, 4] : [0, 0])` → `getDashArray: (d: any) => (d.dashed ? [5, 4] : [0, 0])`

Update the file-top JSDoc to: `/** Pipelines as neutral hairline traces; gas dashed, offline dimmed. */`

- [ ] **Step 2: Verify build**

Run: `npm run build` — expected: success (watch for unused-import errors after deleting the glow layer).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Map/PipelineLayer.tsx
git commit -m "style(map): neutral hairline pipelines, remove glow underlay"
```

---

### Task 7: Chokepoints — small diamonds, no halo, pulse only when disrupted

**Files:**
- Modify: `frontend/src/components/Map/ChokeLayer.tsx`

**Interfaces:**
- Consumes: `ALERT`, `HIGHLIGHT`, `LABEL_MUTED`, `LABEL_HALO`, `NEUTRAL_MARK`, `withAlpha`, type `RGBA` from `./mapTheme`
- Produces: same `ChokeLayer(props)` signature. The `haloLayer` is removed; the pulse ring fires only for `isDisrupted` (not for `risk_level === 'critical'`).

- [ ] **Step 1: Restyle ChokeLayer**

In `frontend/src/components/Map/ChokeLayer.tsx`:

Replace the local `RGBA` alias and `RISK_COLOR` with:

```ts
import { ALERT, HIGHLIGHT, LABEL_HALO, LABEL_MUTED, NEUTRAL_MARK, withAlpha, type RGBA } from './mapTheme'

// Risk encoded by alpha on a single alert hue; low-risk straits stay neutral.
const RISK_COLOR: Record<string, RGBA> = {
  critical: withAlpha(ALERT, 235),
  high: withAlpha(ALERT, 175),
  medium: withAlpha(NEUTRAL_MARK, 205),
  low: withAlpha(NEUTRAL_MARK, 150),
}
```

In the `data` mapping:
- keep `radius` as is (it now only drives the disruption pulse), and
- change `pulses: isDisrupted || chokepoint.risk_level === 'critical'` → `pulses: isDisrupted`

Delete the entire `haloLayer` block (`new ScatterplotLayer({ id: 'choke-halo', ... })`) and remove it from the returned `layers` array: `const layers: any[] = [pulseLayer, iconLayer]`.

In `iconLayer`, change:
- `getSize: (d: any) => (d.risk_level === 'critical' ? 24 : 19)` → `getSize: (d: any) => (d.risk_level === 'critical' ? 15 : 12)`
- `highlightColor: [255, 255, 255, 90]` → `highlightColor: HIGHLIGHT`

In the labels `TextLayer`, change:
- `getSize: 11.5` → `getSize: 10`
- `getColor: [229, 238, 245, 240]` → `getColor: LABEL_MUTED`
- `outlineColor: [10, 16, 24, 235]` → `outlineColor: LABEL_HALO`

Update the file JSDoc to: `/** Maritime chokepoints: small risk-tinted diamonds; disrupted straits pulse. */`

(The `(animTime * 20) % 1` pulse clock keeps its integer multiplier — leave it.)

- [ ] **Step 2: Verify build**

Run: `npm run build` — expected: success.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Map/ChokeLayer.tsx
git commit -m "style(map): quiet chokepoints - no halo, smaller diamonds, pulse only when disrupted"
```

---

### Task 8: Vessels and shipping lanes — background elements

**Files:**
- Modify: `frontend/src/components/Map/VesselLayer.tsx`
- Modify: `frontend/src/components/Map/ShippingLaneLayer.tsx`

**Interfaces:**
- Consumes: `ALERT`, `HIGHLIGHT`, `LABEL_HALO`, `LABEL_MUTED`, `NEUTRAL_MARK`, `accentFor`, `withAlpha` from `./mapTheme`
- Produces: same component signatures.

- [ ] **Step 1: Restyle VesselLayer**

In `frontend/src/components/Map/VesselLayer.tsx`:

Replace the color constants and RGBA alias with:

```ts
import { ALERT, HIGHLIGHT, accentFor, withAlpha } from './mapTheme'
```

Delete `OIL_VESSEL`, `GAS_VESSEL`, `DISRUPTED_VESSEL` and `type RGBA = ...`. In the component replace:

```ts
  const baseColor = commodity === 'gas' ? GAS_VESSEL : OIL_VESSEL
```

with:

```ts
  const baseColor = withAlpha(accentFor(commodity), 225)
```

Shrink the hulls:

```ts
const CLASS_SIZE: Record<string, number> = {
  VLCC: 11,
  Suezmax: 10,
  Aframax: 9,
  'Q-Flex LNG carrier': 10,
  'LNG carrier': 9,
}
```

In `iconLayer`, change:
- `getSize: (d: any) => CLASS_SIZE[d.vclass] ?? 12` → `getSize: (d: any) => CLASS_SIZE[d.vclass] ?? 9`
- `getColor: (d: any) => (d.isDisrupted ? DISRUPTED_VESSEL : baseColor)` → `getColor: (d: any) => (d.isDisrupted ? withAlpha(ALERT, 235) : baseColor)`
- `highlightColor: [255, 255, 255, 110]` → `highlightColor: HIGHLIGHT`

- [ ] **Step 2: Restyle ShippingLaneLayer**

In `frontend/src/components/Map/ShippingLaneLayer.tsx`:

Replace the color constant and RGBA alias:

```ts
import { HIGHLIGHT, LABEL_HALO, LABEL_MUTED, NEUTRAL_MARK, withAlpha, type RGBA } from './mapTheme'

// Background traffic: neutral, very low alpha, hairline.
const LANE_COLOR: RGBA = withAlpha(NEUTRAL_MARK, 55)
```

In the lane `data` mapping, replace the width formula:

```ts
      width: 0.6 + Math.min(2.2, Math.log1p(feature.properties.teu_m) * 0.7),
```

In the lanes `PathLayer`, change `highlightColor: [147, 197, 253, 160]` → `highlightColor: HIGHLIGHT`.

In the container-ports `IconLayer`, change `getSize: (d: any) => 13 + Math.min(7, Math.log1p(d.teu) * 1.8)` → `getSize: (d: any) => 10 + Math.min(5, Math.log1p(d.teu) * 1.3)`.

In the port-labels `TextLayer`, change:
- `getColor: [165, 190, 220, 215]` → `getColor: LABEL_MUTED`
- `outlineColor: [10, 16, 24, 235]` → `outlineColor: LABEL_HALO`

- [ ] **Step 3: Verify build and tests**

Run: `npm run build` — expected: success.
Run: `npx vitest run` — expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Map/VesselLayer.tsx frontend/src/components/Map/ShippingLaneLayer.tsx
git commit -m "style(map): recede vessels and container lanes into the background"
```

---

### Task 9: Infrastructure and field markers — smaller marks, muted labels

**Files:**
- Modify: `frontend/src/components/Map/InfraIconLayer.tsx`
- Modify: `frontend/src/components/Map/FieldLayer.tsx`

**Interfaces:**
- Consumes: `HIGHLIGHT`, `LABEL`, `LABEL_HALO`, `LABEL_MUTED`, `SELECTED`, `withAlpha`, type `RGBA` from `./mapTheme` (colors themselves already flow in from Task 4's `iconAtlas`).
- Produces: same component signatures.

- [ ] **Step 1: Restyle InfraIconLayer**

In `frontend/src/components/Map/InfraIconLayer.tsx`, add:

```ts
import { HIGHLIGHT, LABEL, LABEL_HALO, SELECTED } from './mapTheme'
```

In `iconLayer`, change:
- `getSize: (d: any) => (d.id === selectedId ? 30 : 17 + Math.min(9, Math.log1p(d.capacityRank) * 1.9))` → `getSize: (d: any) => (d.id === selectedId ? 20 : 10 + Math.min(5, Math.log1p(d.capacityRank) * 1.1))`
- `getColor: (d: any) => (d.id === selectedId ? [255, 255, 255, 255] : infraColor(d))` → `getColor: (d: any) => (d.id === selectedId ? SELECTED : infraColor(d))`
- `highlightColor: [255, 255, 255, 90]` → `highlightColor: HIGHLIGHT`

In the labels `TextLayer`, change:
- `getSize: 11` → `getSize: 10`
- `getColor: [226, 232, 240, 235]` → `getColor: LABEL`
- `outlineColor: [10, 16, 24, 235]` → `outlineColor: LABEL_HALO`

In `hitLayer`, change `getRadius: 13` → `getRadius: 11` (marks are smaller now, keep the target generous).

- [ ] **Step 2: Restyle FieldLayer**

In `frontend/src/components/Map/FieldLayer.tsx`, add to the existing iconAtlas import line:

```ts
import { HIGHLIGHT, LABEL_HALO, LABEL_MUTED, SELECTED, withAlpha, type RGBA } from './mapTheme'
```

Delete the local `type RGBA = ...` alias.

In `iconLayer`, change:
- `getSize: (d: any) => (d.id === selectedId ? 28 : 14 + Math.min(8, Math.log1p(d.production) * 1.6))` → `getSize: (d: any) => (d.id === selectedId ? 18 : 8 + Math.min(4, Math.log1p(d.production) * 0.9))`
- the `getColor` ternary: `? ([255, 255, 255, 255] as RGBA)` → `? SELECTED`, and `? ([d.color[0], d.color[1], d.color[2], 150] as RGBA)` → `? withAlpha(d.color, 140)`
- `highlightColor: [255, 255, 255, 90]` → `highlightColor: HIGHLIGHT`

In the labels `TextLayer`, change:
- `getSize: 10.5` → `getSize: 9.5`
- `getColor: [203, 213, 225, 225]` → `getColor: LABEL_MUTED`
- `outlineColor: [10, 16, 24, 235]` → `outlineColor: LABEL_HALO`

- [ ] **Step 3: Verify build and tests**

Run: `npm run build` — expected: success.
Run: `npx vitest run` — expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Map/InfraIconLayer.tsx frontend/src/components/Map/FieldLayer.tsx
git commit -m "style(map): smaller infrastructure/field marks, muted labels"
```

---

### Task 10: Legend and UI accents follow the theme

**Files:**
- Modify: `frontend/src/components/Map/MapLegend.tsx`
- Modify: `frontend/src/components/Map/WorldMap.tsx` (tooltip accent only)

**Interfaces:**
- Consumes: `GAS`, `NEUTRAL_MARK`, `NEUTRAL_MARK_DIM`, `OIL`, `ALERT`, `accentFor`, `toCss`, `withAlpha` from `./mapTheme`
- Produces: same component signatures. The legend's swatch colors must visually match what the layers now draw.

- [ ] **Step 1: Re-source MapLegend colors from the theme**

In `frontend/src/components/Map/MapLegend.tsx`:

Add import:

```ts
import { ALERT, GAS, NEUTRAL_MARK, NEUTRAL_MARK_DIM, OIL, accentFor, toCss, withAlpha } from './mapTheme'
```

Delete the local `rgba(...)` helper and replace its single usage (`backgroundColor: rgba(item.color)`) with `backgroundColor: toCss(item.color)`.

Replace `const accent = commodity === 'gas' ? '#46C8DC' : '#DCA54A'` with:

```ts
  const accent = toCss(accentFor(commodity))
```

Rewrite the `keyRows` block so every swatch matches the restyled layers:

```ts
  const keyRows: KeyRow[] = []
  if (layers.flows) {
    keyRows.push({ label: 'Trade flows · particles = direction', color: accent, shape: 'line' })
  }
  if (layers.vessels && layers.flows) {
    keyRows.push({
      label: commodity === 'gas' ? 'LNG carriers · simulated live' : 'Tankers · simulated live',
      color: accent,
      shape: 'dot',
    })
  }
  if (layers.pipelines) {
    keyRows.push(
      commodity === 'gas'
        ? { label: 'Gas pipelines · dashed', color: toCss(NEUTRAL_MARK), shape: 'dash' }
        : { label: 'Crude pipelines', color: toCss(NEUTRAL_MARK), shape: 'line' },
    )
  }
  if (layers.terminals && commodity === 'oil') {
    keyRows.push({ label: 'Terminals · ports (ring)', color: toCss(OIL), shape: 'dot' })
  }
  if (layers.lngTerminals && commodity === 'gas') {
    keyRows.push({ label: 'LNG terminals', color: toCss(GAS), shape: 'dot' })
  }
  if (layers.refineries && commodity === 'oil') {
    keyRows.push({ label: 'Refineries (square)', color: toCss(NEUTRAL_MARK), shape: 'dot' })
  }
  if (layers.fields) {
    keyRows.push(
      commodity === 'gas'
        ? { label: 'Gas fields · zoom in', color: toCss(GAS), shape: 'dot' }
        : { label: 'Oil fields · zoom in', color: toCss(OIL), shape: 'dot' },
    )
  }
  if (layers.chokepoints) {
    keyRows.push({ label: 'Chokepoints · red = critical', color: toCss(withAlpha(ALERT, 235)), shape: 'dot' })
  }
  if (layers.shippingLanes) {
    keyRows.push({ label: 'Container corridors · width = TEU', color: toCss(NEUTRAL_MARK_DIM), shape: 'line' })
  }
```

- [ ] **Step 2: Theme the tooltip accent in WorldMap**

In `frontend/src/components/Map/WorldMap.tsx`, add:

```ts
import { accentFor, toCss } from './mapTheme'
```

and replace the tooltip line style:

```ts
              style={index === 1 ? { color: commodity === 'gas' ? '#46C8DC' : '#DCA54A' } : undefined}
```

with:

```ts
              style={index === 1 ? { color: toCss(accentFor(commodity)) } : undefined}
```

- [ ] **Step 3: Verify build and tests**

Run: `npm run build` — expected: success.
Run: `npx vitest run` — expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Map/MapLegend.tsx frontend/src/components/Map/WorldMap.tsx
git commit -m "style(map): legend and tooltip swatches sourced from mapTheme"
```

---

### Task 11: Full-map visual QA pass

**Files:**
- No planned edits — this task verifies the result in the running app and fixes regressions found.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Confirm no stray color literals remain**

Run (from repo root):

```bash
grep -rnE "\[[0-9]{1,3}, ?[0-9]{1,3}, ?[0-9]{1,3}, ?[0-9]{1,3}\]" frontend/src/components/Map --include="*.tsx" --include="*.ts" | grep -v mapTheme | grep -v test | grep -v "0, 0, 0, 1\]" | grep -v "0, 0, 0, 0\]"
```

Expected: only matches in `countryMetrics.ts` (choropleth ramps — allowed) and non-color arrays (e.g. `getPixelOffset`, dash arrays, view states). Any other RGBA literal in a layer file is a task that was missed — fix it by importing from `mapTheme`.

- [ ] **Step 2: Start the dev stack and open the map**

Backend: `docker compose up -d` (from repo root, if not already running).
Frontend: `npm run dev` (in `frontend/`), open `http://localhost:5173`.

- [ ] **Step 3: Visual checklist (flat view, oil commodity)**

Verify each item; screenshot for the record:

1. Ocean is flat deep ink — no visible noise grain, graticule barely perceptible.
2. Country fills are muted; borders are thin uniform hairlines; selected country outlines in white (not amber).
3. Flows are thin amber lines with slow, short particle trails — no thick ropes.
4. Pipelines are thin neutral grey traces with no glow; gas pipelines dashed (flat view).
5. Chokepoints are small diamonds (red only for critical/high, grey otherwise); **no halo disks, no pulsing rings** anywhere (nothing is disrupted by default).
6. Infrastructure marks are small geometric shapes (dot / ring / square), not pictograms; labels muted grey.
7. Vessels are small amber hulls; container lanes are faint neutral lines.
8. Legend swatches match what is drawn (amber flows, neutral pipelines, etc.).

- [ ] **Step 4: Visual checklist (switch checks)**

1. Toggle commodity to gas: flows/vessels/LNG marks turn cyan; choropleth switches to gas ramps; nothing else changes hue.
2. Switch to globe view: land renders above ocean, flows/markers visible on the front hemisphere only, no z-fighting regressions (the `globeParams`/culling constraint held).
3. Zoom in past field LOD: field dots/rings appear with muted labels.
4. Click a terminal: selected mark turns white and enlarges; side panel opens.

- [ ] **Step 5: Fix anything that failed, then final commit**

If a checklist item fails, fix it in the corresponding layer file (colors must come from `mapTheme.ts`) and re-verify. Then:

```bash
git add -A
git commit -m "style(map): visual QA fixes for the epure redesign"
```

(Skip the commit if there was nothing to fix.)

---

## Self-Review Notes

- Spec coverage: user asked for a rework of flow figures ✔ (Task 5), colors ✔ (Tasks 1–10, 3-accent budget), overall style ✔ (Tasks 2, 4, 6–9 remove decorative effects), "épuré/professionnel" ✔ (design direction section + QA checklist).
- Type consistency: `mapTheme.ts` exports (`RGBA`, `withAlpha`, `accentFor`, `toCss`, `flowWidth`, token names) are used with identical names in Tasks 2–10.
- Known risk: `iconAtlas.test.ts` checks `TYPE_COLOR` hues against the budget — if a future task adds a type, the test enforces the budget automatically.
