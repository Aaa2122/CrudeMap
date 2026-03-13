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
  animTime?: number  // 0-1 cycling value for pulse animation
}

export function FlowLayer({ flows, disrupted, countryCoords, onHover, onClick, globe, animTime = 0 }: Props) {
  const data = flows
    .map(f => {
      const src = countryCoords[f.source_iso]
      const tgt = countryCoords[f.target_iso]
      if (!src || !tgt) return null
      const isDisrupted = disrupted.has(f.id)
      // Distance factor for arc height (globe mode)
      const dx = tgt[0] - src[0]
      const dy = tgt[1] - src[1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      return {
        ...f,
        sourcePosition: src,
        targetPosition: tgt,
        isDisrupted,
        dist,
        __tooltip: `${f.source_iso} → ${f.target_iso}: ${f.volume_mt} Mt/yr`,
      }
    })
    .filter(Boolean)

  // Animated alpha pulse: each flow has a phase offset based on its id
  const pulseAlpha = (base: number, id: number) => {
    const phase = ((animTime + (id % 17) / 17) % 1) * Math.PI * 2
    const wave = Math.sin(phase) * 0.35 + 0.65  // oscillates 0.3 → 1.0
    return Math.round(base * wave)
  }

  if (globe) {
    // 3D globe: tall arcs that fly over the surface
    return new ArcLayer({
      id: 'flow-arcs-globe',
      data,
      getSourcePosition: (d: any) => d.sourcePosition,
      getTargetPosition: (d: any) => d.targetPosition,
      getSourceColor: (d: any) =>
        d.isDisrupted
          ? [239, 68, 68, pulseAlpha(230, d.id)]
          : [245, 158, 11, pulseAlpha(200, d.id)],
      getTargetColor: (d: any) =>
        d.isDisrupted
          ? [239, 68, 68, pulseAlpha(120, d.id)]
          : [245, 158, 11, pulseAlpha(100, d.id)],
      getHeight: (d: any) => Math.min(0.35, d.dist / 350),
      getWidth: (d: any) => Math.max(1, Math.log(d.volume_mt + 1) * 0.8),
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

  // 2D flat map: great circle geodesic curves (natural-looking on Mercator)
  return new GreatCircleLayer({
    id: 'flow-arcs-flat',
    data,
    getSourcePosition: (d: any) => d.sourcePosition,
    getTargetPosition: (d: any) => d.targetPosition,
    getSourceColor: (d: any) =>
      d.isDisrupted
        ? [239, 68, 68, pulseAlpha(210, d.id)]
        : [245, 158, 11, pulseAlpha(170, d.id)],
    getTargetColor: (d: any) =>
      d.isDisrupted
        ? [239, 68, 68, pulseAlpha(90, d.id)]
        : [245, 158, 11, pulseAlpha(70, d.id)],
    getWidth: (d: any) => Math.max(0.8, Math.log(d.volume_mt + 1) * 0.5),
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
