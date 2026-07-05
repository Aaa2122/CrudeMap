import { beforeEach, describe, expect, it } from 'vitest'
import { distKm } from './geo'
import { FADE_DURATION_MS, LIVE_TTL_MS, clearRouteCache, vesselDisplayState, type LiveVessel } from './aisVessel'

function vessel(over: Partial<LiveVessel> = {}): LiveVessel {
  return {
    mmsi: 1, name: 'T', type: 80, lon: 55, lat: 25, sog: 12, cog: 90, heading: 90,
    dest: [4.1, 51.95], destName: 'Rotterdam', lastSeenMs: 0, firstSeenPos: [55, 25],
    ...over,
  }
}

describe('vesselDisplayState', () => {
  beforeEach(() => clearRouteCache())

  it('is live at the real position when fresh', () => {
    const d = vesselDisplayState(vessel(), LIVE_TTL_MS - 1000)
    expect(d.mode).toBe('live')
    expect(d.position).toEqual([55, 25])
    expect(d.opacity).toBe(1)
  })

  it('projects further along its route the longer it stays dark', () => {
    const start: [number, number] = [55, 25]
    const twoHours = vesselDisplayState(vessel(), LIVE_TTL_MS + 2 * 3_600_000)
    const sixHours = vesselDisplayState(vessel(), LIVE_TTL_MS + 6 * 3_600_000)
    expect(twoHours.mode).toBe('projected')
    expect(twoHours.opacity).toBeLessThan(1)
    // advances along the sea route: farther from the last known position over time
    const d2 = distKm(start, twoHours.position)
    const d6 = distKm(start, sixHours.position)
    expect(d2).toBeGreaterThan(0)
    expect(d6).toBeGreaterThan(d2)
  })

  it('fades when stale with no destination', () => {
    const d = vesselDisplayState(vessel({ dest: null }), LIVE_TTL_MS + FADE_DURATION_MS / 2)
    expect(d.mode).toBe('faded')
    expect(d.opacity).toBeGreaterThan(0)
    expect(d.opacity).toBeLessThan(1)
    const gone = vesselDisplayState(vessel({ dest: null }), LIVE_TTL_MS + FADE_DURATION_MS + 1000)
    expect(gone.opacity).toBe(0)
  })
})
