import type { CountryMetricKey } from '../../api/types'
import { useMapStore } from '../../store/mapStore'
import { getMetricOptions, type MetricScale } from './countryMetrics'
import { ALERT, GAS, NEUTRAL_MARK, NEUTRAL_MARK_DIM, OIL, accentFor, toCss, withAlpha } from './mapTheme'

interface Props {
  scale: MetricScale
  flowsLabel: string
}

interface KeyRow {
  label: string
  color: string
  shape: 'dot' | 'line' | 'dash'
}

/** Bottom-left map key: metric selector + ramp + active-layer legend. */
export function MapLegend({ scale, flowsLabel }: Props) {
  const { commodity, layers, selectedMetric, setSelectedMetric } = useMapStore()
  const accent = toCss(accentFor(commodity))

  const keyRows: KeyRow[] = []
  if (layers.flows) {
    keyRows.push({ label: 'Trade flows · particles = direction', color: accent, shape: 'line' })
  }
  if (layers.vessels && layers.flows) {
    keyRows.push({
      label: commodity === 'gas' ? 'LNG carriers · simulated live' : 'Tankers · simulated live',
      color: accent,
      shape: 'dot',
    })
  }
  if (layers.pipelines) {
    keyRows.push(
      commodity === 'gas'
        ? { label: 'Gas pipelines · dashed', color: toCss(NEUTRAL_MARK), shape: 'dash' }
        : { label: 'Crude pipelines', color: toCss(NEUTRAL_MARK), shape: 'line' },
    )
  }
  if (layers.terminals && commodity === 'oil') {
    keyRows.push({ label: 'Terminals · ports (ring)', color: toCss(OIL), shape: 'dot' })
  }
  if (layers.lngTerminals && commodity === 'gas') {
    keyRows.push({ label: 'LNG terminals', color: toCss(GAS), shape: 'dot' })
  }
  if (layers.refineries && commodity === 'oil') {
    keyRows.push({ label: 'Refineries (square)', color: toCss(NEUTRAL_MARK), shape: 'dot' })
  }
  if (layers.fields) {
    keyRows.push(
      commodity === 'gas'
        ? { label: 'Gas fields · zoom in', color: toCss(GAS), shape: 'dot' }
        : { label: 'Oil fields · zoom in', color: toCss(OIL), shape: 'dot' },
    )
  }
  if (layers.chokepoints) {
    keyRows.push({ label: 'Chokepoints · red = critical', color: toCss(withAlpha(ALERT, 235)), shape: 'dot' })
  }
  if (layers.shippingLanes) {
    keyRows.push({ label: 'Container corridors · width = TEU', color: toCss(NEUTRAL_MARK_DIM), shape: 'line' })
  }

  return (
    <div className="terminal-card absolute left-4 bottom-4 z-40 w-[248px] rounded-sm px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="caps-label">Choropleth</span>
        <span className="font-mono text-[9px] uppercase tracking-caps" style={{ color: accent }}>
          {commodity}
        </span>
      </div>

      <select
        value={selectedMetric}
        onChange={e => setSelectedMetric(e.target.value as CountryMetricKey)}
        className="mt-1.5 w-full appearance-none rounded-sm border border-border bg-bg/70 px-2 py-1 text-[12px] font-medium text-text focus:border-primary/60 focus:outline-none"
      >
        {getMetricOptions(commodity).map(option => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>

      {/* Compact color ramp */}
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-sm">
        {scale.legendItems.slice(0, -1).map(item => (
          <span key={item.color.join('-')} className="flex-1" style={{ backgroundColor: toCss(item.color) }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-text-muted">
        <span>{scale.legendItems[0]?.label.split(' - ')[0]}</span>
        <span>{scale.legendItems[scale.legendItems.length - 2]?.label.split(' - ').pop()}</span>
      </div>

      {keyRows.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
          {keyRows.map(row => (
            <div key={row.label} className="flex items-center gap-2 text-[10px] text-text-muted">
              {row.shape === 'dot' ? (
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.color }} />
              ) : (
                <span
                  className="inline-block h-px w-4"
                  style={{
                    backgroundColor: row.shape === 'dash' ? 'transparent' : row.color,
                    backgroundImage:
                      row.shape === 'dash'
                        ? `repeating-linear-gradient(90deg, ${row.color} 0 4px, transparent 4px 7px)`
                        : undefined,
                    height: row.shape === 'dash' ? '1px' : undefined,
                  }}
                />
              )}
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 border-t border-border pt-2 font-mono text-[9px] uppercase tracking-caps text-text-muted">
        {flowsLabel}
      </div>
    </div>
  )
}
