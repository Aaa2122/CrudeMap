import type { Commodity, CountryBrief, CountryDetail, CountryMetricKey } from '../../api/types'
import { NO_DATA } from './mapTheme'

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

// Light map: ramps run pale → saturated-soft. Alpha 242 everywhere.
const VOLUME_PALETTE: RGBA[] = [
  [227, 233, 239, 242],
  [186, 201, 216, 242],
  [141, 166, 192, 242],
  [104, 136, 166, 242],
  [78, 124, 166, 242],
]

const RISK_PALETTE: RGBA[] = [
  [239, 238, 234, 242],
  [233, 203, 193, 242],
  [229, 166, 150, 242],
  [226, 128, 113, 242],
  [222, 91, 78, 242],
]

const RESILIENCE_PALETTE: RGBA[] = [
  [239, 238, 234, 242],
  [200, 222, 208, 242],
  [157, 201, 175, 242],
  [107, 175, 140, 242],
  [62, 158, 110, 242],
]

const SCORE_PALETTE: RGBA[] = [
  [231, 235, 240, 242],
  [192, 204, 217, 242],
  [150, 172, 193, 242],
  [110, 142, 170, 242],
  [84, 120, 152, 242],
]

// Teal ramp for natural gas volumes — visually distinct from the oil blue ramp
const GAS_VOLUME_PALETTE: RGBA[] = [
  [226, 237, 238, 242],
  [178, 209, 212, 242],
  [128, 178, 184, 242],
  [90, 150, 158, 242],
  [62, 141, 155, 242],
]

// Diverging ramps for net balance (production − consumption):
// importer blue <- near-white neutral -> exporter in the commodity hue
const OIL_BALANCE_PALETTE: RGBA[] = [
  [78, 124, 166, 242], // strong net importer (data blue)
  [150, 175, 199, 242],
  [239, 238, 234, 242], // balanced (near-white)
  [209, 178, 148, 242],
  [183, 122, 75, 242], // strong net exporter (copper)
]

const GAS_BALANCE_PALETTE: RGBA[] = [
  [78, 124, 166, 242],
  [150, 175, 199, 242],
  [239, 238, 234, 242],
  [156, 196, 201, 242],
  [62, 141, 155, 242], // strong net exporter (blue-green)
]

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
    legendItems: [...legendItems, { color: NO_DATA, label: 'No data' }],
    getColor: value => {
      if (isNoData(value)) return NO_DATA
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
