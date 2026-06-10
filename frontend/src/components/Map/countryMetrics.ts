import type { Commodity, CountryBrief, CountryDetail, CountryMetricKey } from '../../api/types'

type CountryMetricDatum = CountryBrief | CountryDetail
type RGBA = [number, number, number, number]

interface MetricConfig {
  label: string
  shortLabel: string
  palette: RGBA[]
  family: 'volume' | 'score' | 'ratio' | 'diverging'
  unit: 'mt' | 'bcm' | 'none'
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

// Land IS the basemap now (custom GIS ground) — fills are near-opaque,
// ramps are restrained single-hue luminance scales.
const VOLUME_PALETTE: RGBA[] = [
  [16, 28, 41, 242],
  [24, 45, 64, 242],
  [37, 73, 99, 242],
  [66, 116, 148, 242],
  [129, 178, 205, 242],
]

const RISK_PALETTE: RGBA[] = [
  [33, 29, 25, 242],
  [66, 48, 31, 242],
  [115, 72, 38, 242],
  [172, 94, 45, 242],
  [217, 84, 77, 242],
]

const RESILIENCE_PALETTE: RGBA[] = [
  [25, 35, 30, 242],
  [33, 61, 47, 242],
  [44, 94, 68, 242],
  [62, 134, 95, 242],
  [110, 187, 142, 242],
]

const SCORE_PALETTE: RGBA[] = [
  [22, 31, 46, 242],
  [33, 54, 80, 242],
  [48, 84, 119, 242],
  [78, 124, 163, 242],
  [142, 181, 214, 242],
]

// Teal ramp for natural gas volumes — visually distinct from the oil blue ramp
const GAS_VOLUME_PALETTE: RGBA[] = [
  [15, 31, 34, 242],
  [22, 53, 56, 242],
  [31, 84, 85, 242],
  [48, 128, 124, 242],
  [110, 195, 186, 242],
]

// Diverging ramps for net balance (production − consumption):
// importers cold steel-blue <- neutral dark -> exporters in the commodity hue
const OIL_BALANCE_PALETTE: RGBA[] = [
  [62, 110, 152, 242], // strong net importer
  [37, 64, 92, 242],
  [20, 30, 43, 242], // balanced
  [108, 80, 42, 242],
  [200, 146, 62, 242], // strong net exporter
]

const GAS_BALANCE_PALETTE: RGBA[] = [
  [62, 110, 152, 242],
  [37, 64, 92, 242],
  [20, 30, 43, 242],
  [28, 88, 86, 242],
  [70, 172, 162, 242],
]

const NO_DATA_COLOR: RGBA = [13, 22, 33, 242]

const METRIC_CONFIG: Record<CountryMetricKey, MetricConfig> = {
  oil_balance: {
    label: 'Net Balance (Prod − Cons)',
    shortLabel: 'Balance',
    palette: OIL_BALANCE_PALETTE,
    family: 'diverging',
    unit: 'mt',
  },
  gas_balance: {
    label: 'Net Balance (Prod − Cons)',
    shortLabel: 'Balance',
    palette: GAS_BALANCE_PALETTE,
    family: 'diverging',
    unit: 'bcm',
  },
  dependency_score: {
    label: 'Import Dependency',
    shortLabel: 'Dependency',
    palette: RISK_PALETTE,
    family: 'ratio',
    unit: 'none',
  },
  production_oil_mt: {
    label: 'Crude Production',
    shortLabel: 'Production',
    palette: VOLUME_PALETTE,
    family: 'volume',
    unit: 'mt',
  },
  import_oil_mt: {
    label: 'Crude Imports',
    shortLabel: 'Imports',
    palette: VOLUME_PALETTE,
    family: 'volume',
    unit: 'mt',
  },
  export_oil_mt: {
    label: 'Crude Exports',
    shortLabel: 'Exports',
    palette: VOLUME_PALETTE,
    family: 'volume',
    unit: 'mt',
  },
  consumption_oil_mt: {
    label: 'Crude Consumption',
    shortLabel: 'Consumption',
    palette: VOLUME_PALETTE,
    family: 'volume',
    unit: 'mt',
  },
  refining_capacity_mt: {
    label: 'Refining Capacity',
    shortLabel: 'Refining',
    palette: VOLUME_PALETTE,
    family: 'volume',
    unit: 'mt',
  },
  resilience_score: {
    label: 'Resilience Score',
    shortLabel: 'Resilience',
    palette: RESILIENCE_PALETTE,
    family: 'score',
    unit: 'none',
  },
  dependency_score_gas: {
    label: 'Gas Import Dependency',
    shortLabel: 'Dependency',
    palette: RISK_PALETTE,
    family: 'ratio',
    unit: 'none',
  },
  production_gas_bcm: {
    label: 'Gas Production',
    shortLabel: 'Production',
    palette: GAS_VOLUME_PALETTE,
    family: 'volume',
    unit: 'bcm',
  },
  import_gas_bcm: {
    label: 'Gas Imports',
    shortLabel: 'Imports',
    palette: GAS_VOLUME_PALETTE,
    family: 'volume',
    unit: 'bcm',
  },
  export_gas_bcm: {
    label: 'Gas Exports',
    shortLabel: 'Exports',
    palette: GAS_VOLUME_PALETTE,
    family: 'volume',
    unit: 'bcm',
  },
  consumption_gas_bcm: {
    label: 'Gas Consumption',
    shortLabel: 'Consumption',
    palette: GAS_VOLUME_PALETTE,
    family: 'volume',
    unit: 'bcm',
  },
}

const OIL_METRICS: CountryMetricKey[] = [
  'oil_balance',
  'production_oil_mt',
  'consumption_oil_mt',
  'import_oil_mt',
  'export_oil_mt',
  'refining_capacity_mt',
  'dependency_score',
  'resilience_score',
]

const GAS_METRICS: CountryMetricKey[] = [
  'gas_balance',
  'production_gas_bcm',
  'consumption_gas_bcm',
  'import_gas_bcm',
  'export_gas_bcm',
  'dependency_score_gas',
]

export function getMetricOptions(commodity: Commodity) {
  const keys = commodity === 'gas' ? GAS_METRICS : OIL_METRICS
  return keys.map(key => ({ key, label: METRIC_CONFIG[key].label }))
}

export function getMetricConfig(metric: CountryMetricKey) {
  return METRIC_CONFIG[metric]
}

export function getCountryMetricValue(country: CountryMetricDatum, metric: CountryMetricKey): number {
  // Computed metrics: net balance = what the country pumps minus what it burns
  if (metric === 'oil_balance') return country.production_oil_mt - country.consumption_oil_mt
  if (metric === 'gas_balance') return country.production_gas_bcm - country.consumption_gas_bcm
  const value = country[metric]
  return typeof value === 'number' ? value : 0
}

export function formatMetricValue(metric: CountryMetricKey, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'No data'
  const config = METRIC_CONFIG[metric]
  if (config.family === 'ratio') return `${Math.round(value * 100)}%`
  if (config.family === 'score') return `${Math.round(value)}/100`
  const sign = config.family === 'diverging' && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)} ${config.unit === 'bcm' ? 'bcm/yr' : 'Mt/yr'}`
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
    .filter(value =>
      Number.isFinite(value) && (config.family === 'diverging' ? value !== 0 : value > 0),
    )

  const maxAbs = values.length > 0 ? Math.max(...values.map(Math.abs)) : 1
  const thresholds =
    config.family === 'diverging'
      ? [-0.35 * maxAbs, -0.03 * maxAbs, 0.03 * maxAbs, 0.35 * maxAbs]
      : config.family === 'volume'
      ? computeQuantiles(values, config.palette.length)
      : config.family === 'score'
      ? [20, 40, 60, 80]
      : [0.2, 0.4, 0.6, 0.8]

  const legendItems = config.palette.map((color, index) => {
    const min =
      (index === 0
        ? config.family === 'diverging'
          ? -maxAbs
          : 0
        : thresholds[index - 1]) ?? 0
    const max = thresholds[index] ?? (values.length > 0 ? Math.max(...values) : 0)
    return {
      color,
      label: formatLegendRange(metric, min, max),
    }
  })

  // Diverging metrics: zero is a real value (balanced), not missing data
  const isNoData = (value: number | null | undefined): boolean => {
    if (value == null || !Number.isFinite(value)) return true
    return config.family === 'diverging' ? false : value <= 0
  }

  return {
    label: config.label,
    shortLabel: config.shortLabel,
    legendItems: [...legendItems, { color: NO_DATA_COLOR, label: 'No data' }],
    getColor: value => {
      if (isNoData(value)) return NO_DATA_COLOR
      const bucket = thresholds.findIndex(threshold => value! <= threshold)
      return config.palette[bucket === -1 ? config.palette.length - 1 : bucket]
    },
    getBucketLabel: value => {
      if (isNoData(value)) return 'No data'
      const bucket = thresholds.findIndex(threshold => value! <= threshold)
      return legendItems[bucket === -1 ? legendItems.length - 1 : bucket].label
    },
  }
}
