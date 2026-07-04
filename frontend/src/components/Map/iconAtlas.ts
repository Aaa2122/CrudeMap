/**
 * SVG icon atlas for deck.gl IconLayer.
 *
 * Icons are monochrome white glyphs rendered as data URLs with `mask: true`,
 * so deck.gl tints them via getColor — one glyph set covers normal, hover,
 * selected and disrupted states. Inner cut-outs use fill-rule="evenodd"
 * (mask mode only respects alpha).
 */

import { ALERT, GAS, NEUTRAL_MARK, NEUTRAL_MARK_DIM, OIL, withAlpha, type RGBA } from './mapTheme'

export type IconKey =
  | 'terminal'
  | 'port'
  | 'refinery'
  | 'field_oil'
  | 'field_gas'
  | 'lng_export'
  | 'lng_import'
  | 'chokepoint'
  | 'container_port'
  | 'vessel'

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

function svgDataUrl(body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="#fff">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const ICON_URLS = Object.fromEntries(
  (Object.keys(GLYPHS) as IconKey[]).map(key => [key, svgDataUrl(GLYPHS[key])]),
) as Record<IconKey, string>

export function getIcon(key: IconKey) {
  return { id: key, url: ICON_URLS[key], width: 96, height: 96, mask: true }
}

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

/** Resolve the icon key for an infrastructure row. */
export function infraIconKey(infra: { type: string | null; subtype: string | null }): IconKey {
  if (infra.type === 'lng_terminal') {
    return infra.subtype === 'export_terminal' ? 'lng_export' : 'lng_import'
  }
  if (infra.type === 'refinery') return 'refinery'
  if (infra.type === 'port') return 'port'
  return 'terminal'
}

export function infraColor(infra: { type: string | null; subtype: string | null; status: string }): RGBA {
  if (STATUS_COLOR[infra.status]) return STATUS_COLOR[infra.status]
  return TYPE_COLOR[infraIconKey(infra)]
}
