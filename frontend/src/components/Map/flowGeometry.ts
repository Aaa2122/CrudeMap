import type { ChokepointBrief, Flow, Infrastructure } from '../../api/types'
import { CHOKEPOINT_NODE, nearestSeaNode, seaRouteVia } from './searoutes'

/**
 * Flow geometry, grounded in physical reality:
 *
 * - Seaborne flows depart from the source country's main export terminal and
 *   arrive at the target's main import port (picked among its terminals by
 *   proximity to the other end — Russia ships to Japan from Sakhalin, to
 *   Europe from Yamal/Primorsk). The route runs over the curated maritime
 *   graph (searoutes.ts) and is forced through the flow's chokepoints.
 * - Pipeline flows follow the traced geometry of the matching pipeline.
 *
 * Longitudes are unwrapped (can exceed +/-180) so transpacific paths render
 * without antimeridian artifacts. Timestamps are cumulative normalized
 * distance (0..1000 per flow) for TripsLayer animation.
 */

export interface FlowPathDatum {
  flow: Flow
  path: [number, number][]
  timestamps: number[]
}

type LonLat = [number, number]

// Coastal fallback anchors for countries without a seeded terminal of the
// right commodity/direction (port-city coordinates).
const COASTAL_ANCHORS: Record<string, LonLat> = {
  DZA: [-0.3, 35.85], MAR: [-7.6, 33.6], TUN: [10.3, 36.85], ESP: [-5.4, 36.15],
  PRT: [-8.85, 37.95], GRC: [23.6, 37.9], MLT: [14.5, 35.9], CYP: [33.0, 34.6],
  ISR: [34.65, 31.8], LBN: [35.5, 33.9], JOR: [35.0, 29.4], SYR: [35.9, 34.9],
  IRL: [-6.2, 53.3], ISL: [-21.9, 64.1], DNK: [9.75, 55.55], SWE: [11.95, 57.7],
  FIN: [24.5, 60.1], EST: [24.7, 59.45], LVA: [24.1, 57.0], LTU: [21.1, 55.7],
  UKR: [30.7, 46.5], ROU: [28.65, 44.4], BGR: [27.9, 42.5], GEO: [41.65, 42.15],
  HRV: [14.55, 45.2], MNE: [18.7, 42.4], ALB: [19.45, 41.3], SVN: [13.73, 45.55],
  BIH: [17.65, 43.05], POL: [18.65, 54.4], DEU: [8.1, 53.57], FRA: [0.15, 49.65],
  CAN: [-123.0, 49.27], MEX: [-94.42, 18.15], GTM: [-90.8, 13.9], HND: [-87.95, 15.85],
  NIC: [-86.8, 12.2], CRI: [-84.8, 9.95], PAN: [-79.55, 8.95], CUB: [-82.35, 23.13],
  JAM: [-76.8, 17.95], HTI: [-72.35, 18.55], DOM: [-69.6, 18.4], TTO: [-61.5, 10.4],
  COL: [-75.7, 9.4], VEN: [-64.85, 10.1], GUY: [-58.15, 6.8], SUR: [-55.15, 5.85],
  ECU: [-79.65, 0.99], PER: [-77.15, -12.05], CHL: [-71.6, -33.05], ARG: [-62.1, -38.8],
  URY: [-56.2, -34.9], BRA: [-41.0, -21.8], GHA: [-0.05, 5.6], CIV: [-4.0, 5.25],
  SEN: [-17.4, 14.7], CMR: [9.91, 2.93], GAB: [8.7, -0.7], COG: [11.85, -4.78],
  NAM: [14.5, -22.95], MOZ: [34.85, -19.8], TZA: [39.3, -6.8], KEN: [39.6, -4.05],
  DJI: [43.15, 11.6], SDN: [37.22, 19.62], YEM: [45.0, 12.8], OMN: [58.55, 23.63],
  QAT: [51.55, 24.99], BHR: [50.6, 26.2], PAK: [66.98, 24.8], LKA: [79.85, 6.95],
  BGD: [91.8, 22.3], MMR: [96.2, 16.78], THA: [101.15, 12.67], KHM: [103.5, 10.6],
  VNM: [107.07, 10.35], MYS: [102.25, 2.2], IDN: [101.45, 1.68], PHL: [121.05, 13.75],
  TWN: [120.28, 22.6], AUS: [115.7, -32.2], NZL: [174.5, -35.85], FJI: [178.45, -18.15],
  PNG: [147.0, -9.32], EGY: [29.62, 31.06], LBY: [19.9, 30.4], NGA: [7.17, 4.45],
  AGO: [12.2, -5.55], ZAF: [17.97, -33.03], GNQ: [8.78, 3.76], USA: [-93.9, 29.7],
}

