import useSWR from 'swr'
import { apiClient } from '../client'
import type { Flow } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useFlows() {
  return useSWR<Flow[]>('/flows', fetcher)
}
