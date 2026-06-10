import { IconLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { ChokepointBrief } from '../../api/types'
import { getIcon } from './iconAtlas'
import { globeParams, pointVisibleOnGlobe } from './globeCulling'

type RGBA = [number, number, number, number]

const RISK_COLOR: Record<string, RGBA> = {
  critical: [217, 84, 77, 235],
  high: [216, 140, 74, 222],
  medium: [203, 174, 90, 205],
  low: [96, 138, 162, 182],
}

interface Props {
  chokepoints: ChokepointBrief[]
  disruptedSlugs: Set<string>
  animTime: number
  showLabels: boolean
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
  onClick: (info: any) => void
}

/**
 * Maritime chokepoints: halo sized by transit volume, warning-diamond icon,
 * plus an animated pulsing ring on critical/disrupted straits.
 */
export function ChokeLayer({ chokepoints, disruptedSlugs, animTime, showLabels, globe, cameraCenter, onHover, onClick }: Props) {
  const data = chokepoints
    .filter(chokepoint => chokepoint.lat != null && chokepoint.lon != null)
    .filter(chokepoint => !globe || pointVisibleOnGlobe([chokepoint.lon!, chokepoint.lat!], cameraCenter))
    .map(chokepoint => {
      const isDisrupted = disruptedSlugs.has(chokepoint.slug)
      return {
        ...chokepoint,
        position: [chokepoint.lon!, chokepoint.lat!] as [number, number],
        color: isDisrupted ? RISK_COLOR.critical : RISK_COLOR[chokepoint.risk_level] ?? RISK_COLOR.medium,
        radius: Math.max(60000, chokepoint.oil_transit_mbd * 22000),
        isDisrupted,
        pulses: isDisrupted || chokepoint.risk_level === 'critical',
        __tooltip: `${chokepoint.name}${isDisrupted ? ' — DISRUPTED' : ''}\n${chokepoint.oil_transit_mbd} Mb/d transit\n${chokepoint.pct_world_trade}% of world oil trade`,
      }
    })

  const haloLayer = new ScatterplotLayer({
    id: 'choke-halo',
    data,
    getPosition: (d: any) => d.position,
    getRadius: (d: any) => d.radius * 1.9,
    getFillColor: (d: any) => [d.color[0], d.color[1], d.color[2], 28] as RGBA,
    stroked: false,
    pickable: false,
    parameters: globeParams(globe) as any,
  })

  // Expanding ring on critical or scenario-disrupted chokepoints (3s pulse
  // derived from the 60s shared clock)
  const pulse = (animTime * 20) % 1
  const pulseLayer = new ScatterplotLayer({
    id: 'choke-pulse',
    data: data.filter((d: any) => d.pulses),
    getPosition: (d: any) => d.position,
    getRadius: (d: any) => d.radius * (1.1 + pulse * 1.6),
    getLineColor: (d: any) => [d.color[0], d.color[1], d.color[2], Math.round(170 * (1 - pulse))] as RGBA,
    getFillColor: [0, 0, 0, 0],
    stroked: true,
    filled: false,
    getLineWidth: 1.6,
    lineWidthUnits: 'pixels',
    pickable: false,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getRadius: [pulse],
      getLineColor: [pulse],
    },
  })

  const iconLayer = new IconLayer({
    id: 'choke-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: () => getIcon('chokepoint'),
    getSize: (d: any) => (d.risk_level === 'critical' ? 24 : 19),
    getColor: (d: any) => d.color,
    sizeUnits: 'pixels',
    billboard: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 90],
    onHover,
    onClick,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getColor: [disruptedSlugs.size],
    },
  })

  const layers: any[] = [haloLayer, pulseLayer, iconLayer]

  if (showLabels) {
    layers.push(
      new TextLayer({
        id: 'choke-labels',
        data,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.name,
        getSize: 11.5,
        sizeUnits: 'pixels',
        fontFamily: 'Archivo, sans-serif',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'top',
        getPixelOffset: [0, 16],
        getColor: [229, 238, 245, 240],
        outlineWidth: 2,
        outlineColor: [10, 16, 24, 235],
        fontSettings: { sdf: true },
        characterSet: 'auto',
        billboard: true,
        pickable: false,
        parameters: globeParams(globe) as any,
      }),
    )
  }

  return layers
}