// Landlocked exporters ship from someone else's coast — route from the
// terminal their pipeline system actually feeds.
const EXPORT_ANCHOR_OVERRIDES: Record<string, LonLat> = {
  KAZ: [37.8, 44.72], // CPC terminal, Novorossiysk
  AZE: [35.57, 36.88], // BTC terminus, Ceyhan
  SSD: [37.22, 19.62], // Port Sudan
  TCD: [9.91, 2.93], // Kribi (Chad–Cameroon)
  BOL: [-57.65, -19.0], // GASBOL head (overland)
}

// (source>target>commodity) -> seeded pipeline name whose traced geometry
// the flow should follow.
const PIPELINE_BY_PAIR: Record<string, string> = {
  'CAN>USA>oil': 'Enbridge Mainline',
  'RUS>CHN>oil': 'ESPO China Spur (Skovorodino-Daqing)',
  'KAZ>CHN>oil': 'Kazakhstan-China Pipeline',
  'MMR>CHN>oil': 'Myanmar-China Crude Pipeline',
  'RUS>HUN>oil': 'Druzhba Pipeline',
  'RUS>SVK>oil': 'Druzhba Pipeline',
  'RUS>CZE>oil': 'Druzhba Pipeline',
  'RUS>BLR>oil': 'Druzhba Pipeline',
  'TCD>CMR>oil': 'Chad-Cameroon Pipeline',
  'AZE>GEO>oil': 'Baku-Tbilisi-Ceyhan (BTC)',
  'RUS>CHN>gas': 'Power of Siberia',
  'RUS>TUR>gas': 'TurkStream',
  'RUS>HUN>gas': 'TurkStream',
  'RUS>SRB>gas': 'TurkStream',
  'RUS>BLR>gas': 'Yamal-Europe Pipeline',
  'NOR>DEU>gas': 'Europipe I/II',
  'NOR>NLD>gas': 'Europipe I/II',
  'NOR>GBR>gas': 'Langeled',
  'NOR>FRA>gas': 'Franpipe',
  'NOR>BEL>gas': 'Franpipe',
  'DZA>ITA>gas': 'Trans-Mediterranean (Transmed)',
  'DZA>TUN>gas': 'Trans-Mediterranean (Transmed)',
  'DZA>ESP>gas': 'Medgaz',
  'LBY>ITA>gas': 'Greenstream',
  'AZE>TUR>gas': 'TANAP',
  'AZE>GEO>gas': 'TANAP',
  'AZE>ITA>gas': 'Trans Adriatic Pipeline (TAP)',
  'AZE>GRC>gas': 'Trans Adriatic Pipeline (TAP)',
  'TKM>CHN>gas': 'Central Asia-China Pipeline',
  'KAZ>CHN>gas': 'Central Asia-China Pipeline',
  'UZB>CHN>gas': 'Central Asia-China Pipeline',
  'MMR>CHN>gas': 'Myanmar-China Gas Pipeline',
  'IRN>TUR>gas': 'Iran-Turkey Pipeline',
  'QAT>ARE>gas': 'Dolphin Gas Pipeline',
  'QAT>OMN>gas': 'Dolphin Gas Pipeline',
  'BOL>BRA>gas': 'GASBOL (Bolivia-Brazil)',
}

