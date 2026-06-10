/**
 * GlobeView helpers.
 *
 * Our coarse country polygons tessellate into chords that dip inside the
 * sphere, so depth testing against them hides labels/flows that sit exactly
 * on the surface. In globe mode we instead disable depth testing on the data
 * layers (painter's order, which we control) and cull the hidden hemisphere
 * in JS so far-side geometry can't paint over the front.
 */

type LonLat = [number, number]

const RAD = Math.PI / 180

/** Central angle (degrees) between two lon/lat points. */
export function angularDistanceDeg(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLon = (b[0] - a[0]) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RAD
}

/** Points further than this from the camera center are on the far side. */
export const POINT_VISIBLE_DEG = 82
const PATH_VISIBLE_DEG = 95

export function pointVisibleOnGlobe(point: LonLat, camera: LonLat): boolean {
  return angularDistanceDeg(point, camera) < POINT_VISIBLE_DEG
}

/** A path is kept if any sampled vertex faces the camera. */
export function pathVisibleOnGlobe(path: LonLat[], camera: LonLat): boolean {
  const step = Math.max(1, Math.floor(path.length / 8))
  for (let i = 0; i < path.length; i += step) {
    if (angularDistanceDeg(path[i], camera) < PATH_VISIBLE_DEG) return true
  }
  return angularDistanceDeg(path[path.length - 1], camera) < PATH_VISIBLE_DEG
}

/** Layer GPU parameters for globe mode: paint in layer order, no depth. */
export const GLOBE_NO_DEPTH = {
  depthCompare: 'always',
  depthWriteEnabled: false,
} as const

export function globeParams(globe: boolean): Record<string, unknown> | undefined {
  return globe ? (GLOBE_NO_DEPTH as unknown as Record<string, unknown>) : undefined
}
