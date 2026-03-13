import useSWR from 'swr'
import { apiClient } from '../client'
import type { ScenarioBrief, ScenarioResult } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useScenarios() {
  return useSWR<ScenarioBrief[]>('/scenarios', fetcher)
}

export async function runScenario(slug: string): Promise<ScenarioResult> {
  const res = await apiClient.post<ScenarioResult>(`/scenarios/${slug}/run`)
  return res.data
}
