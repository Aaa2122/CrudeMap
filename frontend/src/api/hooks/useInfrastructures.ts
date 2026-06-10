import useSWR from 'swr'
import { apiClient } from '../client'
import type { Infrastructure } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useInfrastructures() {
  return useSWR<Infrastructure[]>('/infrastructures', fetcher)
}
