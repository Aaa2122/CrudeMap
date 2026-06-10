export type Commodity = 'oil' | 'gas'

export interface CountryBrief {
  iso: string
  name: string
  region: string | null
  role: string | null
  lat: number | null
  lon: number | null
  importance_score: number
  resilience_score: number
  dependency_score: number
  dependency_score_gas: number
  supplier_hhi: number
  production_oil_mt: number
  import_oil_mt: number
  export_oil_mt: number
  consumption_oil_mt: number
  refining_capacity_mt: number
  production_gas_bcm: number
  import_gas_bcm: number
  export_gas_bcm: number
  consumption_gas_bcm: number
  data_level: string
}

export interface CountryDetail extends CountryBrief {
  source: string | null
  source_year: number | null
  confidence: string | null
}

export interface Flow {
  id: number
  source_iso: string
  target_iso: string
  commodity: Commodity
  transport_mode: 'seaborne' | 'pipeline'
  volume_mt: number
  volume_bcm: number | null
  via_chokepoints: string[]
  year: number
  source: string | null
  confidence: string | null
}

export interface ChokepointBrief {
  slug: string
  name: string
  lat: number | null
  lon: number | null
  oil_transit_mbd: number
  pct_world_trade: number
  risk_level: string
}

export interface ExposedCountry {
  iso: string
  name: string
  exposure: number
  import_volume_mt: number
}

export interface ChokepointDetail extends ChokepointBrief {
  source: string | null
  source_year: number | null
  exposed_countries: ExposedCountry[]
}

export interface Infrastructure {
  id: number
  name: string
  type: string | null
  subtype: string | null
  country_iso: string | null
  operator: string | null
  commodity: string
  capacity_mt: number
  capacity_bcm: number | null
  status: string
  criticality_score: number
  lat: number | null
  lon: number | null
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null
  source: string | null
  confidence: string | null
}

export interface OilGasField {
  id: number
  name: string
  country_iso: string | null
  commodity: string
  field_type: string | null
  production_mt: number | null
  production_bcm: number | null
  discovered_year: number | null
  status: string
  operator: string | null
  lat: number | null
  lon: number | null
  source: string | null
  confidence: string | null
}

export interface ScenarioBrief {
  slug: string
  name: string
  description: string | null
  scenario_type: string | null
}

export interface ScenarioImpact {
  country_iso: string
  stress_score: number
  volume_lost_mt: number
  cost_increase_pct: number
  can_reroute: boolean
  baseline_import_mt: number
}

export interface ScenarioResult {
  slug: string
  name: string
  impacts: ScenarioImpact[]
  disrupted_flow_ids: number[]
}

// Map selection types
export type SelectableEntity =
  | { type: 'country'; iso: string }
  | { type: 'chokepoint'; slug: string }
  | { type: 'infrastructure'; id: number }
  | { type: 'field'; id: number }
  | null

export type CountryMetricKey =
  | 'oil_balance' // computed: production - consumption (Mt/yr)
  | 'dependency_score'
  | 'production_oil_mt'
  | 'import_oil_mt'
  | 'export_oil_mt'
  | 'consumption_oil_mt'
  | 'refining_capacity_mt'
  | 'resilience_score'
  | 'gas_balance' // computed: production - consumption (bcm/yr)
  | 'dependency_score_gas'
  | 'production_gas_bcm'
  | 'import_gas_bcm'
  | 'export_gas_bcm'
  | 'consumption_gas_bcm'

export type FlowMode = 'selected' | 'top20'

// Static GeoJSON shapes (frontend/public/geo/)
export interface ShippingLaneProps {
  name: string
  teu_m: number
  rank: number
}

export interface ContainerPortProps {
  name: string
  country_iso: string
  teu_m: number
  rank: number
}
