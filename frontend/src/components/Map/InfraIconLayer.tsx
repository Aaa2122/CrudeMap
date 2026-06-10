import { IconLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { CollisionFilterExtension } from '@deck.gl/extensions'
import type { Infrastructure } from '../../api/types'
import { getIcon, infraColor, infraIconKey } from './iconAtlas'
import { globeParams, pointVisibleOnGlobe } from './globeCulling'

interface Props {
  infras: Infrastructure[]
  selectedId: number | null
  showLabels: boolean
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
  onClick: (info: any) => void
}

function formatCapacity(infra: Infrastructure): string {
  if (infra.capacity_bcm) return `${infra.capacity_bcm.toFixed(0)} bcm/yr`
  if (infra.capacity_mt) return `${infra.capacity_mt.toFixed(0)} Mt/yr`
  return 'n/a'
}

const TYPE_LABEL: Record<string, string> = {
  terminal: 'Oil terminal',
  port: 'Oil port',
  refinery: 'Refinery',
  lng_terminal: 'LNG terminal',
}

/** Point infrastructure (terminals, ports, refineries, LNG) as tinted SVG icons. */
export function InfraIconLayer({ infras, selectedId, showLabels, globe, cameraCenter, onHover, onClick }: Props) {
  const data = infras
    .filter(infra => infra.lat != null && infra.lon != null)
    .filter(infra => !globe || pointVisibleOnGlobe([infra.lon!, infra.lat!], cameraCenter))
    .map(infra => {
      const capacity = infra.capacity_bcm ?? infra.capacity_mt ?? 0
      return {
        ...infra,
        position: [infra.lon!, infra.lat!] as [number, number],
        capacityRank: capacity,
        __tooltip: `${infra.name}\n${TYPE_LABEL[infra.type ?? ''] ?? infra.type} — ${formatCapacity(infra)}\n${infra.operator ?? ''} | ${infra.status}`,
      }
    })

  // Invisible round hit-target: icon glyphs are mostly transparent pixels,
  // which deck.gl picking ignores — without this, clicks fall through to the
  // country polygon underneath.
  const hitLayer = new ScatterplotLayer({
    id: 'infra-hit',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 13,
    radiusUnits: 'pixels',
    getFillColor: [0, 0, 0, 1],
    stroked: false,
    pickable: true,
    onHover,
    onClick,
    parameters: globeParams(globe) as any,
  })

  const iconLayer = new IconLayer({
    id: 'infra-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: (d: any) => getIcon(infraIconKey(d)),
    getSize: (d: any) => (d.id === selectedId ? 30 : 17 + Math.min(9, Math.log1p(d.capacityRank) * 1.9)),
    getColor: (d: any) => (d.id === selectedId ? [255, 255, 255, 255] : infraColor(d)),
    sizeUnits: 'pixels',
    billboard: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 90],
    onHover,
    onClick,
    parameters: globeParams(globe) as any,
    updateTriggers: {
      getSize: [selectedId],
      getColor: [selectedId],
    },
  })

  const layers: any[] = [hitLayer, iconLayer]

  if (showLabels && !globe) {
    layers.push(
      new TextLayer({
        id: 'infra-labels',
        data,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.name,
        getSize: 11,
        sizeUnits: 'pixels',
        fontFamily: 'Archivo, sans-serif',
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        getPixelOffset: [14, 0],
        getColor: [226, 232, 240, 235],
        outlineWidth: 2,
        outlineColor: [10, 16, 24, 235],
        fontSettings: { sdf: true },
        characterSet: 'auto',
        billboard: true,
        pickable: false,
        // Drop colliding labels, keep the biggest assets
        extensions: [new CollisionFilterExtension()],
        collisionGroup: 'labels',
        getCollisionPriority: (d: any) => Math.log1p(d.capacityRank),
      }),
    )
  }

  return layers
}
