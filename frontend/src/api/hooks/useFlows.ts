import useSWR from 'swr'
import { apiClient } from '../client'
import type { Commodity, Flow } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useFlows(commodity?: Commodity) {
  const key = commodity ? `/flows?commodity=${commodity}` : '/flows'
  return useSWR<Flow[]>(key, fetcher)
}
