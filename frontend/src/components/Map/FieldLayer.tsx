import { IconLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { CollisionFilterExtension } from '@deck.gl/extensions'
import type { OilGasField } from '../../api/types'
import { TYPE_COLOR, getIcon } from './iconAtlas'
import { globeParams, pointVisibleOnGlobe } from './globeCulling'
import { HIGHLIGHT, LABEL_HALO, LABEL_MUTED, SELECTED, withAlpha, type RGBA } from './mapTheme'

const STATUS_SUFFIX: Record<string, string> = {
  declining: ' (declining)',
  developing: ' (developing)',
}

interface Props {
  fields: OilGasField[]
  selectedId: number | null
  showLabels: boolean
  globe: boolean
  cameraCenter: [number, number]
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
export function FieldLayer({ fields, selectedId, showLabels, globe, cameraCenter, onHover, onClick }: Props) {
  const data = fields
    .filter(field => field.lat != null && field.lon != null)
    .filter(field => !globe || pointVisibleOnGlobe([field.lon!, field.lat!], cameraCenter))
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

  // Invisible round hit-target (icon glyph pixels are mostly transparent)
  const hitLayer = new ScatterplotLayer({
    id: 'field-hit',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 12,
    radiusUnits: 'pixels',
    getFillColor: [0, 0, 0, 1],
    stroked: false,
    pickable: true,
    onHover,
    onClick,
    parameters: globeParams(globe) as any,
  })

  const iconLayer = new IconLayer({
    id: 'field-icons',
    data,
    getPosition: (d: any) => d.position,
    getIcon: (d: any) => getIcon(d.iconKey),
    getSize: (d: any) => (d.id === selectedId ? 18 : 8 + Math.min(4, Math.log1p(d.production) * 0.9)),
    getColor: (d: any) =>
      d.id === selectedId
        ? SELECTED
        : d.status === 'declining'
        ? withAlpha(d.color, 140)
        : d.color,
    sizeUnits: 'pixels',
    billboard: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT,
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
        id: 'field-labels',
        data,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.name,
        getSize: 9.5,
        sizeUnits: 'pixels',
        fontFamily: 'Archivo, sans-serif',
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        getPixelOffset: [13, 0],
        getColor: LABEL_MUTED,
        outlineWidth: 2,
        outlineColor: LABEL_HALO,
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
