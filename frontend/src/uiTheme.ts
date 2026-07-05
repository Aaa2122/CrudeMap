/**
 * Hex color tokens for React surfaces and recharts. Accents are DERIVED
 * from mapTheme so the map and the UI can never disagree. Components must
 * import from here instead of hardcoding hex literals.
 */
import { ALERT, GAS, OIL, type RGBA } from './components/Map/mapTheme'

function hex(color: RGBA): string {
  return (
    '#' +
    color
      .slice(0, 3)
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

export const ui = {
  oil: hex(OIL),
  gas: hex(GAS),
  alert: hex(ALERT),
  safe: '#3e9e6e',
  blue: '#4e7ca6', // data blue (importers, developing)
  orange: '#e08d4c', // warning mid-tone (limited, high risk)
  ink: '#1d1d1f',
  muted: '#6e6e73',
  axis: '#9a9aa0', // chart axis ticks
  grid: 'rgba(0,0,0,0.06)',
  neutral: '#8e98a2', // neutral data series
  inset: '#f2f2f4',
  hairline: 'rgba(0,0,0,0.08)',
} as const

export function accentHex(commodity: string): string {
  return commodity === 'gas' ? ui.gas : ui.oil
}

export function riskColor(level: string): string {
  if (level === 'critical') return ui.alert
  if (level === 'high') return ui.orange
  if (level === 'low') return ui.safe
  return ui.neutral
}

export function statusColor(status: string): string {
  if (status === 'active' || status === 'producing') return ui.safe
  if (status === 'limited' || status === 'declining') return ui.orange
  if (status === 'offline') return ui.alert
  if (status === 'developing') return ui.blue
  return ui.neutral
}

/** Pastel badge style: 12% tint background, full-strength text. */
export function pastel(color: string): { background: string; color: string } {
  return { background: `${color}1f`, color }
}
