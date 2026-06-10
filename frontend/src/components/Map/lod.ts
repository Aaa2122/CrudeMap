/**
 * Zoom-based level-of-detail rules — keeps the map readable at world scale
 * while showing full density when zoomed in.
 *
 * Quantize zoom before using it in useMemo deps so data slicing only
 * recomputes on meaningful zoom changes, not every frame of a fly-to.
 */

export function quantizeZoom(zoom: number): number {
  return Math.round(zoom * 2) / 2
}

/** Share of items (ranked by capacity) visible at a given zoom. */
function visibleShare(zoom: number): number {
  if (zoom < 2.2) return 0.25
  if (zoom < 3) return 0.55
  if (zoom < 4) return 0.85
  return 1
}

/** Slice `items` to the top share by `getWeight` for the current zoom. */
export function filterByLod<T>(items: T[], zoom: number, getWeight: (item: T) => number): T[] {
  const share = visibleShare(zoom)
  if (share >= 1 || items.length === 0) return items
  const count = Math.max(1, Math.ceil(items.length * share))
  return [...items].sort((a, b) => getWeight(b) - getWeight(a)).slice(0, count)
}

/** Fields are sub-national detail — only show once zoomed past world view. */
export function fieldsVisibleAtZoom(zoom: number): boolean {
  return zoom >= 2.6
}

/** Container ports ride along the shipping lanes layer at medium zoom. */
export function containerPortsVisibleAtZoom(zoom: number): boolean {
  return zoom >= 2.2
}

/** Infrastructure name labels appear progressively. */
export function labelsVisibleAtZoom(zoom: number): boolean {
  return zoom >= 3
}
