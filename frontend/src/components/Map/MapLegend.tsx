import type { CountryMetricKey } from '../../api/types'
import { useMapStore } from '../../store/mapStore'
import { getMetricOptions, type MetricScale } from './countryMetrics'

interface Props {
  scale: MetricScale
  flowsLabel: string
}

interface KeyRow {
  label: string
  color: string
  shape: 'dot' | 'line' | 'dash'
}

function rgba(color: [number, number, number, number]): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`
}

/** Bottom-left map key: metric selector + ramp + active-layer legend. */
export function MapLegend({ scale, flowsLabel }: Props) {
  const { commodity, layers, selectedMetric, setSelectedMetric } = useMapStore()
  const accent = commodity === 'gas' ? '#46C8DC' : '#DCA54A'

  const keyRows: KeyRow[] = []
  if (layers.flows) {
    keyRows.push({ label: 'Trade flows · particles = direction', color: accent, shape: 'line' })
  }
  if (layers.vessels && layers.flows) {
    keyRows.push({
      label: commodity === 'gas' ? 'LNG carriers · simulated live' : 'Tankers · simulated live',
      color: commodity === 'gas' ? '#9FE8F2' : '#F2CE8C',
      shape: 'dot',
    })
  }
  if (layers.pipelines) {
    keyRows.push(
      commodity === 'gas'
        ? { label: 'Gas pipelines · offline = grey', color: '#46C8DC', shape: 'dash' }
        : { label: 'Crude pipelines', color: '#3EA080', shape: 'line' },
    )
  }
  if (layers.terminals && commodity === 'oil') keyRows.push({ label: 'Terminals & ports', color: '#DCA54A', shape: 'dot' })
  if (layers.lngTerminals && commodity === 'gas') keyRows.push({ label: 'LNG terminals', color: '#46C8DC', shape: 'dot' })
  if (layers.refineries && commodity === 'oil') keyRows.push({ label: 'Refineries', color: '#CB6E90', shape: 'dot' })
  if (layers.fields) {
    keyRows.push(
      commodity === 'gas'
        ? { label: 'Gas fields · zoom in', color: '#DD9658', shape: 'dot' }
        : { label: 'Oil fields · zoom in', color: '#97C166', shape: 'dot' },
    )
  }
  if (layers.chokepoints) keyRows.push({ label: 'Chokepoints · size = risk', color: '#D9544D', shape: 'dot' })
  if (layers.shippingLanes) keyRows.push({ label: 'Container corridors · width = TEU', color: '#608EC4', shape: 'line' })

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
          <span key={item.color.join('-')} className="flex-1" style={{ backgroundColor: rgba(item.color) }} />
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
