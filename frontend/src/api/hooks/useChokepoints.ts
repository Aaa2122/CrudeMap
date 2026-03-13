import useSWR from 'swr'
import { apiClient } from '../client'
import type { ChokepointBrief, ChokepointDetail } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useChokepoints() {
  return useSWR<ChokepointBrief[]>('/chokepoints', fetcher)
}

export function useChokepoint(slug: string | null) {
  return useSWR<ChokepointDetail>(slug ? `/chokepoints/${slug}` : null, fetcher)
}
