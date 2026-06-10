/**
 * SVG icon atlas for deck.gl IconLayer.
 *
 * Icons are monochrome white glyphs rendered as data URLs with `mask: true`,
 * so deck.gl tints them via getColor — one glyph set covers normal, hover,
 * selected and disrupted states. Inner cut-outs use fill-rule="evenodd"
 * (mask mode only respects alpha).
 */

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

type RGBA = [number, number, number, number]

// Glyph paths on a 24x24 viewBox, white fill, alpha-only (mask compatible)
const GLYPHS: Record<IconKey, string> = {
  // storage tank: cylinder body + dome + valve stub
  terminal:
    '<ellipse cx="12" cy="8.2" rx="7" ry="2.6"/><path d="M5 8.2h14V18a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 18z"/><rect x="10.7" y="3.4" width="2.6" height="3.2" rx="0.6"/>',
  // harbor crane over a quay
  port:
    '<rect x="3.5" y="18.4" width="17" height="2.4" rx="0.8"/><rect x="6.8" y="6.4" width="2.4" height="12"/><path d="M6.8 8.6L18.6 5.2v2.5l-9.4 2.7z"/><rect x="16.4" y="7" width="1.4" height="5.4"/><rect x="14.7" y="12.2" width="4.8" height="3.4" rx="0.5"/>',
  // distillation columns + base building
  refinery:
    '<rect x="3.5" y="13.4" width="17" height="6.8" rx="1"/><rect x="5.6" y="4.6" width="3" height="9.4" rx="1.2"/><rect x="10.6" y="7.6" width="3" height="6.4" rx="1.2"/><rect x="15.6" y="9.6" width="3" height="4.4" rx="1.2"/><circle cx="7.1" cy="3.4" r="1.3"/>',
  // oil derrick
  field_oil:
    '<path fill-rule="evenodd" d="M10.7 2.6h2.6l4.4 18.8h-2.5l-1-4.6H9.8l-1 4.6H6.3zM12 6.4l-1.5 7h3z"/><rect x="4.6" y="20.2" width="14.8" height="1.6" rx="0.8"/>',
  // gas flame
  field_gas:
    '<path d="M12.2 2.2c1.3 4.4-5.4 6.6-5.4 11.5a5.4 5.4 0 0010.8 0c0-3.2-2.2-4.4-2.2-7.4-2.3 1-1.7 3.3-3.3 4.4-1.1-2.2.6-5.4.1-8.5z"/>',
  // LNG carrier hull with spherical tanks + up arrow (export)
  lng_export:
    '<path d="M2.8 15.6h18.4l-2.6 4.4H5.4z"/><circle cx="8" cy="13" r="2.6"/><circle cx="13.6" cy="13" r="2.6"/><rect x="17.2" y="9.8" width="2.8" height="4.8" rx="0.6"/><path d="M11 2.4l2.9 3.6h-1.8v2.6h-2.2V6h-1.8z" transform="translate(-5 0)"/>',
  // LNG carrier hull with spherical tanks + down arrow (import)
  lng_import:
    '<path d="M2.8 15.6h18.4l-2.6 4.4H5.4z"/><circle cx="8" cy="13" r="2.6"/><circle cx="13.6" cy="13" r="2.6"/><rect x="17.2" y="9.8" width="2.8" height="4.8" rx="0.6"/><path d="M11 8.6L8.1 5h1.8V2.4h2.2V5h1.8z" transform="translate(-5 0)"/>',
  // warning diamond with exclamation cut-out
  chokepoint:
    '<path fill-rule="evenodd" d="M12 1.6L22.4 12 12 22.4 1.6 12zM10.9 6.6h2.2v7h-2.2zm0 8.6h2.2v2.3h-2.2z"/>',
  // stacked shipping containers on a quay
  container_port:
    '<rect x="3.6" y="12.6" width="7.6" height="4.2" rx="0.6"/><rect x="12.4" y="12.6" width="7.6" height="4.2" rx="0.6"/><rect x="8" y="7.6" width="7.6" height="4.2" rx="0.6"/><rect x="3.6" y="17.8" width="16.4" height="2.2" rx="0.8"/>',
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

// Per-type tint colors — desaturated "terminal" palette; hover/selected
// states brighten via deck.gl autoHighlight.
export const TYPE_COLOR: Record<string, RGBA> = {
  terminal: [220, 165, 74, 225], // amber
  port: [126, 150, 182, 212], // steel
  refinery: [203, 110, 144, 212], // muted rose
  field_oil: [151, 193, 102, 205], // muted olive-lime
  field_gas: [221, 150, 88, 205], // muted orange
  lng_export: [70, 200, 220, 222], // cyan
  lng_import: [124, 188, 220, 200], // light steel-blue
  chokepoint: [217, 84, 77, 235], // signal red
  container_port: [118, 136, 156, 190], // slate
  pipeline_oil: [62, 160, 128, 210], // muted emerald
  pipeline_gas: [70, 200, 220, 200], // cyan
}

export const STATUS_COLOR: Record<string, RGBA> = {
  offline: [94, 116, 133, 160],
  limited: [216, 140, 74, 215],
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
