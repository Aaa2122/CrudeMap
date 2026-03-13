import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CHOKEPOINT_LABELS: Record<string, string> = {
  hormuz: 'Hormuz',
  malacca: 'Malacca',
  suez: 'Suez',
  sumed: 'SUMED',
  bab_el_mandeb: 'Bab el-M.',
  turkish_straits: 'Turkish Str.',
  panama: 'Panama',
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22d3ee', '#818cf8', '#e879f9']

interface Props {
  exposure: Record<string, number>
}

export function RouteDonut({ exposure }: Props) {
  const entries = Object.entries(exposure)
    .filter(([, v]) => v > 0.01)
    .sort(([, a], [, b]) => b - a)
    .map(([slug, pct], i) => ({
      name: CHOKEPOINT_LABELS[slug] ?? slug,
      value: Math.round(pct * 100),
      color: COLORS[i % COLORS.length],
    }))

  // Add "Direct/Other" if total < 100%
  const total = entries.reduce((s, e) => s + e.value, 0)
  if (total < 95) {
    entries.push({ name: 'Direct/Other', value: 100 - total, color: '#334155' })
  }

  if (entries.length === 0) {
    return <p className="text-text-muted text-xs">No route data</p>
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={entries}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={65}
          dataKey="value"
          paddingAngle={2}
        >
          {entries.map((e, i) => <Cell key={i} fill={e.color} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#111118', border: '1px solid #1f1f2e', fontSize: 11 }}
          formatter={(v: number) => [`${v}%`, 'Via']}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, color: '#94a3b8' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
