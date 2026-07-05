import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

/** WebSocket origin derived from the REST base (http→ws, https→wss). */
export function wsBase(): string {
  return BASE_URL.replace(/^http/, 'ws')
}
