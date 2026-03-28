import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { _GlobeView as GlobeView, FlyToInterpolator, MapView, WebMercatorViewport } from '@deck.gl/core'
import { BitmapLayer } from '@deck.gl/layers'
import { TileLayer } from '@deck.gl/geo-layers'
import { Map as MapLibreMap } from 'react-map-gl/maplibre'
import { useMapStore } from '../../store/mapStore'
import { useScenarioStore } from '../../store/scenarioStore'
import { useFlows } from '../../api/hooks/useFlows'
import { useChokepoints } from '../../api/hooks/useChokepoints'
import { useCountries } from '../../api/hooks/useCountries'
import { useWorldCountriesGeoJson } from '../../api/hooks/useWorldCountriesGeoJson'
import { buildMetricScale } from './countryMetrics'
import { CountryChoroplethLayer } from './CountryChoroplethLayer'
import { FlowLayer } from './FlowLayer'
import { ChokeLayer } from './ChokeLayer'
import { InfraLayer } from './InfraLayer'
import { MetricLegend } from './MetricLegend'

const FLAT_VIEW_STATE = {
  longitude: 18,
  latitude: 18,
  zoom: 1.65,
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

const BASEMAP_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const DEFAULT_VIEWPORT_SIZE = { width: 1280, height: 720 }
const COUNTRY_FIT_PADDING = 72
const COUNTRY_FOCUS_ZOOM = 3.2

function getFeatureIso(feature: any): string | null {
  const properties = feature?.properties ?? {}
  const candidates = [properties.ADM0_A3, properties.ISO_A3, properties.SOV_A3, properties.ADM0_A3_US]
  const iso = candidates.find((value: unknown) => typeof value === 'string' && value !== '-99')
  return iso ?? null
}

function collectCoordinates(node: any, bucket: [number, number][]) {
  if (!Array.isArray(node) || node.length === 0) return
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    bucket.push([node[0], node[1]])
    return
  }

  for (const child of node) {
    collectCoordinates(child, bucket)
  }
}

function getFeatureBounds(feature: any): [[number, number], [number, number]] | null {
  const coordinates: [number, number][] = []
  collectCoordinates(feature?.geometry?.coordinates, coordinates)
  if (coordinates.length === 0) return null

  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity

  for (const [lon, lat] of coordinates) {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }

  return [[minLon, minLat], [maxLon, maxLat]]
}

function createAnimatedViewState(
  nextState: { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number },
) {
  return {
    ...nextState,
    pitch: nextState.pitch ?? 0,
    bearing: nextState.bearing ?? 0,
    transitionDuration: 900,
    transitionInterpolator: new FlyToInterpolator(),
  }
}

