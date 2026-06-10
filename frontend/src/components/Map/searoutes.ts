/**
 * Curated maritime routing graph.
 *
 * Nodes are open-sea waypoints (straits, capes, basin midpoints) placed so
 * that edges never cross land at world zoom. Flows are routed port-to-port
 * with Dijkstra over this graph; legs through the same corridors overlap,
 * so real shipping lanes emerge visually from the data.
 */

type LonLat = [number, number]

export const SEA_NODES: Record<string, LonLat> = {
  // — North Atlantic / NW Europe
  north_sea: [3.5, 55.2],
  dover: [1.4, 50.9],
  channel_w: [-5.5, 49.2],
  biscay: [-8.5, 45.0],
  finisterre: [-10.5, 43.2],
  lisbon_w: [-10.5, 38.0],
  gibraltar_w: [-7.5, 35.8],
  mid_atl_n: [-38.0, 43.0],
  nyc_app: [-71.0, 40.2],
  chesapeake: [-73.5, 36.0],
  florida: [-79.3, 27.5],
  gom: [-91.0, 26.0],
  yucatan: [-86.5, 21.8],
  caribbean: [-75.0, 14.5],
  panama_atl: [-79.4, 9.6],
  skagerrak: [8.0, 57.8],
  baltic_w: [12.5, 55.3],
  baltic_e: [21.0, 58.5],
  norwegian_sea: [3.0, 62.0],
  norway_n: [16.0, 70.0],
  barents: [40.0, 71.5],
  kara: [68.0, 73.5],

  // — South Atlantic / Africa
  canary: [-16.5, 27.0],
  cape_verde: [-24.0, 15.5],
  gulf_guinea: [2.0, 2.5],
  angola_off: [8.5, -10.0],
  cape: [17.5, -35.6],
  mid_atl_s: [-18.0, -12.0],
  brazil_ne: [-33.5, -5.5],
  brazil_se: [-39.5, -24.0],
  rio_plata: [-52.5, -36.5],

  // — Mediterranean / Black Sea
  alboran: [-2.5, 36.2],
  algiers_n: [4.5, 38.0],
  sardinia_s: [9.0, 38.3],
  sicily: [11.8, 37.0],
  adriatic: [18.7, 40.8],
  ionian: [18.0, 36.5],
  crete_s: [24.5, 34.2],
  aegean: [25.5, 38.3],
  bosphorus: [29.1, 41.2],
  black_sea: [33.5, 43.3],
  port_said: [32.35, 31.6],

  // — Suez / Red Sea / Gulf
  suez: [32.55, 29.9],
  red_sea: [38.3, 21.5],
  bab: [43.4, 12.55],
  aden: [49.0, 13.0],
  socotra: [55.5, 13.5],
  hormuz: [56.5, 26.3],
  gulf_inner: [51.3, 27.2],
  oman_sea: [61.0, 23.5],

  // — Indian Ocean
  arabian_sea: [66.0, 14.0],
  india_w: [72.5, 8.0],
  ceylon: [80.7, 5.5],
  bengal: [87.5, 15.5],
  andaman: [94.5, 8.0],
  mid_indian: [78.0, -10.0],
  mozambique: [41.0, -18.0],
  madagascar_s: [47.0, -28.5],

  // — Southeast Asia / West Pacific
  malacca_nw: [97.0, 6.5],
  malacca: [100.8, 2.9],
  singapore: [104.3, 1.2],
  natuna: [108.5, 4.5],
  vietnam_s: [110.0, 9.0],
  scs: [113.5, 15.5],
  hk_s: [114.8, 21.0],
  taiwan_strait: [119.6, 24.2],
  ecs: [123.8, 28.8],
  korea_strait: [128.7, 33.6],
  yellow_sea: [123.0, 37.0],
  tokyo_s: [139.8, 34.2],
  japan_e: [143.5, 36.5],
  sunda: [105.9, -6.4],
  java_s: [110.0, -9.5],
  lombok: [116.0, -9.4],
  makassar: [118.6, -1.5],
  arafura: [133.0, -9.8],
  nw_australia: [115.0, -18.5],
  coral: [153.5, -19.0],
  tasman_n: [154.5, -30.5],

  // — Pacific crossings / Americas West
  pac_nw: [162.0, 41.0],
  pac_n: [180.0, 46.0],
  pac_ne: [-160.0, 49.0],
  pnw: [-126.5, 46.5],
  california: [-123.5, 37.0],
  socal: [-119.5, 32.8],
  mex_pac: [-107.0, 18.5],
  panama_pac: [-79.8, 6.8],
  peru_off: [-79.0, -10.5],
  chile_off: [-73.5, -31.0],
}

