import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { ChokepointBrief } from '../../api/types'

const RISK_COLOR: Record<string, [number, number, number, number]> = {
  critical: [239, 68, 68, 220],
  high: [249, 115, 22, 200],
  medium: [234, 179, 8, 180],
  low: [34, 197, 94, 160],
}

interface Props {
  chokepoints: ChokepointBrief[]
  onHover: (info: any) => void
  onClick: (info: any) => void
}

export function ChokeLayer({ chokepoints, onHover, onClick }: Props) {
  const data = chokepoints
    .filter(chokepoint => chokepoint.lat && chokepoint.lon)
    .map(chokepoint => ({
      ...chokepoint,
      position: [chokepoint.lon!, chokepoint.lat!] as [number, number],
      color: RISK_COLOR[chokepoint.risk_level] ?? RISK_COLOR.medium,
      radius: Math.max(60000, chokepoint.oil_transit_mbd * 25000),
      emoji: '⚓',
      __tooltip: `⚓ ${chokepoint.name}\n${chokepoint.oil_transit_mbd} Mb/d\n${chokepoint.pct_world_trade}% of world trade`,
    }))

  const haloLayer = new ScatterplotLayer({
    id: 'choke-halo',
    data,
    getPosition: (point: any) => point.position,
    getRadius: (point: any) => point.radius * 1.9,
    getFillColor: (point: any) => [...point.color.slice(0, 3), 30] as [number, number, number, number],
    stroked: false,
    pickable: false,
  })

  const hitLayer = new ScatterplotLayer({
    id: 'choke-hit',
    data,
    getPosition: (point: any) => point.position,
    getRadius: (point: any) => point.radius * 1.15,
    getFillColor: [8, 12, 18, 1],
    stroked: false,
    pickable: true,
    onHover,
    onClick,
  })

  const emojiLayer = new TextLayer({
    id: 'choke-emoji',
    data,
    getPosition: (point: any) => point.position,
    getText: (point: any) => point.emoji,
    getSize: 22,
    sizeUnits: 'pixels',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getColor: [255, 255, 255, 255],
    background: true,
    getBackgroundColor: (point: any) => [...point.color.slice(0, 3), 175] as [number, number, number, number],
    getBorderColor: [255, 255, 255, 65],
    getBorderWidth: 1,
    getBackgroundPadding: [6, 4],
    billboard: true,
    pickable: false,
  })

  const labelLayer = new TextLayer({
    id: 'choke-labels',
    data,
    getPosition: (point: any) => point.position,
    getText: (point: any) => point.name,
    getSize: 12,
    sizeUnits: 'pixels',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top',
    getPixelOffset: [0, 18],
    getColor: [229, 238, 245, 230],
    background: true,
    getBackgroundColor: [8, 14, 20, 185],
    getBorderColor: [255, 255, 255, 25],
    getBorderWidth: 1,
    getBackgroundPadding: [6, 3],
    billboard: true,
    pickable: false,
  })

  return [haloLayer, hitLayer, emojiLayer, labelLayer]
}
