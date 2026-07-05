import type { FlowPathDatum } from './flowGeometry'
import { distKm } from './geo'

/**
 * Simulated live fleet: discrete vessels (with identity — name, class,
 * tonnage, cargo) sailing along the routed trade flows. Vessel count per
 * route scales with annual volume.
 *
 * Vessels move at a credible, near-real ground speed (~13-19 kn by class) —
 * the SAME speed for every vessel of a class — so a long haul genuinely takes
 * far longer than a short hop (no teleporting long routes). Wall-clock time is
 * lightly compressed by SIM_TIME_COMPRESSION so motion is perceptible without
 * looking fast.
 */

export interface Vessel {
  id: string
  name: string
  vclass: string
  dwt: string
  cargo: string
  flow: FlowPathDatum
  phase: number
  isDisrupted: boolean
  routeKm: number
  speedKn: number
}

// Realistic laden cruising speeds by class (knots).
const CLASS_SPEED_KN: Record<string, number> = {
  VLCC: 13,
  Suezmax: 14,
  Aframax: 14.5,
  'LNG carrier': 18,
  'Q-Flex LNG carrier': 19,
}

const KN_TO_KM_S = 1.852 / 3600 // 1 knot in km per second

// Wall-clock seconds are multiplied by this before applying real ship speed.
// At 1500, the longest voyages (~15,000 km) take ~25 min on screen and short
// hops a few minutes — slow and credible. Single knob to retune the pace.
export const SIM_TIME_COMPRESSION = 1500

const NAME_A = [
  'Astro', 'Gulf', 'Nordic', 'Pacific', 'Cape', 'Eagle', 'Stena', 'Crystal',
  'Front', 'Sea', 'Atlantic', 'Iron', 'Polar', 'Desert', 'Ocean', 'Amber',
]
const NAME_B = [
  'Pioneer', 'Meridian', 'Voyager', 'Sovereign', 'Harmony', 'Spirit', 'Glory',
  'Horizon', 'Vanguard', 'Aurora', 'Titan', 'Falcon', 'Oracle', 'Summit',
  'Legacy', 'Condor',
]

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 0xffffffff
}

function vesselIdentity(seed: number, isGas: boolean, volume: number) {
  const name = `${NAME_A[Math.floor(hash(seed) * NAME_A.length)]} ${NAME_B[Math.floor(hash(seed + 7) * NAME_B.length)]}`
  if (isGas) {
    return volume >= 15
      ? { name, vclass: 'Q-Flex LNG carrier', dwt: '~120,000 dwt', cargo: 'LNG' }
      : { name, vclass: 'LNG carrier', dwt: '~95,000 dwt', cargo: 'LNG' }
  }
  if (volume >= 50) return { name, vclass: 'VLCC', dwt: '~300,000 dwt', cargo: 'crude oil' }
  if (volume >= 20) return { name, vclass: 'Suezmax', dwt: '~160,000 dwt', cargo: 'crude oil' }
  return { name, vclass: 'Aframax', dwt: '~110,000 dwt', cargo: 'crude oil' }
}

function routeLengthKm(path: [number, number][]): number {
  let total = 0
  for (let i = 1; i < path.length; i += 1) total += distKm(path[i - 1], path[i])
  return total
}

export function buildFleet(flowPaths: FlowPathDatum[], disrupted: Set<number>): Vessel[] {
  const vessels: Vessel[] = []
  for (const datum of flowPaths) {
    const { flow, timestamps, path } = datum
    if (flow.transport_mode !== 'seaborne') continue
    if (timestamps.length < 6) continue // too short to sail

    const isGas = flow.commodity === 'gas'
    const volume = isGas ? flow.volume_bcm ?? 0 : flow.volume_mt
    const count = Math.max(1, Math.min(5, Math.round(volume / (isGas ? 8 : 22))))
    const isDisrupted = disrupted.has(flow.id)
    const routeKm = Math.max(1, routeLengthKm(path))

    for (let i = 0; i < count; i += 1) {
      const seed = flow.id * 31 + i * 101
      const identity = vesselIdentity(seed, isGas, volume)
      vessels.push({
        id: `${flow.id}-${i}`,
        ...identity,
        flow: datum,
        phase: hash(seed + 13),
        isDisrupted,
        routeKm,
        speedKn: CLASS_SPEED_KN[identity.vclass] ?? 13,
      })
    }
  }
  return vessels
}

export interface VesselPosition {
  position: [number, number]
  bearing: number
  progress: number
}

/**
 * Locate a vessel along its route at wall-clock time `nowSec` (seconds).
 * Distance covered = real ship speed × compressed elapsed time, so every
 * vessel of a class shares one ground speed and long routes take longer.
 * Route `timestamps` are cumulative distance (normalized 0..1000), so a
 * distance fraction maps straight onto them.
 */
export function vesselPosition(vessel: Vessel, nowSec: number): VesselPosition {
  const { path, timestamps } = vessel.flow
  // Disrupted routes: vessels hold position mid-voyage
  let progress: number
  if (vessel.isDisrupted) {
    progress = vessel.phase
  } else {
    const travelledKm = nowSec * vessel.speedKn * KN_TO_KM_S * SIM_TIME_COMPRESSION
    progress = ((vessel.phase * vessel.routeKm + travelledKm) % vessel.routeKm) / vessel.routeKm
  }
  const target = progress * 1000

  // Timestamps grow ~linearly with index — start near the estimate
  let index = Math.min(timestamps.length - 2, Math.max(0, Math.floor(progress * (timestamps.length - 1))))
  while (index > 0 && timestamps[index] > target) index -= 1
  while (index < timestamps.length - 2 && timestamps[index + 1] < target) index += 1

  const t0 = timestamps[index]
  const t1 = timestamps[index + 1]
  const f = t1 > t0 ? (target - t0) / (t1 - t0) : 0
  const [lon0, lat0] = path[index]
  const [lon1, lat1] = path[index + 1]
  const position: [number, number] = [lon0 + (lon1 - lon0) * f, lat0 + (lat1 - lat0) * f]

  // Bearing from north, clockwise
  const bearing =
    (Math.atan2((lon1 - lon0) * Math.cos((lat0 * Math.PI) / 180), lat1 - lat0) * 180) / Math.PI

  return { position, bearing, progress }
}
