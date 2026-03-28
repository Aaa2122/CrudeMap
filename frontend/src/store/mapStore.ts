import { create } from 'zustand'
import type { CountryMetricKey, FlowMode, SelectableEntity } from '../api/types'

interface Filters {
  region: string | null
  role: string | null
  minImportance: number
}

type ViewMode = 'flat' | 'globe'

interface MapStore {
  selected: SelectableEntity
  showCountryLayer: boolean
  showFlowLayer: boolean
  showChokeLayer: boolean
  showInfraLayer: boolean
  viewMode: ViewMode
  selectedMetric: CountryMetricKey
  flowMode: FlowMode
  filters: Filters
  setSelected: (entity: SelectableEntity) => void
  clearSelected: () => void
  toggleLayer: (layer: 'country' | 'flow' | 'choke' | 'infra') => void
  setViewMode: (mode: ViewMode) => void
  setSelectedMetric: (metric: CountryMetricKey) => void
  setFlowMode: (mode: FlowMode) => void
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  clearFilters: () => void
}

const defaultFilters: Filters = {
  region: null,
  role: null,
  minImportance: 0,
}

export const useMapStore = create<MapStore>(set => ({
  selected: null,
  showCountryLayer: true,
  showFlowLayer: false,
  showChokeLayer: true,
  showInfraLayer: false,
  viewMode: 'flat',
  selectedMetric: 'dependency_score',
  flowMode: 'selected',
  filters: { ...defaultFilters },

  setSelected: entity => set({ selected: entity }),
  clearSelected: () => set({ selected: null }),

  setViewMode: mode => set({ viewMode: mode }),

  setSelectedMetric: metric => set({ selectedMetric: metric }),

  setFlowMode: mode => set({ flowMode: mode }),

  toggleLayer: layer =>
    set(state => ({
      showCountryLayer: layer === 'country' ? !state.showCountryLayer : state.showCountryLayer,
      showFlowLayer: layer === 'flow' ? !state.showFlowLayer : state.showFlowLayer,
      showChokeLayer: layer === 'choke' ? !state.showChokeLayer : state.showChokeLayer,
      showInfraLayer: layer === 'infra' ? !state.showInfraLayer : state.showInfraLayer,
    })),

  setFilter: (key, value) =>
    set(state => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () => set({ filters: { ...defaultFilters } }),
}))
