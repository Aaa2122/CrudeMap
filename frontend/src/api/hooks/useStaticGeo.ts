import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/** Static GeoJSON served from frontend/public/geo/ (no backend involved). */
export function useStaticGeo<T = any>(file: string | null) {
  return useSWR<T>(file ? `/geo/${file}` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  })
}