export function WorldMap() {
  const {
    selected,
    setSelected,
    clearSelected,
    showCountryLayer,
    showFlowLayer,
    showChokeLayer,
    showInfraLayer,
    viewMode,
    selectedMetric,
    flowMode,
    filters,
  } = useMapStore()
  const { result: scenarioResult } = useScenarioStore()
  const { data: flows } = useFlows()
  const { data: chokepoints } = useChokepoints()
  const { data: countries } = useCountries()
  const { data: countryGeoJson } = useWorldCountriesGeoJson()
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT_SIZE)
  const [viewState, setViewState] = useState(() => FLAT_VIEW_STATE)

  const isGlobe = viewMode === 'globe'

  const [animTime, setAnimTime] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      setAnimTime(((timestamp - startRef.current) % 3000) / 3000)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const disrupted = new Set(scenarioResult?.disrupted_flow_ids ?? [])

  const countryCoords = useMemo(() => {
    const coords: Record<string, [number, number]> = {}
    for (const country of countries ?? []) {
      if (country.lon != null && country.lat != null) {
        coords[country.iso] = [country.lon, country.lat]
      }
    }
    return coords
  }, [countries])

  const geoFeaturesByIso = useMemo(() => {
    const entries = (countryGeoJson?.features ?? [])
      .map((feature: any) => [getFeatureIso(feature), feature] as [string | null, any])
      .filter((entry: [string | null, any]): entry is [string, any] => Boolean(entry[0]))
    return new globalThis.Map(entries)
  }, [countryGeoJson])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const updateViewportSize = () => {
      setViewportSize({
        width: node.clientWidth || DEFAULT_VIEWPORT_SIZE.width,
        height: node.clientHeight || DEFAULT_VIEWPORT_SIZE.height,
      })
    }

    updateViewportSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewportSize)
      return () => window.removeEventListener('resize', updateViewportSize)
    }

    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const filteredCountries = useMemo(() => {
    let list = countries ?? []
    if (filters.region) list = list.filter(country => country.region === filters.region)
    if (filters.role) list = list.filter(country => country.role === filters.role)
    if (filters.minImportance > 0) list = list.filter(country => country.importance_score >= filters.minImportance)
    return list
  }, [countries, filters])

  const filteredIsos = useMemo(() => new Set(filteredCountries.map(country => country.iso)), [filteredCountries])

  const filteredFlows = useMemo(() => {
    let list = flows ?? []
    if (filters.region || filters.role || filters.minImportance > 0) {
      list = list.filter(flow => filteredIsos.has(flow.source_iso) || filteredIsos.has(flow.target_iso))
    }
    return list
  }, [flows, filters, filteredIsos])

  const selectedCountryIso = selected?.type === 'country' ? selected.iso : null

  const visibleFlows = useMemo(() => {
    if (!showFlowLayer) return []

    if (selectedCountryIso) {
      return filteredFlows.filter(
        flow => flow.source_iso === selectedCountryIso || flow.target_iso === selectedCountryIso,
      )
    }

    return [...filteredFlows]
      .sort((left, right) => right.volume_mt - left.volume_mt)
      .slice(0, 20)
  }, [showFlowLayer, selectedCountryIso, filteredFlows, flowMode])

  const metricScale = useMemo(
    () => buildMetricScale(filteredCountries, selectedMetric),
    [filteredCountries, selectedMetric],
  )

  useEffect(() => {
    const baseViewState = viewMode === 'globe' ? GLOBE_VIEW_STATE : FLAT_VIEW_STATE

    if (!selectedCountryIso) {
      setViewState(createAnimatedViewState(baseViewState))
      return
    }

    const selectedFeature = geoFeaturesByIso.get(selectedCountryIso)
    const selectedCountry = (countries ?? []).find(country => country.iso === selectedCountryIso)
    const fallbackLongitude = selectedCountry?.lon ?? baseViewState.longitude
    const fallbackLatitude = selectedCountry?.lat ?? baseViewState.latitude
    const fallbackZoom = isGlobe ? COUNTRY_FOCUS_ZOOM - 0.4 : COUNTRY_FOCUS_ZOOM

    if (!selectedFeature || isGlobe) {
      setViewState(
        createAnimatedViewState({
          longitude: fallbackLongitude,
          latitude: fallbackLatitude,
          zoom: fallbackZoom,
        }),
      )
      return
    }

    const bounds = getFeatureBounds(selectedFeature)
    if (!bounds) {
      setViewState(
        createAnimatedViewState({
          longitude: fallbackLongitude,
          latitude: fallbackLatitude,
          zoom: fallbackZoom,
        }),
      )
      return
    }

    const viewport = new WebMercatorViewport({
      width: Math.max(viewportSize.width, 1),
      height: Math.max(viewportSize.height, 1),
    })
    const fitted = viewport.fitBounds(bounds, {
      padding: COUNTRY_FIT_PADDING,
      maxZoom: 5.6,
    })

    setViewState(
      createAnimatedViewState({
        longitude: fitted.longitude,
        latitude: fitted.latitude,
        zoom: fitted.zoom,
      }),
    )
  }, [countries, geoFeaturesByIso, isGlobe, selectedCountryIso, viewMode, viewportSize])

  const handleHover = useCallback((info: any) => {
    const tooltipText = info.object?.properties?.__tooltip ?? info.object?.__tooltip
    if (tooltipText) {
      setTooltip({ x: info.x, y: info.y, text: tooltipText })
      return
    }
    setTooltip(null)
  }, [])

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
    showCountryLayer &&
      countryGeoJson &&
      CountryChoroplethLayer({
        geojson: countryGeoJson,
        countries: filteredCountries,
        selectedMetric,
        selectedIso: selected?.type === 'country' ? selected.iso : null,
        onHover: handleHover,
        onClick: (info: any) => {
          const iso = info.object?.properties?.__iso
          const country = info.object?.properties?.__country
          if (iso && country) {
            setSelected({ type: 'country', iso })
          }
        },
      }),
    showFlowLayer &&
      visibleFlows.length > 0 &&
      FlowLayer({
        flows: visibleFlows,
        disrupted,
        countryCoords,
        onHover: handleHover,
        onClick: () => undefined,
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
  ].filter(Boolean)

  const views = isGlobe
    ? new GlobeView({ id: 'globe', resolution: 10 })
    : new MapView({ id: 'map' })

  const selectedCountryName =
    selected?.type === 'country'
      ? (countries ?? []).find(country => country.iso === selected.iso)?.name
      : null

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <DeckGL
        key={viewMode}
        viewState={viewState}
        controller
        layers={layers}
        views={views}
        onViewStateChange={({ viewState: nextViewState }: any) => {
          setTooltip(null)
          setViewState(nextViewState)
        }}
        onClick={(info: any) => {
          if (!info.object) {
            clearSelected()
            setTooltip(null)
          }
        }}
      >
        {!isGlobe && <MapLibreMap mapStyle={BASEMAP_URL} />}
      </DeckGL>

      <MetricLegend
        metric={selectedMetric}
        scale={metricScale}
        flowMode={showFlowLayer ? (selectedCountryIso ? 'selected' : 'top20') : 'off'}
        selectedCountryName={selectedCountryName}
      />

      {showFlowLayer && !selectedCountryIso && (
        <div className="absolute bottom-4 left-[274px] z-40 rounded border border-border bg-surface/95 px-3 py-2 text-[11px] text-text-muted shadow-lg shadow-black/25 backdrop-blur">
          Global routes are capped to the top 20. Click a country to isolate its flows, then click empty water to reset.
        </div>
      )}

      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 max-w-[240px] rounded border border-border bg-surface/95 px-3 py-2 text-xs text-text shadow-xl shadow-black/30 backdrop-blur"
          style={{ left: tooltip.x + 12, top: tooltip.y - 20 }}
        >
          {tooltip.text.split('\n').map((line, index) => (
            <div
              key={`${line}-${index}`}
              className={
                index === 0
                  ? 'font-semibold text-white'
                  : index === 1
                  ? 'mt-1 text-primary'
                  : 'text-text-muted'
              }
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
