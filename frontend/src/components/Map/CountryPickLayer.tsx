/**
 * Invisible GeoJSON layer that intercepts country clicks on the base map.
 * Since CartoDB renders country boundaries natively, we add a transparent
 * ScatterplotLayer using country centroids to make countries clickable.
 */
import { ScatterplotLayer } from '@deck.gl/layers'
import type { CountryBrief } from '../../api/types'
import { useMapStore } from '../../store/mapStore'

interface Props {
  countries: CountryBrief[]
}

export function CountryPickLayer({ countries }: Props) {
  const { setSelected } = useMapStore()

  const data = countries
    .filter(c => c.lat && c.lon)
    .map(c => ({
      ...c,
      position: [c.lon!, c.lat!] as [number, number],
      __tooltip: c.name,
    }))

  return new ScatterplotLayer({
    id: 'country-pick',
    data,
    getPosition: (d: any) => d.position,
    getRadius: 200000,
    getFillColor: [0, 0, 0, 0],    // fully transparent
    stroked: false,
    pickable: true,
    onClick: (info: any) => {
      if (info.object) {
        setSelected({ type: 'country', iso: info.object.iso })
      }
    },
    onHover: (info: any) => {
      // handled in WorldMap
    },
  })
}
