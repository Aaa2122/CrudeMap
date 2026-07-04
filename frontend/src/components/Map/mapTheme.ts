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
export const LAND_DIM: RGBA = [13, 21, 31, 242] // countries outside the current selection

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
