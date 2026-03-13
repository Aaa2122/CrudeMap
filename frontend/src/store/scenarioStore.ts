import { create } from 'zustand'
import type { ScenarioResult } from '../api/types'
import { runScenario } from '../api/hooks/useScenario'

interface ScenarioStore {
  activeSlug: string | null
  result: ScenarioResult | null
  loading: boolean
  error: string | null
  activateScenario: (slug: string) => Promise<void>
  clearScenario: () => void
}

export const useScenarioStore = create<ScenarioStore>(set => ({
  activeSlug: null,
  result: null,
  loading: false,
  error: null,

  activateScenario: async (slug: string) => {
    set({ loading: true, error: null, activeSlug: slug })
    try {
      const result = await runScenario(slug)
      set({ result, loading: false })
    } catch (e) {
      set({ error: 'Failed to run scenario', loading: false })
    }
  },

  clearScenario: () =>
    set({ activeSlug: null, result: null, loading: false, error: null }),
}))
