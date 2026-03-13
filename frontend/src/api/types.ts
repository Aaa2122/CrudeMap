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
  supplier_hhi: number
  data_level: string
}

export interface CountryDetail extends CountryBrief {
  production_oil_mt: number
  import_oil_mt: number
  export_oil_mt: number
  consumption_oil_mt: number
  refining_capacity_mt: number
  source: string | null
  source_year: number | null
  confidence: string | null
}

export interface Flow {
  id: number
  source_iso: string
  target_iso: string
  volume_mt: number
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
  capacity_mt: number
  status: string
  criticality_score: number
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
  | null
