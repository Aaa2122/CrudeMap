import { describe, expect, it } from 'vitest'
import { GAS, NEUTRAL_MARK, NEUTRAL_MARK_DIM, OIL } from './mapTheme'
import { TYPE_COLOR, infraColor, infraIconKey } from './iconAtlas'

describe('geometric icon atlas', () => {
  it('maps infra rows to icon keys unchanged', () => {
    expect(infraIconKey({ type: 'lng_terminal', subtype: 'export_terminal' })).toBe('lng_export')
    expect(infraIconKey({ type: 'lng_terminal', subtype: null })).toBe('lng_import')
    expect(infraIconKey({ type: 'refinery', subtype: null })).toBe('refinery')
    expect(infraIconKey({ type: 'port', subtype: null })).toBe('port')
    expect(infraIconKey({ type: 'terminal', subtype: null })).toBe('terminal')
  })

  it('uses only the 3-accent budget: oil hue, gas hue, neutrals', () => {
    const allowedHues = new Set(
      [OIL, GAS, NEUTRAL_MARK, NEUTRAL_MARK_DIM].map(c => c.slice(0, 3).join(',')),
    )
    for (const [key, color] of Object.entries(TYPE_COLOR)) {
      if (key === 'chokepoint') continue // alert red allowed
      expect(allowedHues.has(color.slice(0, 3).join(',')), `hue of ${key}`).toBe(true)
    }
  })

  it('offline status dims the mark', () => {
    const online = infraColor({ type: 'terminal', subtype: null, status: 'active' })
    const offline = infraColor({ type: 'terminal', subtype: null, status: 'offline' })
    expect(offline[3]).toBeLessThan(online[3])
  })
})
