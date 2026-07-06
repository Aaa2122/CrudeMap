/**
 * Shared great-circle geometry for route projection (AIS handoff) and any
 * other consumer. Mirrors the private helpers in flowGeometry.ts; kept
 * separate and unit-tested so the AIS engine can reuse it without touching
 * the (untested) flow renderer.
 */

export type LonLat = [number, number]

const RAD = Math.PI / 180

export function distKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLon = (b[0] - a[0]) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function greatCircleLeg(a: LonLat, b: LonLat, stepKm: number): LonLat[] {
  const dist = distKm(a, b)
  const segments = Math.max(1, Math.ceil(dist / stepKm))
  if (segments === 1) return [a]
  const lat1 = a[1] * RAD, lon1 = a[0] * RAD, lat2 = b[1] * RAD, lon2 = b[0] * RAD
  const d = dist / 6371
  const sinD = Math.sin(d)
  if (sinD === 0) return [a]
  const points: LonLat[] = []
  for (let i = 0; i < segments; i += 1) {
    const f = i / segments
    const A = Math.sin((1 - f) * d) / sinD
    const B = Math.sin(f * d) / sinD
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    points.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD])
  }
  return points
}

function unwrapLongitudes(path: LonLat[]): LonLat[] {
  if (path.length === 0) return path
  const out: LonLat[] = [[...path[0]] as LonLat]
  for (let i = 1; i < path.length; i += 1) {
    let lon = path[i][0]
    const prev = out[i - 1][0]
    while (lon - prev > 180) lon -= 360
    while (lon - prev < -180) lon += 360
    out.push([lon, path[i][1]])
  }
  return out
}

export function buildGreatCircleRoute(anchors: LonLat[], stepKm = 200): LonLat[] {
  if (anchors.length < 2) return anchors
  const raw: LonLat[] = []
  for (let i = 0; i < anchors.length - 1; i += 1) {
    raw.push(...greatCircleLeg(anchors[i], anchors[i + 1], stepKm))
  }
  raw.push(anchors[anchors.length - 1])
  return unwrapLongitudes(raw)
}

function bearingDeg(a: LonLat, b: LonLat): number {
  return (Math.atan2((b[0] - a[0]) * Math.cos(a[1] * RAD), b[1] - a[1]) * 180) / Math.PI
}

/** Walk `distanceKm` from the start of `route`; clamp to the last vertex. */
export function advanceAlongRoute(route: LonLat[], distanceKm: number): { position: LonLat; bearing: number } {
  if (route.length === 1) return { position: route[0], bearing: 0 }
  let remaining = Math.max(0, distanceKm)
  for (let i = 0; i < route.length - 1; i += 1) {
    const segKm = distKm(route[i], route[i + 1])
    if (remaining <= segKm || i === route.length - 2) {
      const f = segKm > 0 ? Math.min(1, remaining / segKm) : 0
      const position: LonLat = [
        route[i][0] + (route[i + 1][0] - route[i][0]) * f,
        route[i][1] + (route[i + 1][1] - route[i][1]) * f,
      ]
      return { position, bearing: bearingDeg(route[i], route[i + 1]) }
    }
    remaining -= segKm
  }
  const last = route.length - 1
  return { position: route[last], bearing: bearingDeg(route[last - 1], route[last]) }
}
