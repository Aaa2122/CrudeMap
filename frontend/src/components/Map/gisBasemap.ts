import { PathLayer, SolidPolygonLayer } from '@deck.gl/layers'

/**
 * Fully self-rendered GIS ground — no external tiles, no OSM/CARTO.
 * Ocean is a gridded polygon sheet (gridded so it tessellates correctly on
 * the globe), the graticule a faint set of meridians/parallels. Land is
 * drawn by the choropleth layer on top.
 */

type LonLat = [number, number]

const OCEAN_COLOR: [number, number, number, number] = [6, 14, 24, 255]
const GRATICULE_COLOR: [number, number, number, number] = [112, 150, 182, 16]
const GRATICULE_STEP = 30 // degrees between lines
const SAMPLE_STEP = 5 // degrees between vertices (keeps lines curved on globe)

// 15° x 15° ocean cells — small quads project cleanly onto the globe sphere
const OCEAN_CELLS: LonLat[][] = (() => {
  const cells: LonLat[][] = []
  const STEP = 15
  for (let lon = -180; lon < 180; lon += STEP) {
    for (let lat = -90; lat < 90; lat += STEP) {
      cells.push([
        [lon, lat],
        [lon + STEP, lat],
        [lon + STEP, lat + STEP],
        [lon, lat + STEP],
      ])
    }
  }
  return cells
})()

const GRATICULE_PATHS: LonLat[][] = (() => {
  const paths: LonLat[][] = []
  // Meridians
  for (let lon = -180; lon <= 180; lon += GRATICULE_STEP) {
    const path: LonLat[] = []
    for (let lat = -85; lat <= 85; lat += SAMPLE_STEP) path.push([lon, lat])
    paths.push(path)
  }
  // Parallels (skip poles)
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP) {
    const path: LonLat[] = []
    for (let lon = -180; lon <= 180; lon += SAMPLE_STEP) path.push([lon, lat])
    paths.push(path)
  }
  return paths
})()

export function OceanLayer() {
  return new SolidPolygonLayer({
    id: 'gis-ocean',
    data: OCEAN_CELLS,
    getPolygon: (d: LonLat[]) => d,
    getFillColor: OCEAN_COLOR,
    pickable: false,
    // Never occlude land: coarse country polygons sag below the sphere
    // surface in GlobeView and would be hidden by the densely-gridded ocean.
    parameters: { depthWriteEnabled: false, depthCompare: 'always' } as any,
  })
}

export function GraticuleLayer() {
  return new PathLayer({
    id: 'gis-graticule',
    data: GRATICULE_PATHS,
    getPath: (d: LonLat[]) => d,
    getColor: GRATICULE_COLOR,
    getWidth: 0.6,
    widthUnits: 'pixels',
    pickable: false,
  })
}
