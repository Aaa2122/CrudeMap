import { describe, expect, it } from 'vitest'
import { ALERT, GAS, OIL, accentFor, flowWidth, toCss, withAlpha } from './mapTheme'

describe('mapTheme', () => {
  it('keeps the existing brand accents (oil amber, gas cyan, alert red)', () => {
    expect(OIL.slice(0, 3)).toEqual([220, 165, 74])
    expect(GAS.slice(0, 3)).toEqual([70, 200, 220])
    expect(ALERT.slice(0, 3)).toEqual([217, 84, 77])
  })

  it('withAlpha replaces only the alpha channel', () => {
    expect(withAlpha(OIL, 40)).toEqual([220, 165, 74, 40])
  })

  it('accentFor maps commodity to its accent, defaulting to oil', () => {
    expect(accentFor('gas')).toBe(GAS)
    expect(accentFor('oil')).toBe(OIL)
    expect(accentFor('products')).toBe(OIL)
  })

  it('toCss renders a css rgba() string', () => {
    expect(toCss([220, 165, 74, 255])).toBe('rgba(220, 165, 74, 1)')
  })

  it('flowWidth is thin, monotonic and capped', () => {
    expect(flowWidth(0)).toBeCloseTo(0.5)
    expect(flowWidth(50)).toBeGreaterThan(flowWidth(5))
    expect(flowWidth(100000)).toBeLessThanOrEqual(2.1)
  })
})
