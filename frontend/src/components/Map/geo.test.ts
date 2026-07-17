import { describe, expect, it } from 'vitest'
import { advanceAlongRoute, buildGreatCircleRoute, distKm } from './geo'

describe('geo', () => {
  it('distKm is ~111km per degree of latitude', () => {
    expect(distKm([0, 0], [0, 1])).toBeCloseTo(111.19, 0)
  })

  it('buildGreatCircleRoute densifies and keeps endpoints', () => {
    const route = buildGreatCircleRoute([[0, 0], [0, 10]], 200)
    expect(route[0]).toEqual([0, 0])
    expect(route[route.length - 1][1]).toBeCloseTo(10, 3)
    expect(route.length).toBeGreaterThan(3)
  })

  it('advanceAlongRoute walks the given distance', () => {
    const route: [number, number][] = [[0, 0], [0, 1], [0, 2]] // ~222 km total
    const { position } = advanceAlongRoute(route, 111.19)
    expect(position[1]).toBeCloseTo(1, 1)
    expect(position[0]).toBeCloseTo(0, 3)
  })

  it('advanceAlongRoute clamps to the last point when overshooting', () => {
    const route: [number, number][] = [[0, 0], [0, 1]]
    const { position } = advanceAlongRoute(route, 10_000)
    expect(position[1]).toBeCloseTo(1, 3)
  })
})
