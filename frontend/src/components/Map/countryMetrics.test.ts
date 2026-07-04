import { describe, expect, it } from 'vitest'
import { NO_DATA } from './mapTheme'
import { buildMetricScale, getCountryMetricValue } from './countryMetrics'

const country = (over: Record<string, number>) =>
  ({
    iso: 'XXX',
    name: 'X',
    production_oil_mt: 0,
    consumption_oil_mt: 0,
    production_gas_bcm: 0,
    consumption_gas_bcm: 0,
    ...over,
  } as any)

describe('countryMetrics after restyle', () => {
  it('oil balance is production minus consumption', () => {
    expect(
      getCountryMetricValue(country({ production_oil_mt: 500, consumption_oil_mt: 200 }), 'oil_balance'),
    ).toBe(300)
  })

  it('diverging scale treats zero as data, not no-data', () => {
    const scale = buildMetricScale(
      [country({ production_oil_mt: 100 }), country({ consumption_oil_mt: 100 })],
      'oil_balance',
    )
    expect(scale.getColor(0)).not.toEqual(NO_DATA)
    expect(scale.getColor(null)).toEqual(NO_DATA)
  })

  it('volume scale uses the mapTheme NO_DATA token for missing values', () => {
    const scale = buildMetricScale([country({ production_oil_mt: 10 })], 'production_oil_mt')
    expect(scale.getColor(null)).toEqual(NO_DATA)
    expect(scale.getColor(0)).toEqual(NO_DATA)
  })
})