const E: [string, string][] = [
  // NW Europe / Baltic / Norway
  ['north_sea', 'dover'], ['dover', 'channel_w'], ['channel_w', 'biscay'],
  ['biscay', 'finisterre'], ['finisterre', 'lisbon_w'], ['lisbon_w', 'gibraltar_w'],
  ['north_sea', 'skagerrak'], ['skagerrak', 'baltic_w'], ['baltic_w', 'baltic_e'],
  ['north_sea', 'norwegian_sea'], ['norwegian_sea', 'norway_n'], ['norway_n', 'barents'],
  ['barents', 'kara'],
  // North Atlantic
  ['channel_w', 'mid_atl_n'], ['finisterre', 'mid_atl_n'], ['mid_atl_n', 'nyc_app'],
  ['nyc_app', 'chesapeake'], ['chesapeake', 'florida'], ['florida', 'gom'],
  ['florida', 'yucatan'], ['yucatan', 'gom'], ['yucatan', 'caribbean'],
  ['caribbean', 'panama_atl'], ['florida', 'caribbean'],
  // Atlantic S
  ['lisbon_w', 'canary'], ['gibraltar_w', 'canary'], ['canary', 'cape_verde'],
  ['cape_verde', 'gulf_guinea'], ['gulf_guinea', 'angola_off'], ['angola_off', 'cape'],
  ['cape_verde', 'brazil_ne'], ['brazil_ne', 'brazil_se'], ['brazil_se', 'rio_plata'],
  ['cape_verde', 'mid_atl_s'], ['mid_atl_s', 'brazil_se'], ['mid_atl_s', 'cape'],
  ['caribbean', 'brazil_ne'],
  // Med / Black Sea
  ['gibraltar_w', 'alboran'], ['alboran', 'algiers_n'], ['algiers_n', 'sardinia_s'],
  ['sardinia_s', 'sicily'], ['sicily', 'ionian'], ['ionian', 'crete_s'],
  ['crete_s', 'port_said'], ['ionian', 'adriatic'], ['crete_s', 'aegean'],
  ['aegean', 'bosphorus'], ['bosphorus', 'black_sea'], ['algiers_n', 'sicily'],
  // Suez / Red Sea / Gulf
  ['port_said', 'suez'], ['suez', 'red_sea'], ['red_sea', 'bab'], ['bab', 'aden'],
  ['aden', 'socotra'], ['socotra', 'arabian_sea'], ['socotra', 'oman_sea'],
  ['oman_sea', 'hormuz'], ['hormuz', 'gulf_inner'], ['socotra', 'mid_indian'],
  // Indian Ocean
  ['oman_sea', 'arabian_sea'], ['arabian_sea', 'india_w'], ['india_w', 'ceylon'],
  ['ceylon', 'bengal'], ['bengal', 'andaman'], ['ceylon', 'andaman'],
  ['andaman', 'malacca_nw'], ['ceylon', 'mid_indian'], ['mid_indian', 'madagascar_s'],
  ['madagascar_s', 'cape'], ['mozambique', 'madagascar_s'], ['mozambique', 'aden'],
  ['mid_indian', 'sunda'], ['mid_indian', 'nw_australia'],
  // SE Asia / E Asia
  ['malacca_nw', 'malacca'], ['malacca', 'singapore'], ['singapore', 'natuna'],
  ['natuna', 'vietnam_s'], ['vietnam_s', 'scs'], ['scs', 'hk_s'],
  ['hk_s', 'taiwan_strait'], ['taiwan_strait', 'ecs'], ['ecs', 'korea_strait'],
  ['ecs', 'yellow_sea'], ['korea_strait', 'tokyo_s'], ['tokyo_s', 'japan_e'],
  ['singapore', 'sunda'], ['sunda', 'java_s'], ['java_s', 'lombok'],
  ['lombok', 'makassar'], ['makassar', 'scs'], ['lombok', 'nw_australia'],
  ['makassar', 'arafura'], ['arafura', 'coral'], ['coral', 'tasman_n'],
  ['nw_australia', 'arafura'],
  // Pacific
  ['japan_e', 'pac_nw'], ['pac_nw', 'pac_n'], ['pac_n', 'pac_ne'],
  ['pac_ne', 'pnw'], ['pac_ne', 'california'], ['pnw', 'california'],
  ['california', 'socal'], ['socal', 'mex_pac'], ['mex_pac', 'panama_pac'],
  ['panama_pac', 'panama_atl'], ['panama_pac', 'peru_off'], ['peru_off', 'chile_off'],
]

