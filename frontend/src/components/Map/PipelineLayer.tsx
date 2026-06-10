import { PathLayer } from '@deck.gl/layers'
import { PathStyleExtension } from '@deck.gl/extensions'
import type { Infrastructure } from '../../api/types'
import { globeParams, pathVisibleOnGlobe } from './globeCulling'

type RGBA = [number, number, number, number]

const OIL_COLOR: RGBA = [16, 185, 129, 225] // emerald, solid
const GAS_COLOR: RGBA = [34, 211, 238, 215] // cyan, dashed
const PRODUCTS_COLOR: RGBA = [192, 132, 252, 210] // violet, solid
const OFFLINE_COLOR: RGBA = [100, 116, 139, 170] // grey, dashed

interface Props {
  pipelines: Infrastructure[]
  selectedId: number | null
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
  onClick: (info: any) => void
}

function pipelineColor(p: Infrastructure): RGBA {
  if (p.status === 'offline') return OFFLINE_COLOR
  if (p.commodity === 'gas') return GAS_COLOR
  if (p.commodity === 'products') return PRODUCTS_COLOR
  return OIL_COLOR
}

function formatCapacity(p: Infrastructure): string {
  if (p.capacity_bcm) return `${p.capacity_bcm.toFixed(0)} bcm/yr`
  if (p.capacity_mt) return `${p.capacity_mt.toFixed(0)} Mt/yr`
  return 'n/a'
}

/** Pipelines as real geographic traces; gas dashed, offline greyed out. */
export function PipelineLayer({ pipelines, selectedId, globe, cameraCenter, onHover, onClick }: Props) {
  const data = pipelines
    .filter(p => p.geometry?.coordinates && p.geometry.coordinates.length >= 2)
    .filter(p => !globe || pathVisibleOnGlobe(p.geometry!.coordinates, cameraCenter))
    .map(p => ({
      ...p,
      path: p.geometry!.coordinates,
      width: 1.5 + Math.min(2.8, Math.log1p(p.capacity_bcm ?? p.capacity_mt ?? 0) * 0.55),
      color: pipelineColor(p),
      // Dashes are unreliable under GlobeView — render solid there
      dashed: !globe && (p.commodity === 'gas' || p.status === 'offline'),
      __tooltip: `${p.name}${p.status !== 'active' ? ` — ${p.status.toUpperCase()}` : ''}\n${p.commodity === 'gas' ? 'Gas pipeline' : p.commodity === 'products' ? 'Products pipeline' : 'Crude pipeline'} — ${formatCapacity(p)}\n${p.operator ?? ''}`,
    }))

  // Soft glow underlay gives the traces depth against the dark basemap
  const glowLayer = new PathLayer({
    id: 'pipeline-glow',
    data,
    getPath: (d: any) => d.path,
    getColor: (d: any) => [d.color[0], d.color[1], d.color[2], 45] as RGBA,
    getWidth: (d: any) => d.width + 4,
    widthUnits: 'pixels',
    jointRounded: true,
    capRounded: true,
    pickable: false,
    parameters: globeParams(globe) as any,
  })

  const lineLayer = new PathLayer({
    id: 'pipeline-lines',
    data,
    getPath: (d: any) => d.path,
    getColor: (d: any) =>
      d.id === selectedId ? ([255, 255, 255, 245] as RGBA) : d.color,
    getWidth: (d: any) => (d.id === selectedId ? d.width + 1.2 : d.width),
    widthUnits: 'pixels',
    jointRounded: true,
    capRounded: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 110],
    onHover,
    onClick,
    getDashArray: (d: any) => (d.dashed ? [6, 4] : [0, 0]),
    extensions: [new PathStyleExtension({ dash: true })],
    dashJustified: true,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getColor: [selectedId],
      getWidth: [selectedId],
      getDashArray: [globe],
    },
  } as any)

  return [glowLayer, lineLayer]
}