const RAD = Math.PI / 180

function distKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLon = (b[0] - a[0]) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Spherical interpolation between two lon/lat points (excludes endpoint). */
function greatCircleLeg(a: LonLat, b: LonLat, stepKm: number): LonLat[] {
  const dist = distKm(a, b)
  const segments = Math.max(1, Math.ceil(dist / stepKm))
  if (segments === 1) return [a]

  const lat1 = a[1] * RAD
  const lon1 = a[0] * RAD
  const lat2 = b[1] * RAD
  const lon2 = b[0] * RAD
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

/** Keep consecutive longitudes within 180 deg of each other (antimeridian). */
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

interface AnchorCandidate {
  pos: LonLat
  capacity: number
}

interface AnchorIndex {
  oilExport: Map<string, AnchorCandidate[]>
  oilImport: Map<string, AnchorCandidate[]>
  gasExport: Map<string, AnchorCandidate[]>
  gasImport: Map<string, AnchorCandidate[]>
}

function buildAnchorIndex(infras: Infrastructure[]): AnchorIndex {
  const index: AnchorIndex = {
    oilExport: new Map(),
    oilImport: new Map(),
    gasExport: new Map(),
    gasImport: new Map(),
  }
  const push = (map: Map<string, AnchorCandidate[]>, iso: string, candidate: AnchorCandidate) => {
    if (!map.has(iso)) map.set(iso, [])
    map.get(iso)!.push(candidate)
  }

  for (const infra of infras) {
    if (infra.lat == null || infra.lon == null || !infra.country_iso) continue
    const pos: LonLat = [infra.lon, infra.lat]
    if (infra.type === 'lng_terminal') {
      const candidate = { pos, capacity: infra.capacity_bcm ?? 0 }
      if (infra.subtype === 'export_terminal') push(index.gasExport, infra.country_iso, candidate)
      else push(index.gasImport, infra.country_iso, candidate)
      continue
    }
    if (infra.commodity === 'gas' || infra.type === 'pipeline' || infra.type === 'refinery') continue
    const candidate = { pos, capacity: infra.capacity_mt ?? 0 }
    if (infra.subtype === 'export_terminal') push(index.oilExport, infra.country_iso, candidate)
    if (infra.subtype === 'import_terminal' || infra.type === 'port') push(index.oilImport, infra.country_iso, candidate)
  }
  return index
}

/**
 * Pick the country's terminal closest to the other end of the trade —
 * a country exports to Asia and to Europe from different coasts.
 */
function pickAnchor(
  candidates: AnchorCandidate[] | undefined,
  towards: LonLat,
): LonLat | null {
  if (!candidates || candidates.length === 0) return null
  let best: AnchorCandidate | null = null
  let bestScore = Infinity
  for (const candidate of candidates) {
    const score = distKm(candidate.pos, towards)
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best ? best.pos : null
}

function anchorFor(
  iso: string,
  commodity: string,
  direction: 'export' | 'import',
  towards: LonLat,
  index: AnchorIndex,
  countryCoords: Record<string, LonLat>,
): LonLat | null {
  const map =
    commodity === 'gas'
      ? direction === 'export' ? index.gasExport : index.gasImport
      : direction === 'export' ? index.oilExport : index.oilImport
  const fromIndex = pickAnchor(map.get(iso), towards)
  if (fromIndex) return fromIndex
  // Gas trade from a country with only oil terminals (and vice versa) still
  // leaves from its coast — reuse the other commodity's terminals next.
  const altMap =
    commodity === 'gas'
      ? direction === 'export' ? index.oilExport : index.oilImport
      : direction === 'export' ? index.gasExport : index.gasImport
  const fromAlt = pickAnchor(altMap.get(iso), towards)
  if (fromAlt) return fromAlt
  if (direction === 'export' && EXPORT_ANCHOR_OVERRIDES[iso]) return EXPORT_ANCHOR_OVERRIDES[iso]
  if (COASTAL_ANCHORS[iso]) return COASTAL_ANCHORS[iso]
  return countryCoords[iso] ?? null
}

function dedupe(points: LonLat[]): LonLat[] {
  const out: LonLat[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (!last || distKm(last, point) > 40) out.push(point)
  }
  return out.length >= 2 ? out : points
}

const STEP_KM = 200

function interpolate(anchors: LonLat[]): LonLat[] {
  const raw: LonLat[] = []
  for (let i = 0; i < anchors.length - 1; i += 1) {
    raw.push(...greatCircleLeg(anchors[i], anchors[i + 1], STEP_KM))
  }
  raw.push(anchors[anchors.length - 1])
  return unwrapLongitudes(raw)
}

function toDatum(flow: Flow, path: LonLat[]): FlowPathDatum {
  const cumulative: number[] = [0]
  for (let i = 1; i < path.length; i += 1) {
    cumulative.push(cumulative[i - 1] + distKm(path[i - 1], path[i]))
  }
  const total = cumulative[cumulative.length - 1] || 1
  return { flow, path, timestamps: cumulative.map(value => (value / total) * 1000) }
}

export function buildFlowPaths(
  flows: Flow[],
  countryCoords: Record<string, LonLat>,
  chokepoints: ChokepointBrief[],
  infras: Infrastructure[],
): FlowPathDatum[] {
  void chokepoints // chokepoint geometry lives in the sea graph itself
  const anchorIndex = buildAnchorIndex(infras)
  const pipelinesByName = new Map(
    infras.filter(i => i.type === 'pipeline' && i.geometry?.coordinates).map(i => [i.name, i]),
  )

  const result: FlowPathDatum[] = []

  for (const flow of flows) {
    const sourceCentroid = countryCoords[flow.source_iso]
    const targetCentroid = countryCoords[flow.target_iso]
    if (!sourceCentroid || !targetCentroid) continue

    // — Pipeline flows ride the traced pipeline
    if (flow.transport_mode === 'pipeline') {
      const pipeline = pipelinesByName.get(
        PIPELINE_BY_PAIR[`${flow.source_iso}>${flow.target_iso}>${flow.commodity}`] ?? '',
      )
      if (pipeline?.geometry?.coordinates) {
        let coords = pipeline.geometry.coordinates as LonLat[]
        // Geometry may be digitized in either direction
        if (distKm(coords[0], sourceCentroid) > distKm(coords[coords.length - 1], sourceCentroid)) {
          coords = [...coords].reverse()
        }
        result.push(toDatum(flow, interpolate(coords)))
        continue
      }
      // Unmapped overland link: direct great circle (kept visually thin)
      result.push(toDatum(flow, interpolate([sourceCentroid, targetCentroid])))
      continue
    }

    // — Seaborne flows: export terminal -> sea graph (via chokepoints) -> import port
    const src =
      anchorFor(flow.source_iso, flow.commodity, 'export', targetCentroid, anchorIndex, countryCoords) ??
      sourceCentroid
    const tgt =
      anchorFor(flow.target_iso, flow.commodity, 'import', src, anchorIndex, countryCoords) ??
      targetCentroid

    const viaNodes = (flow.via_chokepoints ?? [])
      .map(slug => CHOKEPOINT_NODE[slug])
      .filter((node): node is string => Boolean(node))

    const nodePath = seaRouteVia(nearestSeaNode(src), viaNodes, nearestSeaNode(tgt))
    const anchors = dedupe([src, ...(nodePath ?? []), tgt])
    result.push(toDatum(flow, interpolate(anchors)))
  }

  return result
}