const RAD = Math.PI / 180

function distKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLon = (b[0] - a[0]) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

const ADJACENCY: Record<string, { node: string; weight: number }[]> = {}
for (const name of Object.keys(SEA_NODES)) ADJACENCY[name] = []
for (const [a, b] of E) {
  const weight = distKm(SEA_NODES[a], SEA_NODES[b])
  ADJACENCY[a].push({ node: b, weight })
  ADJACENCY[b].push({ node: a, weight })
}

/** Chokepoint slug (seed data) -> graph node. */
export const CHOKEPOINT_NODE: Record<string, string> = {
  hormuz: 'hormuz',
  malacca: 'malacca',
  suez: 'suez',
  sumed: 'suez',
  bab_el_mandeb: 'bab',
  turkish_straits: 'bosphorus',
  panama: 'panama_atl',
  danish_straits: 'baltic_w',
  cape_of_good_hope: 'cape',
  gibraltar: 'gibraltar_w',
}

export function nearestSeaNode(point: LonLat): string {
  let best = ''
  let bestDist = Infinity
  for (const [name, coord] of Object.entries(SEA_NODES)) {
    const d = distKm(point, coord)
    if (d < bestDist) {
      bestDist = d
      best = name
    }
  }
  return best
}

const pathCache = new Map<string, string[] | null>()

/** Dijkstra shortest node path (inclusive of endpoints). */
export function seaRoute(from: string, to: string): string[] | null {
  if (from === to) return [from]
  const key = `${from}>${to}`
  if (pathCache.has(key)) return pathCache.get(key)!

  const dist: Record<string, number> = { [from]: 0 }
  const prev: Record<string, string> = {}
  const visited = new Set<string>()
  const queue: { node: string; d: number }[] = [{ node: from, d: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d)
    const { node } = queue.shift()!
    if (node === to) break
    if (visited.has(node)) continue
    visited.add(node)
    for (const { node: next, weight } of ADJACENCY[node] ?? []) {
      const nd = dist[node] + weight
      if (nd < (dist[next] ?? Infinity)) {
        dist[next] = nd
        prev[next] = node
        queue.push({ node: next, d: nd })
      }
    }
  }

  if (!(to in dist)) {
    pathCache.set(key, null)
    return null
  }
  const path: string[] = [to]
  while (path[0] !== from) path.unshift(prev[path[0]])
  pathCache.set(key, path)
  return path
}

/**
 * Route through an ordered list of must-pass nodes (the flow's chokepoints),
 * concatenating Dijkstra legs. Returns sea node coordinates.
 */
export function seaRouteVia(fromNode: string, viaNodes: string[], toNode: string): LonLat[] | null {
  const stops = [fromNode, ...viaNodes, toNode]
  const out: string[] = []
  for (let i = 0; i < stops.length - 1; i += 1) {
    const leg = seaRoute(stops[i], stops[i + 1])
    if (!leg) return null
    out.push(...(i === 0 ? leg : leg.slice(1)))
  }
  return out.map(name => SEA_NODES[name])
}
