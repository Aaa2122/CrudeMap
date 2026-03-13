import { useScenarioStore } from '../../store/scenarioStore'
import { useMapStore } from '../../store/mapStore'

function stressColor(score: number) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f97316'
  return '#22c55e'
}

export function SimulationResults() {
  const { result, activeSlug } = useScenarioStore()
  const { setSelected } = useMapStore()

  if (!result || !activeSlug) return null

  const impacted = result.impacts.filter(i => i.stress_score > 0)
  const topImpacted = impacted.slice(0, 10)
  const totalVolLost = impacted.reduce((s, i) => s + i.volume_lost_mt, 0)
  const avgStress = impacted.length > 0
    ? Math.round(impacted.reduce((s, i) => s + i.stress_score, 0) / impacted.length)
    : 0

  return (
    <div className="absolute top-4 left-4 bg-surface border border-border rounded shadow-xl w-56 z-40 text-text text-xs">
      <div className="px-3 py-2 border-b border-border bg-white/5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Impact Ranking</p>
        <p className="text-xs font-semibold truncate mt-0.5">{result.name}</p>
      </div>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-px bg-border/50 border-b border-border">
        <div className="bg-surface px-2 py-1.5 text-center">
          <div className="text-[9px] text-text-muted uppercase">Countries</div>
          <div className="text-sm font-bold text-disrupted">{impacted.length}</div>
        </div>
        <div className="bg-surface px-2 py-1.5 text-center">
          <div className="text-[9px] text-text-muted uppercase">Vol. lost</div>
          <div className="text-sm font-bold text-disrupted">{totalVolLost.toFixed(1)}</div>
        </div>
        <div className="bg-surface px-2 py-1.5 text-center">
          <div className="text-[9px] text-text-muted uppercase">Avg stress</div>
          <div className="text-sm font-bold" style={{ color: stressColor(avgStress) }}>{avgStress}</div>
        </div>
      </div>
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {topImpacted.map(impact => (
          <button
            key={impact.country_iso}
            onClick={() => setSelected({ type: 'country', iso: impact.country_iso })}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg transition-colors"
          >
            <span className="font-mono text-[11px] text-text-muted w-8">{impact.country_iso}</span>
            <div className="flex-1 bg-bg rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${impact.stress_score}%`,
                  background: stressColor(impact.stress_score),
                }}
              />
            </div>
            <span style={{ color: stressColor(impact.stress_score) }} className="w-8 text-right font-semibold">
              {Math.round(impact.stress_score)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
