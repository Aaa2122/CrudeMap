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

const RISK_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#64a1bb',
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
  const accent = isGas ? '#22d3ee' : '#f59e0b'

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
          <Kpi label={`World ${commodity} production`} value={stats.productionTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit={unit} accent={accent} />
          <Kpi label="Tracked trade volume" value={stats.tradeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit={unit} accent={accent} />
          <Kpi label="Trade flows" value={String(stats.flowCount)} unit="routes" accent={accent} />
          <Kpi label="Infrastructure assets" value={String(stats.infraCount)} unit="tracked" accent={accent} />
          <Kpi label="Pipelines traced" value={String(stats.pipelineCount)} unit="routes" accent={accent} />
          <Kpi label="Producing fields" value={String(stats.fieldCount)} unit="mapped" accent={accent} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top corridors */}
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Top {commodity} trade corridors
            </h2>
            <div className="mt-3 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCorridors} layout="vertical" margin={{ left: 18, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={86}
                    tick={{ fill: '#e2e8f0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ background: '#162631', border: '1px solid #2e546b', borderRadius: 4, fontSize: 12 }}
                    formatter={(value: number) => [`${value} ${unit}`, 'Volume']}
                  />
                  <Bar dataKey="volume" radius={[0, 3, 3, 0]}>
                    {topCorridors.map(entry => (
                      <Cell key={entry.name} fill={entry.mode === 'pipeline' ? '#10b981' : accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: accent }} /> Seaborne
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#10b981]" /> Pipeline
              </span>
            </div>
          </section>

          {/* Chokepoint risk board */}
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Maritime chokepoint risk
            </h2>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-text-muted">
                  <th className="pb-2 font-bold">Chokepoint</th>
                  <th className="pb-2 text-right font-bold">Oil transit</th>
                  <th className="pb-2 text-right font-bold">World trade</th>
                  <th className="pb-2 text-right font-bold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {rankedChokepoints.map(cp => (
                  <tr
                    key={cp.slug}
                    onClick={() => setSelected({ type: 'chokepoint', slug: cp.slug })}
                    className="cursor-pointer border-t border-border/60 text-text transition-colors hover:bg-white/5"
                  >
                    <td className="py-1.5 font-medium">{cp.name}</td>
                    <td className="py-1.5 text-right font-mono text-text-muted">{cp.oil_transit_mbd} Mb/d</td>
                    <td className="py-1.5 text-right font-mono text-text-muted">{cp.pct_world_trade}%</td>
                    <td className="py-1.5 text-right">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${RISK_COLOR[cp.risk_level]}22`, color: RISK_COLOR[cp.risk_level] }}
                      >
                        {cp.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Top producers */}
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
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
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span className="w-9 font-mono text-[10px] text-text-muted">{c.iso}</span>
                    <span className="w-32 truncate text-xs text-text">{c.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(value / (max || 1)) * 100}%`, background: accent }}
                      />
                    </span>
                    <span className="w-20 text-right font-mono text-[10px] text-text-muted">
                      {value.toFixed(0)} {isGas ? 'bcm' : 'Mt'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Net balance leaders */}
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
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
                .map(({ c, deficit }, i, arr) => (
                  <button
                    key={c.iso}
                    onClick={() => setSelected({ type: 'country', iso: c.iso })}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span className="w-9 font-mono text-[10px] text-text-muted">{c.iso}</span>
                    <span className="w-32 truncate text-xs text-text">{c.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                      <span
                        className="block h-full rounded-full bg-[#3E6E98]"
                        style={{ width: `${(deficit / (arr[0]?.deficit || 1)) * 100}%` }}
                      />
                    </span>
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

function Kpi({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: string }) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      {unit && <div className="text-[10px] text-text-muted">{unit}</div>}
    </div>
  )
}
