import type { CountryBrief, CountryDetail, CountryMetricKey } from '../../api/types'

type CountryMetricDatum = CountryBrief | CountryDetail
type RGBA = [number, number, number, number]

interface MetricConfig {
  label: string
  shortLabel: string
  palette: RGBA[]
  family: 'volume' | 'score' | 'ratio'
}

export interface LegendItem {
  color: RGBA
  label: string
}

export interface MetricScale {
  label: string
  shortLabel: string
  legendItems: LegendItem[]
  getColor: (value: number | null | undefined) => RGBA
  getBucketLabel: (value: number | null | undefined) => string
}

const VOLUME_PALETTE: RGBA[] = [
  [31, 52, 66, 170],
  [37, 90, 112, 185],
  [42, 133, 163, 195],
  [74, 181, 201, 210],
  [156, 228, 240, 225],
]

const RISK_PALETTE: RGBA[] = [
  [54, 49, 35, 170],
  [114, 83, 34, 185],
  [173, 103, 23, 195],
  [210, 85, 33, 210],
  [239, 68, 68, 225],
]

const RESILIENCE_PALETTE: RGBA[] = [
  [41, 56, 41, 170],
  [43, 97, 62, 185],
  [39, 139, 84, 195],
  [52, 171, 105, 210],
  [125, 211, 154, 225],
]

const SCORE_PALETTE: RGBA[] = [
  [42, 53, 76, 170],
  [49, 88, 125, 185],
  [58, 129, 173, 195],
  [98, 169, 206, 210],
  [191, 228, 255, 225],
]

const NO_DATA_COLOR: RGBA = [21, 29, 37, 120]

const METRIC_CONFIG: Record<CountryMetricKey, MetricConfig> = {
  dependency_score: {
    label: 'Import Dependency',
    shortLabel: 'Dependency',
    palette: RISK_PALETTE,
    family: 'ratio',
  },
  production_oil_mt: {
    label: 'Crude Production',
    shortLabel: 'Production',
    palette: VOLUME_PALETTE,
    family: 'volume',
  },
  import_oil_mt: {
    label: 'Crude Imports',
    shortLabel: 'Imports',
    palette: VOLUME_PALETTE,
    family: 'volume',
  },
  export_oil_mt: {
    label: 'Crude Exports',
    shortLabel: 'Exports',
    palette: VOLUME_PALETTE,
    family: 'volume',
  },
  consumption_oil_mt: {
    label: 'Crude Consumption',
    shortLabel: 'Consumption',
    palette: VOLUME_PALETTE,
    family: 'volume',
  },
  refining_capacity_mt: {
    label: 'Refining Capacity',
    shortLabel: 'Refining',
    palette: VOLUME_PALETTE,
    family: 'volume',
  },
  importance_score: {
    label: 'Strategic Importance',
    shortLabel: 'Importance',
    palette: SCORE_PALETTE,
    family: 'score',
  },
  resilience_score: {
    label: 'Resilience Score',
    shortLabel: 'Resilience',
    palette: RESILIENCE_PALETTE,
    family: 'score',
  },
}

export const COUNTRY_METRIC_OPTIONS = Object.entries(METRIC_CONFIG).map(([key, value]) => ({
  key: key as CountryMetricKey,
  label: value.label,
}))

export function getMetricConfig(metric: CountryMetricKey) {
  return METRIC_CONFIG[metric]
}

export function getCountryMetricValue(country: CountryMetricDatum, metric: CountryMetricKey): number {
  const value = country[metric]
  return typeof value === 'number' ? value : 0
}

export function formatMetricValue(metric: CountryMetricKey, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'No data'
  const config = METRIC_CONFIG[metric]
  if (config.family === 'ratio') return `${Math.round(value * 100)}%`
  if (config.family === 'score') return `${Math.round(value)}/100`
  return `${value.toFixed(1)} Mt/yr`
}

function computeQuantiles(values: number[], buckets: number): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const thresholds: number[] = []
  for (let index = 1; index < buckets; index += 1) {
    const position = Math.min(sorted.length - 1, Math.floor((index / buckets) * sorted.length))
    thresholds.push(sorted[position])
  }
  return thresholds
}

function formatLegendRange(metric: CountryMetricKey, min: number, max: number): string {
  const config = METRIC_CONFIG[metric]
  const format = (value: number) => {
    if (config.family === 'ratio') return `${Math.round(value * 100)}%`
    if (config.family === 'score') return `${Math.round(value)}`
    return `${value.toFixed(0)}`
  }
  if (min === max) return format(max)
  return `${format(min)} - ${format(max)}`
}

export function buildMetricScale(countries: CountryMetricDatum[], metric: CountryMetricKey): MetricScale {
  const config = METRIC_CONFIG[metric]
  const values = countries
    .map(country => getCountryMetricValue(country, metric))
    .filter(value => Number.isFinite(value) && value > 0)

  const thresholds =
    config.family === 'volume'
      ? computeQuantiles(values, config.palette.length)
      : config.family === 'score'
      ? [20, 40, 60, 80]
      : [0.2, 0.4, 0.6, 0.8]

  const legendItems = config.palette.map((color, index) => {
    const min = index === 0 ? 0 : thresholds[index - 1]
    const max = thresholds[index] ?? (values.length > 0 ? Math.max(...values) : 0)
    return {
      color,
      label: formatLegendRange(metric, min, max),
    }
  })

  return {
    label: config.label,
    shortLabel: config.shortLabel,
    legendItems: [...legendItems, { color: NO_DATA_COLOR, label: 'No data' }],
    getColor: value => {
      if (value == null || !Number.isFinite(value) || value <= 0) return NO_DATA_COLOR
      const bucket = thresholds.findIndex(threshold => value <= threshold)
      return config.palette[bucket === -1 ? config.palette.length - 1 : bucket]
    },
    getBucketLabel: value => {
      if (value == null || !Number.isFinite(value) || value <= 0) return 'No data'
      const bucket = thresholds.findIndex(threshold => value <= threshold)
      return legendItems[bucket === -1 ? legendItems.length - 1 : bucket].label
    },
  }
}
