/**
 * AIS handoff engine: decides whether a vessel is shown at its real (live)
 * position, projected along a sea route toward its declared destination, or
 * fading out (destination unknown). Wall-clock driven.
 */
import { advanceAlongRoute, buildGreatCircleRoute, type LonLat } from './geo'
import { SEA_NODES, nearestSeaNode, seaRouteVia } from './searoutes'

export interface LiveVessel {
  mmsi: number
  name: string | null
  type: number | null
  lon: number
  lat: number
  sog: number
  cog: number
  heading: number | null
  dest: LonLat | null
  destName: string | null
  lastSeenMs: number
  firstSeenPos: LonLat
}

export type VesselMode = 'live' | 'projected' | 'faded'
export interface VesselDisplay {
  mode: VesselMode
  position: LonLat
  bearing: number
  opacity: number
}

export const LIVE_TTL_MS = 90_000 // fresh AIS window
export const FADE_DURATION_MS = 360_000 // 6 min ramp to invisible when dark w/o dest
const KN_TO_KMH = 1.852
const PROJECTED_OPACITY = 0.6

// Route cache keyed by mmsi|dest|origin.
const routeCache = new Map<string, LonLat[]>()
export function clearRouteCache(): void {
  routeCache.clear()
}

function projectionRoute(v: LiveVessel, dest: LonLat): LonLat[] {
  const key = `${v.mmsi}|${dest[0].toFixed(2)},${dest[1].toFixed(2)}|${v.lon.toFixed(1)},${v.lat.toFixed(1)}`
  const cached = routeCache.get(key)
  if (cached) return cached
  const from: LonLat = [v.lon, v.lat]
  const fromNode = nearestSeaNode(from)
  const toNode = nearestSeaNode(dest)
  const nodePath = seaRouteVia(fromNode, [], toNode) ?? [SEA_NODES[fromNode], SEA_NODES[toNode]]
  const route = buildGreatCircleRoute([from, ...nodePath, dest])
  routeCache.set(key, route)
  return route
}

export function vesselDisplayState(v: LiveVessel, nowMs: number): VesselDisplay {
  const age = nowMs - v.lastSeenMs

  if (age < LIVE_TTL_MS) {
    return { mode: 'live', position: [v.lon, v.lat], bearing: v.heading ?? v.cog, opacity: 1 }
  }

  const darkMs = age - LIVE_TTL_MS

  if (v.dest) {
    const route = projectionRoute(v, v.dest)
    const distanceKm = v.sog * KN_TO_KMH * (darkMs / 3_600_000)
    const { position, bearing } = advanceAlongRoute(route, distanceKm)
    return { mode: 'projected', position, bearing, opacity: PROJECTED_OPACITY }
  }

  const opacity = Math.max(0, 1 - darkMs / FADE_DURATION_MS)
  return { mode: 'faded', position: [v.lon, v.lat], bearing: v.heading ?? v.cog, opacity }
}
