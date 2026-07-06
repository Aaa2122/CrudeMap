import { create } from 'zustand'
import type { Commodity, CountryMetricKey, SelectableEntity } from '../api/types'

type ViewMode = 'flat' | 'globe'

export type LayerKey =
  | 'countries'
  | 'flows'
  | 'vessels'
  | 'aisLive'
  | 'pipelines'
  | 'terminals'
  | 'refineries'
  | 'fields'
  | 'lngTerminals'
  | 'chokepoints'
  | 'shippingLanes'
  | 'containerPorts'

export interface AisStatus {
  enabled: boolean
  connected: boolean
  count: number
}

// Country color answers "who pumps vs who burns" by default
export const DEFAULT_METRIC: Record<Commodity, CountryMetricKey> = {
  oil: 'oil_balance',
  gas: 'gas_balance',
}

interface MapStore {
  selected: SelectableEntity
  commodity: Commodity
  layers: Record<LayerKey, boolean>
  viewMode: ViewMode
  selectedMetric: CountryMetricKey
  aisStatus: AisStatus
  setSelected: (entity: SelectableEntity) => void
  clearSelected: () => void
  setCommodity: (commodity: Commodity) => void
  toggleLayer: (layer: LayerKey) => void
  setViewMode: (mode: ViewMode) => void
  setSelectedMetric: (metric: CountryMetricKey) => void
  setAisStatus: (status: AisStatus) => void
}

// Lean defaults — refineries and maritime extras are opt-in to keep the
// world view readable.
const defaultLayers: Record<LayerKey, boolean> = {
  countries: true,
  flows: true,
  vessels: true,
  aisLive: true,
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
  aisStatus: { enabled: false, connected: false, count: 0 },

  setSelected: entity => set({ selected: entity }),
  clearSelected: () => set({ selected: null }),

  setCommodity: commodity =>
    set({ commodity, selectedMetric: DEFAULT_METRIC[commodity], selected: null }),

  setViewMode: mode => set({ viewMode: mode }),

  setSelectedMetric: metric => set({ selectedMetric: metric }),

  toggleLayer: layer =>
    set(state => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),

  setAisStatus: status => set({ aisStatus: status }),
}))
