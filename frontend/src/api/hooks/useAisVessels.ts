import { useEffect, useRef, useState } from 'react'
import { apiClient, wsBase } from '../client'
import type { LiveVessel } from '../../components/Map/aisVessel'
import { useMapStore } from '../../store/mapStore'

interface AisMessage {
  mmsi: number
  name: string | null
  type: number | null
  lon: number
  lat: number
  sog: number
  cog: number
  heading: number | null
  dest: [number, number] | null
  dest_name: string | null
  ts: number
}

/**
 * Subscribes to the backend AIS relay. Returns a live vessel map (keyed by
 * MMSI) updated in place, plus connection status via the store. Falls back
 * silently when the backend has no key or is unreachable.
 */
export function useAisVessels(): { vessels: Map<number, LiveVessel> } {
  const vesselsRef = useRef<Map<number, LiveVessel>>(new Map())
  const [, forceTick] = useState(0)
  const setAisStatus = useMapStore(s => s.setAisStatus)

  useEffect(() => {
    let enabled = false
    apiClient
      .get('/ais/status')
      .then(res => {
        enabled = Boolean(res.data?.enabled)
        setAisStatus({ enabled, connected: false, count: res.data?.vessel_count ?? 0 })
      })
      .catch(() => setAisStatus({ enabled: false, connected: false, count: 0 }))

    let ws: WebSocket | null = null
    let closed = false
    let retry = 1000

    const connect = () => {
      if (closed) return
      ws = new WebSocket(`${wsBase()}/api/v1/ais/stream`)
      ws.onopen = () => {
        retry = 1000
        setAisStatus({ enabled: true, connected: true, count: vesselsRef.current.size })
      }
      ws.onmessage = event => {
        const m: AisMessage = JSON.parse(event.data)
        const prev = vesselsRef.current.get(m.mmsi)
        vesselsRef.current.set(m.mmsi, {
          mmsi: m.mmsi,
          name: m.name,
          type: m.type,
          lon: m.lon,
          lat: m.lat,
          sog: m.sog,
          cog: m.cog,
          heading: m.heading,
          dest: m.dest,
          destName: m.dest_name,
          lastSeenMs: Date.now(),
          firstSeenPos: prev?.firstSeenPos ?? [m.lon, m.lat],
        })
      }
      ws.onclose = () => {
        setAisStatus({ enabled, connected: false, count: vesselsRef.current.size })
        if (!closed) {
          setTimeout(connect, retry)
          retry = Math.min(retry * 2, 30000)
        }
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    // Re-render consumers ~4x/sec so the layer re-reads positions
    const tick = setInterval(() => forceTick(t => t + 1), 250)

    return () => {
      closed = true
      clearInterval(tick)
      ws?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { vessels: vesselsRef.current }
}
