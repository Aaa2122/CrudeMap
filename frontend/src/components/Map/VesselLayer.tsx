import { IconLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Commodity } from '../../api/types'
import { getIcon } from './iconAtlas'
import { globeParams, pointVisibleOnGlobe } from './globeCulling'
import { vesselPosition, type Vessel } from './vesselFleet'
import { ALERT, HIGHLIGHT, accentFor, withAlpha } from './mapTheme'

interface Props {
  vessels: Vessel[]
  commodity: Commodity
  clock: number
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
}

const CLASS_SIZE: Record<string, number> = {
  VLCC: 11,
  Suezmax: 10,
  Aframax: 9,
  'Q-Flex LNG carrier': 10,
  'LNG carrier': 9,
}

/** Simulated live fleet: vessels sailing along the routed flows. */
export function VesselLayer({ vessels, commodity, clock, globe, cameraCenter, onHover }: Props) {
  const baseColor = withAlpha(accentFor(commodity), 150) // simulated = ghosted vs live AIS

  const data = vessels
    .map(vessel => {
      const { position, bearing, progress } = vesselPosition(vessel, clock)
      return {
        ...vessel,
        position,
        bearing,
        __tooltip: `M/T ${vessel.name} — ${vessel.vclass}${vessel.isDisrupted ? ' — HOLDING' : ''}\n${vessel.dwt} · ${vessel.cargo}\n${vessel.flow.flow.source_iso} → ${vessel.flow.flow.target_iso} · ${Math.round(progress * 100)}% of voyage`,
      }
    })
    .filter(d => !globe || pointVisibleOnGlobe(d.position, cameraCenter))

  // Generous invisible hit area (the hull glyph is small and rotated)
  const hitLayer = new ScatterplotLayer({
    id: 'vessel-hit',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 9,
    radiusUnits: 'pixels',
    getFillColor: [0, 0, 0, 1],
    stroked: false,
    pickable: true,
    onHover,
    parameters: globeParams(globe) as any,
    updateTriggers: { getPosition: [clock] },
  })

  const iconLayer = new IconLayer({
    id: 'vessel-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: () => getIcon('vessel'),
    getSize: (d: any) => CLASS_SIZE[d.vclass] ?? 8,
    getColor: (d: any) => (d.isDisrupted ? withAlpha(ALERT, 235) : baseColor),
    getAngle: (d: any) => -d.bearing,
    sizeUnits: 'pixels',
    billboard: false,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT,
    onHover,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getPosition: [clock],
      getAngle: [clock],
      getColor: [commodity],
    },
  })

  return [hitLayer, iconLayer]
}
