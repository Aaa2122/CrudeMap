import useSWR from 'swr'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`)
  }
  return response.json()
}

export function useWorldCountriesGeoJson() {
  return useSWR('/world-countries.geojson', fetcher)
}
