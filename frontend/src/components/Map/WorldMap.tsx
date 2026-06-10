import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { _GlobeView as GlobeView, FlyToInterpolator, MapView, WebMercatorViewport } from '@deck.gl/core'
import type { Infrastructure } from '../../api/types'
import { useMapStore } from '../../store/mapStore'
import { useScenarioStore } from '../../store/scenarioStore'
import { useFlows } from '../../api/hooks/useFlows'
import { useChokepoints } from '../../api/hooks/useChokepoints'
import { useCountries } from '../../api/hooks/useCountries'
import { useInfrastructures } from '../../api/hooks/useInfrastructures'
import { useFieldsData } from '../../api/hooks/useFields'
import { useStaticGeo } from '../../api/hooks/useStaticGeo'
import { useWorldCountriesGeoJson } from '../../api/hooks/useWorldCountriesGeoJson'
import { buildMetricScale } from './countryMetrics'
import { CountryChoroplethLayer } from './CountryChoroplethLayer'
import { FlowLayer } from './FlowLayer'
import { ChokeLayer } from './ChokeLayer'
import { InfraIconLayer } from './InfraIconLayer'
import { PipelineLayer } from './PipelineLayer'
import { FieldLayer } from './FieldLayer'
import { ShippingLaneLayer } from './ShippingLaneLayer'
import { MapLegend } from './MapLegend'
import { GraticuleLayer, OceanLayer } from './gisBasemap'
import { buildFlowPaths } from './flowGeometry'
import {
  containerPortsVisibleAtZoom,
  fieldsVisibleAtZoom,
  filterByLod,
  labelsVisibleAtZoom,
  quantizeZoom,
} from './lod'

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

const DEFAULT_VIEWPORT_SIZE = { width: 1280, height: 720 }
const COUNTRY_FIT_PADDING = 72
const COUNTRY_FOCUS_ZOOM = 3.2
const TOP_FLOWS_OVERVIEW = 60

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

