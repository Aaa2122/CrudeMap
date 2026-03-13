import { create } from 'zustand'
import type { SelectableEntity } from '../api/types'

interface Filters {
  region: string | null
  role: string | null
  minImportance: number
}

type ViewMode = 'flat' | 'globe'

interface MapStore {
  selected: SelectableEntity
  showFlowLayer: boolean
  showChokeLayer: boolean
  showInfraLayer: boolean
  viewMode: ViewMode
  filters: Filters
  setSelected: (entity: SelectableEntity) => void
  clearSelected: () => void
  toggleLayer: (layer: 'flow' | 'choke' | 'infra') => void
  setViewMode: (mode: ViewMode) => void
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
  showFlowLayer: true,
  showChokeLayer: true,
  showInfraLayer: false,
  viewMode: 'flat',
  filters: { ...defaultFilters },

  setSelected: entity => set({ selected: entity }),
  clearSelected: () => set({ selected: null }),

  setViewMode: mode => set({ viewMode: mode }),

  toggleLayer: layer =>
    set(state => ({
      showFlowLayer: layer === 'flow' ? !state.showFlowLayer : state.showFlowLayer,
      showChokeLayer: layer === 'choke' ? !state.showChokeLayer : state.showChokeLayer,
      showInfraLayer: layer === 'infra' ? !state.showInfraLayer : state.showInfraLayer,
    })),

  setFilter: (key, value) =>
    set(state => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () => set({ filters: { ...defaultFilters } }),
}))
