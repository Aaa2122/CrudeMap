import type { FlowMode, CountryMetricKey } from '../../api/types'
import type { MetricScale } from './countryMetrics'

interface Props {
  metric: CountryMetricKey
  scale: MetricScale
  flowMode: FlowMode | 'off'
  selectedCountryName?: string | null
}

export function MetricLegend({ metric, scale, flowMode, selectedCountryName }: Props) {
  const flowLabel =
    flowMode === 'off'
      ? 'Flows hidden'
      : flowMode === 'selected'
      ? selectedCountryName
        ? `Flows: ${selectedCountryName}`
        : 'Flows: top 20 preview'
      : 'Flows: top 20 routes'

  return (
    <div className="absolute left-4 bottom-4 z-40 w-[250px] rounded border border-border bg-surface/95 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-text-muted">Metric</div>
          <div className="text-sm font-semibold text-text">{scale.label}</div>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-primary">{scale.shortLabel}</div>
      </div>

      <div className="mt-2 space-y-1.5">
        {scale.legendItems.map(item => (
          <div key={`${item.label}-${item.color.join('-')}`} className="flex items-center gap-2 text-[10px] text-text-muted">
            <span
              className="inline-block h-2.5 w-4 rounded-sm border border-white/10"
              style={{
                backgroundColor: `rgba(${item.color[0]}, ${item.color[1]}, ${item.color[2]}, ${item.color[3] / 255})`,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 border-t border-border pt-2 text-[10px] uppercase tracking-wide text-text-muted">
        {flowLabel}
      </div>
    </div>
  )
}
