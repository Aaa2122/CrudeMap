import useSWR from 'swr'
import { apiClient } from '../client'
import type { CountryBrief, CountryDetail, Flow, Infrastructure } from '../types'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function useCountries() {
  return useSWR<CountryBrief[]>('/countries', fetcher)
}

export function useCountry(iso: string | null) {
  return useSWR<CountryDetail>(iso ? `/countries/${iso}` : null, fetcher)
}

export function useCountryFlows(iso: string | null) {
  return useSWR<Flow[]>(iso ? `/countries/${iso}/flows` : null, fetcher)
}

export function useCountryChokeExposure(iso: string | null) {
  return useSWR<Record<string, number>>(
    iso ? `/countries/${iso}/chokepoint-exposure` : null,
    fetcher,
  )
}

export function useCountryInfras(iso: string | null) {
  return useSWR<Infrastructure[]>(iso ? `/countries/${iso}/infrastructures` : null, fetcher)
}
