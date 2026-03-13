import { ScatterplotLayer } from '@deck.gl/layers'
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

interface Props {
  onHover: (info: any) => void
}

export function InfraLayer({ onHover }: Props) {
  const { setSelected } = useMapStore()
  const { data: infras } = useSWR<Infrastructure[]>('/infrastructures', fetcher)
  if (!infras) return null

  const data = infras
    .filter(i => i.lat && i.lon)
    .map(i => ({
      ...i,
      position: [i.lon!, i.lat!] as [number, number],
      color: TYPE_COLOR[i.type ?? ''] ?? [150, 150, 150, 180],
      __tooltip: `${i.name} (${i.type})\n${i.capacity_mt} Mt/yr — ${i.status}`,
    }))

  return new ScatterplotLayer({
    id: 'infra-layer',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 40000,
    getFillColor: (d: any) => d.color,
    stroked: false,
    pickable: true,
    onHover,
    onClick: (info: any) => {
      if (info.object) setSelected({ type: 'infrastructure', id: info.object.id })
    },
  })
}
