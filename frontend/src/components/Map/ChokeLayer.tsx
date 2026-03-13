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
    .filter(c => c.lat && c.lon)
    .map(c => ({
      ...c,
      position: [c.lon!, c.lat!] as [number, number],
      color: RISK_COLOR[c.risk_level] ?? RISK_COLOR.medium,
      radius: Math.max(60000, c.oil_transit_mbd * 25000),
      __tooltip: `${c.name}\n${c.oil_transit_mbd} Mb/d (${c.pct_world_trade}% world trade)`,
    }))

  const haloLayer = new ScatterplotLayer({
    id: 'choke-halo',
    data,
    getPosition: (d: any) => d.position,
    getRadius: (d: any) => d.radius * 1.8,
    getFillColor: (d: any) => [...d.color.slice(0, 3), 30] as [number, number, number, number],
    stroked: false,
    pickable: false,
  })

  const dotLayer = new ScatterplotLayer({
    id: 'choke-dots',
    data,
    getPosition: (d: any) => d.position,
    getRadius: (d: any) => d.radius,
    getFillColor: (d: any) => d.color,
    stroked: true,
    getLineColor: [255, 255, 255, 60],
    lineWidthMinPixels: 1,
    pickable: true,
    onHover,
    onClick,
  })

  return [haloLayer, dotLayer]
}