export function createAnimatedViewState(
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
    commodity,
    layers: layerVisibility,
    viewMode,
    selectedMetric,
    filters,
  } = useMapStore()
  const { activeSlug, result: scenarioResult } = useScenarioStore()
  const { data: flows } = useFlows(commodity)
  const { data: chokepoints } = useChokepoints()
  const { data: countries } = useCountries()
  const { data: infras } = useInfrastructures()
  const { data: fields } = useFieldsData()
  const { data: shippingLanes } = useStaticGeo(layerVisibility.shippingLanes ? 'shipping_lanes.geojson' : null)
  const { data: containerPorts } = useStaticGeo(
    layerVisibility.shippingLanes || layerVisibility.containerPorts ? 'container_ports.geojson' : null,
  )
  const { data: countryGeoJson } = useWorldCountriesGeoJson()
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT_SIZE)
  const [viewState, setViewState] = useState(() => FLAT_VIEW_STATE)

  const isGlobe = viewMode === 'globe'
  const zoom = quantizeZoom(viewState.zoom ?? FLAT_VIEW_STATE.zoom)

  const [animTime, setAnimTime] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      setAnimTime(((timestamp - startRef.current) % 6000) / 6000)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const disrupted = useMemo(
    () => new Set(scenarioResult?.disrupted_flow_ids ?? []),
    [scenarioResult],
  )

  // Chokepoints named in the active scenario slug pulse red on the map
  const disruptedChokeSlugs = useMemo(() => {
    const slugs = new Set<string>()
    if (activeSlug && scenarioResult) {
      for (const cp of chokepoints ?? []) {
        if (activeSlug.includes(cp.slug)) slugs.add(cp.slug)
      }
    }
    return slugs
  }, [activeSlug, scenarioResult, chokepoints])

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
  const selectedInfraId = selected?.type === 'infrastructure' ? selected.id : null
  const selectedFieldId = selected?.type === 'field' ? selected.id : null

  const visibleFlows = useMemo(() => {
    if (!layerVisibility.flows) return []

    if (selectedCountryIso) {
      return filteredFlows.filter(
        flow => flow.source_iso === selectedCountryIso || flow.target_iso === selectedCountryIso,
      )
    }

    return [...filteredFlows]
      .sort((left, right) => {
        const lv = left.commodity === 'gas' ? left.volume_bcm ?? 0 : left.volume_mt
        const rv = right.commodity === 'gas' ? right.volume_bcm ?? 0 : right.volume_mt
        return rv - lv
      })
      .slice(0, TOP_FLOWS_OVERVIEW)
  }, [layerVisibility.flows, selectedCountryIso, filteredFlows])

  // Routed geometry — recomputed only when flows/coords change, never per frame
  const flowPaths = useMemo(
    () => buildFlowPaths(visibleFlows, countryCoords, chokepoints ?? [], infras ?? []),
    [visibleFlows, countryCoords, chokepoints, infras],
  )

  // Infrastructure split: pipelines draw as traces, the rest as icons.
  // Commodity filter: oil mode shows oil+products assets, gas mode gas assets.
  const matchesCommodity = useCallback(
    (itemCommodity: string) =>
      commodity === 'gas' ? itemCommodity === 'gas' : itemCommodity !== 'gas',
    [commodity],
  )

  const pipelines = useMemo(
    () =>
      (infras ?? []).filter(
        infra => infra.type === 'pipeline' && matchesCommodity(infra.commodity),
      ),
    [infras, matchesCommodity],
  )

  const pointInfras = useMemo(() => {
    const wanted = (infra: Infrastructure) => {
      if (infra.type === 'pipeline') return false
      if (!matchesCommodity(infra.commodity)) return false
      if (infra.type === 'lng_terminal') return layerVisibility.lngTerminals
      if (infra.type === 'refinery') return layerVisibility.refineries
      return layerVisibility.terminals
    }
    const list = (infras ?? []).filter(wanted)
    return filterByLod(list, zoom, infra => infra.capacity_bcm ?? infra.capacity_mt ?? 0)
  }, [infras, matchesCommodity, layerVisibility.lngTerminals, layerVisibility.refineries, layerVisibility.terminals, zoom])

  const visibleFields = useMemo(() => {
    if (!layerVisibility.fields || !fieldsVisibleAtZoom(zoom)) return []
    const list = (fields ?? []).filter(
      field => field.commodity === 'mixed' || matchesCommodity(field.commodity),
    )
    return filterByLod(list, zoom, field => (field.production_mt ?? 0) + (field.production_bcm ?? 0))
  }, [fields, layerVisibility.fields, matchesCommodity, zoom])

  const metricScale = useMemo(
    () => buildMetricScale(filteredCountries, selectedMetric),
    [filteredCountries, selectedMetric],
  )

  useEffect(() => {
    const baseViewState = viewMode === 'globe' ? GLOBE_VIEW_STATE : FLAT_VIEW_STATE

    // Point entities (infra, field, chokepoint): fly straight to them
    if (selected && selected.type !== 'country') {
      let point: { lat: number | null; lon: number | null } | undefined
      if (selected.type === 'infrastructure') point = (infras ?? []).find(i => i.id === selected.id)
      else if (selected.type === 'field') point = (fields ?? []).find(f => f.id === selected.id)
      else if (selected.type === 'chokepoint') point = (chokepoints ?? []).find(c => c.slug === selected.slug)

      if (point?.lat != null && point?.lon != null) {
        setViewState(
          createAnimatedViewState({
            longitude: point.lon,
            latitude: point.lat,
            zoom: isGlobe ? 3.4 : 4.2,
          }),
        )
      }
      return
    }

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
  }, [countries, geoFeaturesByIso, isGlobe, selected, selectedCountryIso, viewMode, viewportSize, infras, fields, chokepoints])

  const handleHover = useCallback((info: any) => {
    const tooltipText = info.object?.properties?.__tooltip ?? info.object?.__tooltip
    if (tooltipText) {
      setTooltip({ x: info.x, y: info.y, text: tooltipText })
      return
    }
    setTooltip(null)
  }, [])

  const handleInfraClick = useCallback(
    (info: any) => {
      if (info.object) setSelected({ type: 'infrastructure', id: info.object.id })
    },
    [setSelected],
  )

  const handleFieldClick = useCallback(
    (info: any) => {
      if (info.object) setSelected({ type: 'field', id: info.object.id })
    },
    [setSelected],
  )

  const showLabels = labelsVisibleAtZoom(zoom)

  const layers = [
    // Self-rendered GIS ground — no external tiles
    OceanLayer(),
    GraticuleLayer(),
    layerVisibility.countries &&
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
    layerVisibility.shippingLanes &&
      ShippingLaneLayer({
        lanes: shippingLanes ?? null,
        ports: containerPorts ?? null,
        showPorts: (layerVisibility.containerPorts || layerVisibility.shippingLanes) && containerPortsVisibleAtZoom(zoom),
        showPortLabels: showLabels,
        globe: isGlobe,
        onHover: handleHover,
      }),
    layerVisibility.pipelines &&
      pipelines.length > 0 &&
      PipelineLayer({
        pipelines,
        selectedId: selectedInfraId,
        globe: isGlobe,
        onHover: handleHover,
        onClick: handleInfraClick,
      }),
    layerVisibility.flows &&
      flowPaths.length > 0 &&
      FlowLayer({
        flowPaths,
        disrupted,
        commodity,
        animTime,
        onHover: handleHover,
        onClick: () => undefined,
      }),
    visibleFields.length > 0 &&
      FieldLayer({
        fields: visibleFields,
        selectedId: selectedFieldId,
        showLabels,
        globe: isGlobe,
        onHover: handleHover,
        onClick: handleFieldClick,
      }),
    pointInfras.length > 0 &&
      InfraIconLayer({
        infras: pointInfras,
        selectedId: selectedInfraId,
        showLabels,
        globe: isGlobe,
        onHover: handleHover,
        onClick: handleInfraClick,
      }),
    layerVisibility.chokepoints &&
      ChokeLayer({
        chokepoints: chokepoints ?? [],
        disruptedSlugs: disruptedChokeSlugs,
        animTime,
        showLabels: zoom >= 2.2,
        onHover: handleHover,
        onClick: (info: any) => {
          if (info.object) {
            setSelected({ type: 'chokepoint', slug: info.object.slug })
          }
        },
      }),
  ]
    .filter(Boolean)
    .flat()

  const views = isGlobe
    ? new GlobeView({ id: 'globe', resolution: 10 })
    : new MapView({ id: 'map' })

  const selectedCountryName =
    selected?.type === 'country'
      ? (countries ?? []).find(country => country.iso === selected.iso)?.name
      : null

  const flowsLabel = !layerVisibility.flows
    ? 'Flows hidden'
    : selectedCountryName
    ? `Flows: ${selectedCountryName}`
    : `Flows: top ${TOP_FLOWS_OVERVIEW} ${commodity} routes`

  const isLoading = !countries || !countryGeoJson

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
      />

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded border border-border bg-surface/95 px-4 py-3 shadow-xl">
            <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
            <span className="text-xs uppercase tracking-widest text-text-muted">Loading world data…</span>
          </div>
        </div>
      )}

      <MapLegend scale={metricScale} flowsLabel={flowsLabel} />

      {tooltip && (
        <div
          className="terminal-card absolute pointer-events-none z-50 max-w-[250px] rounded-sm px-3 py-2"
          style={{ left: tooltip.x + 14, top: tooltip.y - 16 }}
        >
          {tooltip.text.split('\n').map((line, index) => (
            <div
              key={`${line}-${index}`}
              className={
                index === 0
                  ? 'text-[12px] font-semibold text-text'
                  : index === 1
                  ? 'mt-0.5 font-mono text-[11px]'
                  : 'font-mono text-[10px] text-text-muted'
              }
              style={index === 1 ? { color: commodity === 'gas' ? '#46C8DC' : '#DCA54A' } : undefined}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
