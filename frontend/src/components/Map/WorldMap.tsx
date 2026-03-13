import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { _GlobeView as GlobeView, MapView } from '@deck.gl/core'
import { BitmapLayer } from '@deck.gl/layers'
import { TileLayer } from '@deck.gl/geo-layers'
import { Map } from 'react-map-gl/maplibre'
import { FlowLayer } from './FlowLayer'
import { ChokeLayer } from './ChokeLayer'
import { InfraLayer } from './InfraLayer'
import { CountryPickLayer } from './CountryPickLayer'
import { useMapStore } from '../../store/mapStore'
import { useFlows } from '../../api/hooks/useFlows'
import { useChokepoints } from '../../api/hooks/useChokepoints'
import { useCountries } from '../../api/hooks/useCountries'
import { useScenarioStore } from '../../store/scenarioStore'

const FLAT_VIEW_STATE = {
  longitude: 30,
  latitude: 20,
  zoom: 1.8,
  pitch: 0,
  bearing: 0,
}

const GLOBE_VIEW_STATE = {
  longitude: 40,
  latitude: 25,
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
}

// Free CartoDB dark basemap — no token required
const BASEMAP_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export function WorldMap() {
  const { setSelected, showFlowLayer, showChokeLayer, showInfraLayer, viewMode, filters } = useMapStore()
  const { result: scenarioResult } = useScenarioStore()
  const { data: flows } = useFlows()
  const { data: chokepoints } = useChokepoints()
  const { data: countries } = useCountries()
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const isGlobe = viewMode === 'globe'

  // Animation loop for flow pulse
  const [animTime, setAnimTime] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      // Full cycle every 3 seconds
      setAnimTime(((ts - startRef.current) % 3000) / 3000)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const disrupted = new Set(scenarioResult?.disrupted_flow_ids ?? [])

  // Build country coords lookup from API data
  const countryCoords = useMemo(() => {
    const coords: Record<string, [number, number]> = {}
    for (const c of countries ?? []) {
      if (c.lon != null && c.lat != null) {
        coords[c.iso] = [c.lon, c.lat]
      }
    }
    return coords
  }, [countries])

  // Apply filters
  const filteredCountries = useMemo(() => {
    let list = countries ?? []
    if (filters.region) list = list.filter(c => c.region === filters.region)
    if (filters.role) list = list.filter(c => c.role === filters.role)
    if (filters.minImportance > 0) list = list.filter(c => c.importance_score >= filters.minImportance)
    return list
  }, [countries, filters])

  const filteredIsos = useMemo(() => new Set(filteredCountries.map(c => c.iso)), [filteredCountries])

  const filteredFlows = useMemo(() => {
    if (!filters.region && !filters.role && filters.minImportance === 0) return flows ?? []
    return (flows ?? []).filter(f => filteredIsos.has(f.source_iso) || filteredIsos.has(f.target_iso))
  }, [flows, filters, filteredIsos])

  const handleHover = useCallback((info: any) => {
    if (info.object) {
      setTooltip({ x: info.x, y: info.y, text: info.object.__tooltip ?? '' })
    } else {
      setTooltip(null)
    }
  }, [])

  // Globe basemap: dark raster tiles rendered on the sphere
  const globeBaseLayer = isGlobe
    ? new TileLayer({
        id: 'globe-base-tiles',
        data: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        minZoom: 0,
        maxZoom: 6,
        tileSize: 256,
        renderSubLayers: (props: any) => {
          const { west, south, east, north } = props.tile.bbox
          return new BitmapLayer(props, {
            data: undefined,
            image: props.data,
            bounds: [west, south, east, north],
          })
        },
      })
    : null

  const layers = [
    globeBaseLayer,
    showFlowLayer &&
      FlowLayer({
        flows: filteredFlows,
        disrupted,
        countryCoords,
        onHover: handleHover,
        onClick: (info: any) => {
          if (info.object) {
            // Could open source/target country panel
          }
        },
        globe: isGlobe,
        animTime,
      }),
    showChokeLayer &&
      ChokeLayer({
        chokepoints: chokepoints ?? [],
        onHover: handleHover,
        onClick: (info: any) => {
          if (info.object) {
            setSelected({ type: 'chokepoint', slug: info.object.slug })
          }
        },
      }),
    showInfraLayer && InfraLayer({ onHover: handleHover }),
    CountryPickLayer({ countries: filteredCountries }),
  ].filter(Boolean)

  const views = isGlobe
    ? new GlobeView({ id: 'globe', resolution: 10 })
    : new MapView({ id: 'map' })

  return (
    <div className="relative w-full h-full">
      <DeckGL
        key={viewMode}
        initialViewState={isGlobe ? GLOBE_VIEW_STATE : FLAT_VIEW_STATE}
        controller
        layers={layers}
        views={views}
        onViewStateChange={() => setTooltip(null)}
      >
        {/* MapLibre basemap only in flat mode; globe uses deck.gl's built-in earth */}
        {!isGlobe && <Map mapStyle={BASEMAP_URL} />}
      </DeckGL>

      {tooltip && (
        <div
          className="absolute pointer-events-none bg-surface border border-border text-text text-xs px-2 py-1 rounded shadow-lg z-50"
          style={{ left: tooltip.x + 12, top: tooltip.y - 20 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
