import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Flow } from '../../api/types'
import { ui } from '../../uiTheme'

interface Props {
  flows: Flow[]
  targetIso: string
}

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
}

export function SupplierBar({ flows, targetIso }: Props) {
  const inflows = flows.filter(f => f.target_iso === targetIso)
  const total = inflows.reduce((s, f) => s + f.volume_mt, 0)
  if (total === 0) return <p className="text-text-muted text-xs">No import data</p>

  const data = inflows
    .sort((a, b) => b.volume_mt - a.volume_mt)
    .slice(0, 7)
    .map(f => ({
      name: f.source_iso,
      pct: Math.round((f.volume_mt / total) * 100),
      mt: f.volume_mt,
    }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: ui.axis, fontSize: 10 }} unit="%" />
        <YAxis type="category" dataKey="name" tick={{ fill: ui.ink, fontSize: 11 }} width={36} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, _: string, p: any) => [`${v}% (${p.payload.mt} Mt)`, 'Share']}
        />
        <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === 0 ? ui.oil : `${ui.oil}${Math.round((0.75 - i * 0.08) * 255).toString(16).padStart(2, '0')}`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
