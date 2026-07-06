import { describe, expect, it } from 'vitest'
import { vesselPosition, type Vessel } from './vesselFleet'

function mkVessel(routeKm: number, over: Partial<Vessel> = {}): Vessel {
  const path: [number, number][] = [[0, 0], [10, 0]]
  return {
    id: 'x', name: 'T', vclass: 'VLCC', dwt: '~300,000 dwt', cargo: 'crude oil',
    flow: { flow: {} as any, path, timestamps: [0, 1000] },
    phase: 0, isDisrupted: false, routeKm, speedKn: 13,
    ...over,
  } as Vessel
}

describe('vesselPosition credibility', () => {
  it('advances along the route as wall-clock time passes', () => {
    const v = mkVessel(100_000) // long enough not to loop in this window
    const p1 = vesselPosition(v, 10).progress
    const p2 = vesselPosition(v, 20).progress
    expect(p2).toBeGreaterThan(p1)
  })

  it('constant ground speed: a longer route covers a smaller fraction in the same time', () => {
    // 50 s of travel is < 1000 km, so neither route has looped yet
    const short = vesselPosition(mkVessel(1000), 50).progress
    const long = vesselPosition(mkVessel(4000), 50).progress
    expect(long).toBeLessThan(short)
    // ~4x longer route => ~1/4 the fraction covered
    expect(short / long).toBeCloseTo(4, 1)
  })

  it('disrupted vessels hold position regardless of time', () => {
    const v = mkVessel(1000, { isDisrupted: true, phase: 0.3 })
    expect(vesselPosition(v, 100).progress).toBeCloseTo(0.3)
    expect(vesselPosition(v, 999_999).progress).toBeCloseTo(0.3)
  })
})
