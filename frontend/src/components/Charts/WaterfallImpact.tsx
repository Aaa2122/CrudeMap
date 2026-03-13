import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { ScenarioImpact } from '../../api/types'

interface Props {
  impact: ScenarioImpact
  baseline_import_mt: number
}

export function WaterfallImpact({ impact, baseline_import_mt }: Props) {
  const remaining = Math.max(0, baseline_import_mt - impact.volume_lost_mt)

  const data = [
    { name: 'Baseline', value: baseline_import_mt, fill: '#22c55e' },
    { name: 'Lost', value: impact.volume_lost_mt, fill: '#ef4444' },
    { name: 'Remaining', value: remaining, fill: '#f59e0b' },
  ]

  return (
    <div className="space-y-3">
      {/* Metric pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Metric label="Stress" value={`${Math.round(impact.stress_score)}/100`} color={stressColor(impact.stress_score)} />
        <Metric label="Vol. lost" value={`${impact.volume_lost_mt} Mt`} color="#ef4444" />
        <Metric label="Cost" value={`+${impact.cost_increase_pct}%`} color="#f97316" />
        <Metric label="Reroute" value={impact.can_reroute ? 'Partial' : 'No'} color={impact.can_reroute ? '#22c55e' : '#ef4444'} />
      </div>

      {/* Waterfall bar chart */}
      {baseline_import_mt > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={36} />
            <Tooltip
              contentStyle={{ background: '#162631', border: '1px solid #2e546b', fontSize: 11 }}
              formatter={(v: number) => [`${v.toFixed(1)} Mt`, '']}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center bg-bg border border-border rounded px-3 py-1.5 min-w-[60px]">
      <span className="text-[10px] text-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

function stressColor(score: number): string {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f97316'
  return '#22c55e'
}
