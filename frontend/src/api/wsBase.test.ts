import { describe, expect, it } from 'vitest'
import { wsBase } from './client'

describe('wsBase', () => {
  it('maps http(s) base to ws(s)', () => {
    // default base is http://localhost:8000 in tests
    expect(wsBase()).toBe('ws://localhost:8000')
  })
})
