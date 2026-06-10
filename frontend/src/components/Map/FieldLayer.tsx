import { IconLayer, TextLayer } from '@deck.gl/layers'
import { CollisionFilterExtension } from '@deck.gl/extensions'
import type { OilGasField } from '../../api/types'
import { TYPE_COLOR, getIcon } from './iconAtlas'

type RGBA = [number, number, number, number]

const STATUS_SUFFIX: Record<string, string> = {
  declining: ' (declining)',
  developing: ' (developing)',
}

interface Props {
  fields: OilGasField[]
  selectedId: number | null
  showLabels: boolean
  globe: boolean
  onHover: (info: any) => void
  onClick: (info: any) => void
}

function formatProduction(field: OilGasField): string {
  const parts: string[] = []
  if (field.production_mt) parts.push(`${field.production_mt.toFixed(0)} Mt/yr oil`)
  if (field.production_bcm) parts.push(`${field.production_bcm.toFixed(0)} bcm/yr gas`)
  return parts.join(' + ') || 'n/a'
}

/** Oil & gas fields: derrick (oil) / flame (gas) icons sized by production. */
export function FieldLayer({ fields, selectedId, showLabels, globe, onHover, onClick }: Props) {
  const data = fields
    .filter(field => field.lat != null && field.lon != null)
    .map(field => {
      const production = (field.production_mt ?? 0) + (field.production_bcm ?? 0)
      const isGas = field.commodity === 'gas'
      return {
        ...field,
        position: [field.lon!, field.lat!] as [number, number],
        production,
        iconKey: isGas ? ('field_gas' as const) : ('field_oil' as const),
        color: (isGas ? TYPE_COLOR.field_gas : TYPE_COLOR.field_oil) as RGBA,
        __tooltip: `${field.name}${STATUS_SUFFIX[field.status] ?? ''}\n${field.field_type ?? 'field'} — ${formatProduction(field)}\n${field.operator ?? ''}`,
      }
    })

  const iconLayer = new IconLayer({
    id: 'field-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: (d: any) => getIcon(d.iconKey),
    getSize: (d: any) => (d.id === selectedId ? 28 : 14 + Math.min(8, Math.log1p(d.production) * 1.6)),
    getColor: (d: any) =>
      d.id === selectedId
        ? ([255, 255, 255, 255] as RGBA)
        : d.status === 'declining'
        ? ([d.color[0], d.color[1], d.color[2], 150] as RGBA)
        : d.color,
    sizeUnits: 'pixels',
    billboard: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 90],
    onHover,
    onClick,
    updateTriggers: {
      getSize: [selectedId],
      getColor: [selectedId],
    },
  })

  const layers: any[] = [iconLayer]

  if (showLabels && !globe) {
    layers.push(
      new TextLayer({
        id: 'field-labels',
        data,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.name,
        getSize: 10.5,
        sizeUnits: 'pixels',
        fontFamily: 'Archivo, sans-serif',
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        getPixelOffset: [13, 0],
        getColor: [203, 213, 225, 225],
        outlineWidth: 2,
        outlineColor: [10, 16, 24, 235],
        fontSettings: { sdf: true },
        characterSet: 'auto',
        billboard: true,
        pickable: false,
        extensions: [new CollisionFilterExtension()],
        collisionGroup: 'labels',
        getCollisionPriority: (d: any) => Math.log1p(d.production) - 1,
      }),
    )
  }

  return layers
}
