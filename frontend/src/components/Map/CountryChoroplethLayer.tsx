import { GeoJsonLayer } from '@deck.gl/layers'
import type { CountryBrief, CountryMetricKey } from '../../api/types'
import { buildMetricScale, formatMetricValue, getCountryMetricValue } from './countryMetrics'

interface Props {
  geojson: any
  countries: CountryBrief[]
  selectedMetric: CountryMetricKey
  selectedIso?: string | null
  onHover: (info: any) => void
  onClick: (info: any) => void
}

function getFeatureIso(feature: any): string | null {
  const properties = feature?.properties ?? {}
  const candidates = [properties.ADM0_A3, properties.ISO_A3, properties.SOV_A3, properties.ADM0_A3_US]
  const iso = candidates.find((value: unknown) => typeof value === 'string' && value !== '-99')
  return iso ?? null
}

const DIMMED_COUNTRY_COLOR: [number, number, number, number] = [20, 27, 34, 82]

export function CountryChoroplethLayer({
  geojson,
  countries,
  selectedMetric,
  selectedIso,
  onHover,
  onClick,
}: Props) {
  const scale = buildMetricScale(countries, selectedMetric)
  const countriesByIso = new Map(countries.map(country => [country.iso, country]))

  const features = (geojson?.features ?? []).map((feature: any) => {
    const iso = getFeatureIso(feature)
    const country = iso ? countriesByIso.get(iso) : null
    const metricValue = country ? getCountryMetricValue(country, selectedMetric) : null
    return {
      ...feature,
      properties: {
        ...feature.properties,
        __iso: iso,
        __country: country,
        __metricValue: metricValue,
        __tooltip: country
          ? `${country.name}\n${formatMetricValue(selectedMetric, metricValue)}\n${scale.getBucketLabel(metricValue)}`
          : `${feature.properties?.NAME ?? 'Unknown'}\nNo data`,
      },
    }
  })

  return new GeoJsonLayer({
    id: 'country-choropleth',
    data: features,
    filled: true,
    stroked: true,
    pickable: true,
    getFillColor: (feature: any) => {
      const featureIso = feature.properties?.__iso
      if (!selectedIso) return scale.getColor(feature.properties?.__metricValue)
      return featureIso === selectedIso
        ? scale.getColor(feature.properties?.__metricValue)
        : DIMMED_COUNTRY_COLOR
    },
    getLineColor: (feature: any) =>
      feature.properties?.__iso === selectedIso ? [250, 204, 21, 255] : [83, 112, 128, 100],
    getLineWidth: (feature: any) => (feature.properties?.__iso === selectedIso ? 2.4 : 0.7),
    lineWidthUnits: 'pixels',
    autoHighlight: true,
    highlightColor: [255, 255, 255, 40],
    onHover,
    onClick,
    updateTriggers: {
      getFillColor: [countries, selectedMetric],
      getLineColor: [selectedIso],
      getLineWidth: [selectedIso],
    },
  })
}
