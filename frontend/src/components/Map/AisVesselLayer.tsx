import { IconLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Commodity } from '../../api/types'
import { getIcon } from './iconAtlas'
import { globeParams, pointVisibleOnGlobe } from './globeCulling'
import { accentFor, withAlpha } from './mapTheme'
import { vesselDisplayState, type LiveVessel } from './aisVessel'

interface Props {
  vessels: Map<number, LiveVessel>
  commodity: Commodity
  nowMs: number
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
}

const TYPE_LABEL = 'Tanker (AIS)'

/** Real AIS tankers: live where visible, projected along their route when dark. */
export function AisVesselLayer({ vessels, commodity, nowMs, globe, cameraCenter, onHover }: Props) {
  const accent = accentFor(commodity)

  const data = [...vessels.values()]
    .map(v => {
      const d = vesselDisplayState(v, nowMs)
      const speed = `${v.sog.toFixed(1)} kn`
      const modeLabel = d.mode === 'live' ? 'live AIS' : d.mode === 'projected' ? 'projected · sim' : 'signal lost'
      const destLine = v.destName ? `→ ${v.destName}` : '→ destination unknown'
      return {
        ...v,
        ...d,
        __tooltip: `M/T ${v.name ?? v.mmsi} — ${TYPE_LABEL}\n${speed} · ${destLine}\n${modeLabel}`,
      }
    })
    .filter(d => d.opacity > 0.02)
    .filter(d => !globe || pointVisibleOnGlobe(d.position, cameraCenter))

  const hitLayer = new ScatterplotLayer({
    id: 'ais-hit',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 9,
    radiusUnits: 'pixels',
    getFillColor: [0, 0, 0, 1],
    stroked: false,
    pickable: true,
    onHover,
    parameters: globeParams(globe) as any,
    updateTriggers: { getPosition: [nowMs] },
  })

  // Faint wake for projected vessels (last known → current projected point)
  const wakeData = data.filter((d: any) => d.mode === 'projected')
  const wakeLayer = new PathLayer({
    id: 'ais-wake',
    data: wakeData,
    getPath: (d: any) => [[d.lon, d.lat], d.position],
    getColor: withAlpha(accent, 70),
    getWidth: 1,
    widthUnits: 'pixels',
    parameters: globeParams(globe) as any,
    updateTriggers: { getPath: [nowMs] },
  })

  const iconLayer = new IconLayer({
    id: 'ais-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: () => getIcon('vessel'),
    getSize: (d: any) => (d.type ? 12 : 11),
    getColor: (d: any) => withAlpha(accent, Math.round(d.opacity * 240)),
    getAngle: (d: any) => -d.bearing,
    sizeUnits: 'pixels',
    billboard: false,
    pickable: true,
    onHover,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getPosition: [nowMs],
      getAngle: [nowMs],
      getColor: [nowMs, commodity],
    },
  })

  // Small "live" ring on genuinely-live vessels
  const liveRing = new ScatterplotLayer({
    id: 'ais-live-ring',
    data: data.filter((d: any) => d.mode === 'live'),
    getPosition: (d: any) => d.position,
    getRadius: 7,
    radiusUnits: 'pixels',
    stroked: true,
    filled: false,
    getLineColor: withAlpha(accent, 150),
    getLineWidth: 1.2,
    lineWidthUnits: 'pixels',
    pickable: false,
    parameters: globeParams(globe) as any,
    updateTriggers: { getPosition: [nowMs] },
  })

  return [wakeLayer, hitLayer, liveRing, iconLayer]
}
