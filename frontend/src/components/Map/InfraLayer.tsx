import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import useSWR from 'swr'
import { apiClient } from '../../api/client'
import type { Infrastructure } from '../../api/types'
import { useMapStore } from '../../store/mapStore'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

const TYPE_COLOR: Record<string, [number, number, number, number]> = {
  terminal: [245, 158, 11, 200],
  port: [99, 102, 241, 200],
  pipeline: [16, 185, 129, 160],
  refinery: [236, 72, 153, 180],
}

const TYPE_EMOJI: Record<string, string> = {
  terminal: '🛢️',
  port: '⚓',
  pipeline: '🔗',
  refinery: '🏭',
}

interface Props {
  onHover: (info: any) => void
}

export function InfraLayer({ onHover }: Props) {
  const { setSelected } = useMapStore()
  const { data: infras } = useSWR<Infrastructure[]>('/infrastructures', fetcher)
  if (!infras) return null

  const data = infras
    .filter(infra => infra.lat && infra.lon)
    .map(infra => ({
      ...infra,
      position: [infra.lon!, infra.lat!] as [number, number],
      color: TYPE_COLOR[infra.type ?? ''] ?? [150, 150, 150, 180],
      emoji: TYPE_EMOJI[infra.type ?? ''] ?? '📍',
      __tooltip: `${TYPE_EMOJI[infra.type ?? ''] ?? '📍'} ${infra.name}\n${infra.type ?? 'unknown'}\n${infra.capacity_mt} Mt/yr | ${infra.status}`,
    }))

  const hitLayer = new ScatterplotLayer({
    id: 'infra-hit',
    data,
    getPosition: (point: any) => point.position,
    getRadius: 50000,
    getFillColor: [8, 12, 18, 1],
    stroked: false,
    pickable: true,
    onHover,
    onClick: (info: any) => {
      if (info.object) setSelected({ type: 'infrastructure', id: info.object.id })
    },
  })

  const emojiLayer = new TextLayer({
    id: 'infra-emoji',
    data,
    getPosition: (point: any) => point.position,
    getText: (point: any) => point.emoji,
    getSize: 18,
    sizeUnits: 'pixels',
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getColor: [255, 255, 255, 245],
    background: true,
    getBackgroundColor: (point: any) => [...point.color.slice(0, 3), 165] as [number, number, number, number],
    getBorderColor: [255, 255, 255, 40],
    getBorderWidth: 1,
    getBackgroundPadding: [4, 3],
    billboard: true,
    pickable: false,
  })

  return [hitLayer, emojiLayer]
}
