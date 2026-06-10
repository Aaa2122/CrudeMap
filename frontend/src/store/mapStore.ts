import { create } from 'zustand'
import type { Commodity, CountryMetricKey, SelectableEntity } from '../api/types'

interface Filters {
  region: string | null
  role: string | null
  minImportance: number
}

type ViewMode = 'flat' | 'globe'

export type LayerKey =
  | 'countries'
  | 'flows'
  | 'pipelines'
  | 'terminals'
  | 'refineries'
  | 'fields'
  | 'lngTerminals'
  | 'chokepoints'
  | 'shippingLanes'
  | 'containerPorts'

export const DEFAULT_METRIC: Record<Commodity, CountryMetricKey> = {
  oil: 'production_oil_mt',
  gas: 'production_gas_bcm',
}

interface MapStore {
  selected: SelectableEntity
  commodity: Commodity
  layers: Record<LayerKey, boolean>
  viewMode: ViewMode
  selectedMetric: CountryMetricKey
  filters: Filters
  setSelected: (entity: SelectableEntity) => void
  clearSelected: () => void
  setCommodity: (commodity: Commodity) => void
  toggleLayer: (layer: LayerKey) => void
  setViewMode: (mode: ViewMode) => void
  setSelectedMetric: (metric: CountryMetricKey) => void
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  clearFilters: () => void
}

const defaultFilters: Filters = {
  region: null,
  role: null,
  minImportance: 0,
}

// Lean defaults — refineries and maritime extras are opt-in to keep the
// world view readable.
const defaultLayers: Record<LayerKey, boolean> = {
  countries: true,
  flows: true,
  pipelines: true,
  terminals: true,
  refineries: false,
  fields: true,
  lngTerminals: true,
  chokepoints: true,
  shippingLanes: false,
  containerPorts: false,
}

export const useMapStore = create<MapStore>(set => ({
  selected: null,
  commodity: 'oil',
  layers: { ...defaultLayers },
  viewMode: 'flat',
  selectedMetric: DEFAULT_METRIC.oil,
  filters: { ...defaultFilters },

  setSelected: entity => set({ selected: entity }),
  clearSelected: () => set({ selected: null }),

  setCommodity: commodity =>
    set({ commodity, selectedMetric: DEFAULT_METRIC[commodity], selected: null }),

  setViewMode: mode => set({ viewMode: mode }),

  setSelectedMetric: metric => set({ selectedMetric: metric }),

  toggleLayer: layer =>
    set(state => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),

  setFilter: (key, value) =>
    set(state => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () => set({ filters: { ...defaultFilters } }),
}))
