import useSWR from 'swr'
import { apiClient } from '../client'
import type { OilGasField } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useFieldsData() {
  return useSWR<OilGasField[]>('/fields', fetcher)
}

export function useField(id: number | null) {
  return useSWR<OilGasField>(id != null ? `/fields/${id}` : null, fetcher)
}
