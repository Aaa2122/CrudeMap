/**
 * Single source of truth for every color drawn on the (light) map.
 *
 * Hue budget: exactly three functional accents (oil amber, gas cyan,
 * alert red) over a neutral ink/steel base. Choropleth ramps live in
 * countryMetrics.ts but must stay desaturated. No other map file may
 * define a color literal.
 */

export type RGBA = [number, number, number, number]

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
