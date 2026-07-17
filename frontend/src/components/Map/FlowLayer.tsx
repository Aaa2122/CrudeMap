import { PathLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import type { Commodity } from '../../api/types'
import type { FlowPathDatum } from './flowGeometry'
import { globeParams, pathVisibleOnGlobe } from './globeCulling'
import { ALERT, HIGHLIGHT, accentFor, flowWidth, withAlpha } from './mapTheme'

interface Props {
  flowPaths: FlowPathDatum[]
  disrupted: Set<number>
  commodity: Commodity
  animTime: number
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
  onClick: (info: any) => void
}

function volumeOf(d: FlowPathDatum): number {
  return d.flow.commodity === 'gas' ? d.flow.volume_bcm ?? 0 : d.flow.volume_mt
}

function formatVolume(d: FlowPathDatum): string {
  return d.flow.commodity === 'gas'
    ? `${(d.flow.volume_bcm ?? 0).toFixed(1)} bcm/yr`
    : `${d.flow.volume_mt.toFixed(1)} Mt/yr`
}

/**
 * Trade flows as chokepoint-routed paths: a static underlay shows the full
 * route, and TripsLayer particles run source -> target so direction is
 * readable at a glance. Disrupted flows turn red with frozen particles.
 */
export function FlowLayer({ flowPaths, disrupted, commodity, animTime, globe, cameraCenter, onHover, onClick }: Props) {
  const visiblePaths = globe
    ? flowPaths.filter(d => pathVisibleOnGlobe(d.path, cameraCenter))
    : flowPaths
  const data = visiblePaths.map(d => {
    const isDisrupted = disrupted.has(d.flow.id)
    const viaText = d.flow.via_chokepoints?.length
      ? `via ${d.flow.via_chokepoints.join(', ')}`
      : d.flow.transport_mode === 'pipeline'
      ? 'pipeline'
      : d.flow.transport_mode === 'unspecified'
      ? 'mode not reported · illustrative route'
      : 'direct route'
    const vintage = d.flow.period || String(d.flow.year)
    const quality = [d.flow.source, vintage, d.flow.confidence].filter(Boolean).join(' · ')
    const partial = d.flow.is_partial ? ' · partial/annualized' : ''
    return {
      ...d,
      isDisrupted,
      width: flowWidth(volumeOf(d)),
      __tooltip: `${d.flow.source_iso} -> ${d.flow.target_iso}${isDisrupted ? ' — DISRUPTED' : ''}\n${formatVolume(d)} ${commodity}\n${viaText}\n${quality}${partial}`,
    }
  })

  const accent = accentFor(commodity)
  const baseColor = withAlpha(accent, 46) // static underlay: barely-there
  const headColor = withAlpha(accent, 200) // particle heads

  const routeLayer = new PathLayer({
    id: 'flow-routes',
    data,
    getPath: (d: any) => d.path,
    getColor: (d: any) => (d.isDisrupted ? withAlpha(ALERT, 90) : baseColor),
    getWidth: (d: any) => d.width,
    widthUnits: 'pixels',
    widthMinPixels: 0.5,
    jointRounded: true,
    capRounded: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT,
    onHover,
    onClick,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getColor: [disrupted.size, commodity],
    },
  })

  // Per-flow phase offset (id % 17) staggers departures; disrupted flows
  // freeze (currentTime pinned) to read as "stopped".
  // The shared clock cycles in 60s; particles run 4 cycles per clock cycle
  // (integer multiple so the wrap stays continuous).
  const particleClock = (animTime * 4) % 1
  const LOOP = 2000
  const particleLayers = [false, true].map(
    isDisruptedGroup =>
      new TripsLayer({
        id: isDisruptedGroup ? 'flow-particles-disrupted' : 'flow-particles',
        data: data.filter((d: any) => d.isDisrupted === isDisruptedGroup),
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => {
          const offset = ((d.flow.id % 17) / 17) * 1000
          return d.timestamps.map((t: number) => t + offset)
        },
        getColor: isDisruptedGroup ? withAlpha(ALERT, 210) : headColor,
        getWidth: (d: any) => d.width + 0.4,
        widthUnits: 'pixels',
        widthMinPixels: 1,
        capRounded: true,
        jointRounded: true,
        fadeTrail: true,
        trailLength: 140,
        currentTime: isDisruptedGroup ? 700 : particleClock * LOOP,
        pickable: false,
        parameters: globeParams(globe) as any,
      }),
  )

  return [routeLayer, ...particleLayers]
}
