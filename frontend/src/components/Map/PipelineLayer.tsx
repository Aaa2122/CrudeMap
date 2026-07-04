import { PathLayer } from '@deck.gl/layers'
import { PathStyleExtension } from '@deck.gl/extensions'
import type { Infrastructure } from '../../api/types'
import { globeParams, pathVisibleOnGlobe } from './globeCulling'
import { HIGHLIGHT, NEUTRAL_MARK, NEUTRAL_MARK_DIM, SELECTED, withAlpha, type RGBA } from './mapTheme'

interface Props {
  pipelines: Infrastructure[]
  selectedId: number | null
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
  onClick: (info: any) => void
}

// Pipelines are ground infrastructure: neutral steel traces. Commodity is
// encoded by line style (gas dashed / oil+products solid), not by hue.
function pipelineColor(p: Infrastructure): RGBA {
  if (p.status === 'offline') return withAlpha(NEUTRAL_MARK_DIM, 140)
  return withAlpha(NEUTRAL_MARK, 185)
}

function formatCapacity(p: Infrastructure): string {
  if (p.capacity_bcm) return `${p.capacity_bcm.toFixed(0)} bcm/yr`
  if (p.capacity_mt) return `${p.capacity_mt.toFixed(0)} Mt/yr`
  return 'n/a'
}

/** Pipelines as neutral hairline traces; gas dashed, offline dimmed. */
export function PipelineLayer({ pipelines, selectedId, globe, cameraCenter, onHover, onClick }: Props) {
  const data = pipelines
    .filter(p => p.geometry?.coordinates && p.geometry.coordinates.length >= 2)
    .filter(p => !globe || pathVisibleOnGlobe(p.geometry!.coordinates, cameraCenter))
    .map(p => ({
      ...p,
      path: p.geometry!.coordinates,
      width: 0.8 + Math.min(1.6, Math.log1p(p.capacity_bcm ?? p.capacity_mt ?? 0) * 0.3),
      color: pipelineColor(p),
      // Dashes are unreliable under GlobeView — render solid there
      dashed: !globe && (p.commodity === 'gas' || p.status === 'offline'),
      __tooltip: `${p.name}${p.status !== 'active' ? ` — ${p.status.toUpperCase()}` : ''}\n${p.commodity === 'gas' ? 'Gas pipeline' : p.commodity === 'products' ? 'Products pipeline' : 'Crude pipeline'} — ${formatCapacity(p)}\n${p.operator ?? ''}`,
    }))

  const lineLayer = new PathLayer({
    id: 'pipeline-lines',
    data,
    getPath: (d: any) => d.path,
    getColor: (d: any) => (d.id === selectedId ? SELECTED : d.color),
    getWidth: (d: any) => (d.id === selectedId ? d.width + 1 : d.width),
    widthUnits: 'pixels',
    jointRounded: true,
    capRounded: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT,
    onHover,
    onClick,
    getDashArray: (d: any) => (d.dashed ? [5, 4] : [0, 0]),
    extensions: [new PathStyleExtension({ dash: true })],
    dashJustified: true,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getColor: [selectedId],
      getWidth: [selectedId],
      getDashArray: [globe],
    },
  } as any)

  return [lineLayer]
}
