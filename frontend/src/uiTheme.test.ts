import { describe, expect, it } from 'vitest'
import { accentHex, pastel, riskColor, statusColor, ui } from './uiTheme'

describe('uiTheme', () => {
  it('derives accent hexes from mapTheme (single source of truth)', () => {
    expect(ui.oil).toBe('#b77a4b')
    expect(ui.gas).toBe('#4a9baa')
    expect(ui.alert).toBe('#de5b4e')
  })

  it('accentHex follows commodity, defaulting to oil', () => {
    expect(accentHex('gas')).toBe(ui.gas)
    expect(accentHex('oil')).toBe(ui.oil)
    expect(accentHex('products')).toBe(ui.oil)
  })

  it('risk and status map to the calm palette', () => {
    expect(riskColor('critical')).toBe(ui.alert)
    expect(riskColor('low')).toBe(ui.safe)
    expect(riskColor('nope')).toBe(ui.neutral)
    expect(statusColor('active')).toBe(ui.safe)
    expect(statusColor('offline')).toBe(ui.alert)
  })

  it('pastel gives a 12% background with full-strength text', () => {
    expect(pastel('#de5b4e')).toEqual({ background: '#de5b4e1f', color: '#de5b4e' })
  })
})
