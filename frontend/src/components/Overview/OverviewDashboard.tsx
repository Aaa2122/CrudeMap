import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChokepoints } from '../../api/hooks/useChokepoints'
import { useCountries } from '../../api/hooks/useCountries'
import { useFieldsData } from '../../api/hooks/useFields'
import { useFlows } from '../../api/hooks/useFlows'
import { useInfrastructures } from '../../api/hooks/useInfrastructures'
import { useMapStore } from '../../store/mapStore'
import { accentHex, riskColor, ui } from '../../uiTheme'
import { MeterBar, Pill } from '../Panels/panelKit'

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
}

/** "System Overview" tab — KPIs, top corridors, chokepoint risk board. */
export function OverviewDashboard() {
  const { commodity, setSelected } = useMapStore()
  const { data: countries } = useCountries()
  const { data: flows } = useFlows(commodity)
  const { data: infras } = useInfrastructures()
  const { data: fields } = useFieldsData()
  const { data: chokepoints } = useChokepoints()

  const isGas = commodity === 'gas'
  const unit = isGas ? 'bcm/yr' : 'Mt/yr'
  const accent = accentHex(commodity)

  const volumeOf = (flow: { volume_mt: number; volume_bcm: number | null }) =>
    isGas ? flow.volume_bcm ?? 0 : flow.volume_mt

  const stats = useMemo(() => {
    const productionTotal = (countries ?? []).reduce(
      (sum, c) => sum + (isGas ? c.production_gas_bcm : c.production_oil_mt),
      0,
    )
    const tradeTotal = (flows ?? []).reduce((sum, f) => sum + volumeOf(f), 0)
    const commodityInfra = (infras ?? []).filter(i =>
      isGas ? i.commodity === 'gas' : i.commodity !== 'gas',
    )
    return {
      productionTotal,
      tradeTotal,
      flowCount: (flows ?? []).length,
      infraCount: commodityInfra.length,
      pipelineCount: commodityInfra.filter(i => i.type === 'pipeline').length,
      fieldCount: (fields ?? []).filter(f => f.commodity === 'mixed' || (isGas ? f.commodity === 'gas' : f.commodity === 'oil')).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, flows, infras, fields, isGas])

  const topCorridors = useMemo(
    () =>
      [...(flows ?? [])]
        .sort((a, b) => volumeOf(b) - volumeOf(a))
        .slice(0, 10)
        .map(f => ({
          name: `${f.source_iso} → ${f.target_iso}`,
          volume: Number(volumeOf(f).toFixed(1)),
          mode: f.transport_mode,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flows, isGas],
  )

  const topProducers = useMemo(
    () =>
      [...(countries ?? [])]
        .sort((a, b) =>
          (isGas ? b.production_gas_bcm : b.production_oil_mt) -
          (isGas ? a.production_gas_bcm : a.production_oil_mt),
        )
        .slice(0, 8),
    [countries, isGas],
  )

  const rankedChokepoints = useMemo(
    () => [...(chokepoints ?? [])].sort((a, b) => b.oil_transit_mbd - a.oil_transit_mbd),
    [chokepoints],
  )

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-[1200px] space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi label={`World ${commodity} production`} value={stats.productionTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit={unit} />
          <Kpi label="Tracked trade volume" value={stats.tradeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit={unit} />
          <Kpi label="Trade flows" value={String(stats.flowCount)} unit="routes" />
          <Kpi label="Infrastructure assets" value={String(stats.infraCount)} unit="tracked" />
          <Kpi label="Pipelines traced" value={String(stats.pipelineCount)} unit="routes" />
          <Kpi label="Producing fields" value={String(stats.fieldCount)} unit="mapped" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top corridors */}
          <section className="rounded-card border border-border bg-surface p-5 shadow-float">
            <h2 className="text-[13px] font-semibold text-text">
              Top {commodity} trade corridors
            </h2>
            <div className="mt-3 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCorridors} layout="vertical" margin={{ left: 18, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fill: ui.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={86}
                    tick={{ fill: ui.ink, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [`${value} ${unit}`, 'Volume']}
                  />
                  <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                    {topCorridors.map(entry => (
                      <Cell key={entry.name} fill={entry.mode === 'pipeline' ? ui.neutral : accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[11px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: accent }} /> Seaborne
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: ui.neutral }} /> Pipeline
              </span>
            </div>
          </section>

          {/* Chokepoint risk board */}
          <section className="rounded-card border border-border bg-surface p-5 shadow-float">
            <h2 className="text-[13px] font-semibold text-text">
              Maritime chokepoint risk
            </h2>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="section-label">
                  <th className="pb-2 font-medium">Chokepoint</th>
                  <th className="pb-2 text-right font-medium">Oil transit</th>
                  <th className="pb-2 text-right font-medium">World trade</th>
                  <th className="pb-2 text-right font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {rankedChokepoints.map(cp => (
                  <tr
                    key={cp.slug}
                    onClick={() => setSelected({ type: 'chokepoint', slug: cp.slug })}
                    className="cursor-pointer border-t border-border text-text transition-colors hover:bg-inset"
                  >
                    <td className="py-1.5 font-medium">{cp.name}</td>
                    <td className="py-1.5 text-right font-mono text-text-muted">{cp.oil_transit_mbd} Mb/d</td>
                    <td className="py-1.5 text-right font-mono text-text-muted">{cp.pct_world_trade}%</td>
                    <td className="py-1.5 text-right">
                      <Pill color={riskColor(cp.risk_level)}>{cp.risk_level}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Top producers */}
          <section className="rounded-card border border-border bg-surface p-5 shadow-float">
            <h2 className="text-[13px] font-semibold text-text">
              Top {commodity} producers
            </h2>
            <div className="mt-3 space-y-1.5">
              {topProducers.map(c => {
                const value = isGas ? c.production_gas_bcm : c.production_oil_mt
                const max = isGas ? topProducers[0]?.production_gas_bcm : topProducers[0]?.production_oil_mt
                return (
                  <button
                    key={c.iso}
                    onClick={() => setSelected({ type: 'country', iso: c.iso })}
                    className="-mx-1 flex w-[calc(100%+8px)] items-center gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-inset"
                  >
                    <span className="w-9 font-mono text-[10px] text-text-muted">{c.iso}</span>
                    <span className="w-32 truncate text-xs text-text">{c.name}</span>
                    <MeterBar pct={(value / (max || 1)) * 100} color={accent} />
                    <span className="w-20 text-right font-mono text-[10px] text-text-muted">
                      {value.toFixed(0)} {isGas ? 'bcm' : 'Mt'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Net balance leaders */}
          <section className="rounded-card border border-border bg-surface p-5 shadow-float">
            <h2 className="text-[13px] font-semibold text-text">
              Largest net {commodity} importers
            </h2>
            <div className="mt-3 space-y-1.5">
              {[...(countries ?? [])]
                .map(c => ({
                  c,
                  deficit: isGas
                    ? c.consumption_gas_bcm - c.production_gas_bcm
                    : c.consumption_oil_mt - c.production_oil_mt,
                }))
                .filter(x => x.deficit > 0)
                .sort((a, b) => b.deficit - a.deficit)
                .slice(0, 8)
                .map(({ c, deficit }, _i, arr) => (
                  <button
                    key={c.iso}
                    onClick={() => setSelected({ type: 'country', iso: c.iso })}
                    className="-mx-1 flex w-[calc(100%+8px)] items-center gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-inset"
                  >
                    <span className="w-9 font-mono text-[10px] text-text-muted">{c.iso}</span>
                    <span className="w-32 truncate text-xs text-text">{c.name}</span>
                    <MeterBar pct={(deficit / (arr[0]?.deficit || 1)) * 100} color={ui.blue} />
                    <span className="w-20 text-right font-mono text-[10px] text-text-muted">
                      −{deficit.toFixed(0)} {isGas ? 'bcm' : 'Mt'}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-float">
      <div className="text-[11px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-text">{value}</div>
      {unit && <div className="text-[11px] text-text-muted">{unit}</div>}
    </div>
  )
}
