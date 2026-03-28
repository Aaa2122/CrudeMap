import { ArcLayer } from '@deck.gl/layers'
import { GreatCircleLayer } from '@deck.gl/geo-layers'
import type { Flow } from '../../api/types'

interface Props {
  flows: Flow[]
  disrupted: Set<number>
  countryCoords: Record<string, [number, number]>
  onHover: (info: any) => void
  onClick: (info: any) => void
  globe?: boolean
  animTime?: number
}

export function FlowLayer({ flows, disrupted, countryCoords, onHover, onClick, globe, animTime = 0 }: Props) {
  const data = flows
    .map(flow => {
      const source = countryCoords[flow.source_iso]
      const target = countryCoords[flow.target_iso]
      if (!source || !target) return null

      const isDisrupted = disrupted.has(flow.id)
      const dx = target[0] - source[0]
      const dy = target[1] - source[1]
      const dist = Math.sqrt(dx * dx + dy * dy)

      return {
        ...flow,
        sourcePosition: source,
        targetPosition: target,
        isDisrupted,
        dist,
        __tooltip: `${flow.source_iso} -> ${flow.target_iso}\n${flow.volume_mt.toFixed(1)} Mt/yr`,
      }
    })
    .filter(Boolean)

  const pulseAlpha = (base: number, id: number) => {
    const phase = ((animTime + (id % 17) / 17) % 1) * Math.PI * 2
    const wave = Math.sin(phase) * 0.35 + 0.65
    return Math.round(base * wave)
  }

  if (globe) {
    return new ArcLayer({
      id: 'flow-arcs-globe',
      data,
      getSourcePosition: (point: any) => point.sourcePosition,
      getTargetPosition: (point: any) => point.targetPosition,
      getSourceColor: (point: any) =>
        point.isDisrupted
          ? [239, 68, 68, pulseAlpha(230, point.id)]
          : [245, 158, 11, pulseAlpha(200, point.id)],
      getTargetColor: (point: any) =>
        point.isDisrupted
          ? [239, 68, 68, pulseAlpha(120, point.id)]
          : [245, 158, 11, pulseAlpha(100, point.id)],
      getHeight: (point: any) => Math.min(0.35, point.dist / 350),
      getWidth: (point: any) => Math.max(1, Math.log(point.volume_mt + 1) * 0.8),
      greatCircle: true,
      numSegments: 50,
      widthScale: 1,
      widthUnits: 'pixels',
      pickable: true,
      onHover,
      onClick,
      updateTriggers: {
        getSourceColor: [disrupted.size, animTime],
        getTargetColor: [disrupted.size, animTime],
      },
    })
  }

  return new GreatCircleLayer({
    id: 'flow-arcs-flat',
    data,
    getSourcePosition: (point: any) => point.sourcePosition,
    getTargetPosition: (point: any) => point.targetPosition,
    getSourceColor: (point: any) =>
      point.isDisrupted
        ? [239, 68, 68, pulseAlpha(210, point.id)]
        : [245, 158, 11, pulseAlpha(170, point.id)],
    getTargetColor: (point: any) =>
      point.isDisrupted
        ? [239, 68, 68, pulseAlpha(90, point.id)]
        : [245, 158, 11, pulseAlpha(70, point.id)],
    getWidth: (point: any) => Math.max(0.8, Math.log(point.volume_mt + 1) * 0.5),
    widthScale: 1,
    widthUnits: 'pixels',
    pickable: true,
    onHover,
    onClick,
    updateTriggers: {
      getSourceColor: [disrupted.size, animTime],
      getTargetColor: [disrupted.size, animTime],
    },
  })
}
