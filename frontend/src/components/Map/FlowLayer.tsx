import { PathLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import type { Commodity } from '../../api/types'
import type { FlowPathDatum } from './flowGeometry'

type RGBA = [number, number, number, number]

const OIL_BASE: RGBA = [220, 165, 74, 62] // restrained amber underlay
const OIL_HEAD: RGBA = [242, 206, 140, 220]
const GAS_BASE: RGBA = [70, 200, 220, 58] // restrained cyan underlay
const GAS_HEAD: RGBA = [159, 232, 242, 220]
const DISRUPTED_BASE: RGBA = [217, 84, 77, 88]
const DISRUPTED_HEAD: RGBA = [240, 130, 124, 225]

interface Props {
  flowPaths: FlowPathDatum[]
  disrupted: Set<number>
  commodity: Commodity
  animTime: number
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
export function FlowLayer({ flowPaths, disrupted, commodity, animTime, onHover, onClick }: Props) {
  const data = flowPaths.map(d => {
    const isDisrupted = disrupted.has(d.flow.id)
    const viaText = d.flow.via_chokepoints?.length
      ? `via ${d.flow.via_chokepoints.join(', ')}`
      : d.flow.transport_mode === 'pipeline'
      ? 'pipeline'
      : 'direct route'
    return {
      ...d,
      isDisrupted,
      width: 0.7 + Math.min(2.2, Math.log1p(volumeOf(d)) * 0.5),
      __tooltip: `${d.flow.source_iso} -> ${d.flow.target_iso}${isDisrupted ? ' — DISRUPTED' : ''}\n${formatVolume(d)} ${commodity}\n${viaText}`,
    }
  })

  const baseColor = commodity === 'gas' ? GAS_BASE : OIL_BASE
  const headColor = commodity === 'gas' ? GAS_HEAD : OIL_HEAD

  const routeLayer = new PathLayer({
    id: 'flow-routes',
    data,
    getPath: (d: any) => d.path,
    getColor: (d: any) => (d.isDisrupted ? DISRUPTED_BASE : baseColor),
    getWidth: (d: any) => d.width,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    jointRounded: true,
    capRounded: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 110],
    onHover,
    onClick,
    updateTriggers: {
      getColor: [disrupted.size, commodity],
    },
  })

  // Per-flow phase offset (id % 17) staggers departures; disrupted flows
  // freeze (currentTime pinned) to read as "stopped".
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
        getColor: isDisruptedGroup ? DISRUPTED_HEAD : headColor,
        getWidth: (d: any) => d.width + 0.8,
        widthUnits: 'pixels',
        widthMinPixels: 1.5,
        capRounded: true,
        jointRounded: true,
        fadeTrail: true,
        trailLength: 220,
        currentTime: isDisruptedGroup ? 700 : (animTime * LOOP) % LOOP,
        pickable: false,
      }),
  )

  return [routeLayer, ...particleLayers]
}
