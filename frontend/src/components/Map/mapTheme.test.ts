import { describe, expect, it } from 'vitest'
import { ALERT, GAS, OIL, accentFor, flowWidth, toCss, withAlpha } from './mapTheme'

describe('mapTheme', () => {
  it('uses the light-theme accents (soft copper, blue-green, soft red)', () => {
    expect(OIL.slice(0, 3)).toEqual([183, 122, 75])
    expect(GAS.slice(0, 3)).toEqual([74, 155, 170])
    expect(ALERT.slice(0, 3)).toEqual([222, 91, 78])
  })

  it('withAlpha replaces only the alpha channel', () => {
    expect(withAlpha(OIL, 40)).toEqual([183, 122, 75, 40])
  })

  it('accentFor maps commodity to its accent, defaulting to oil', () => {
    expect(accentFor('gas')).toBe(GAS)
    expect(accentFor('oil')).toBe(OIL)
    expect(accentFor('products')).toBe(OIL)
  })

  it('toCss renders a css rgba() string', () => {
    expect(toCss([183, 122, 75, 255])).toBe('rgba(183, 122, 75, 1)')
  })

  it('flowWidth is thin, monotonic and capped', () => {
    expect(flowWidth(0)).toBeCloseTo(0.5)
    expect(flowWidth(50)).toBeGreaterThan(flowWidth(5))
    expect(flowWidth(100000)).toBeLessThanOrEqual(2.1)
  })
})
