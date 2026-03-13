import { useChokepoint, useChokepoints } from '../../api/hooks/useChokepoints'
import { useFlows } from '../../api/hooks/useFlows'
import { useScenarioStore } from '../../store/scenarioStore'
import { useMapStore } from '../../store/mapStore'

const RISK_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
}

interface Props { slug: string }

export function ChokepointPanel({ slug }: Props) {
  const { data: choke, isLoading } = useChokepoint(slug)
  const { data: allChokepoints } = useChokepoints()
  const { data: allFlows } = useFlows()
  const { result: scenarioResult } = useScenarioStore()
  const { setSelected } = useMapStore()

  if (isLoading || !choke) {
    return <div className="p-4 text-text-muted text-sm">Loading…</div>
  }

  const riskColor = RISK_COLOR[choke.risk_level] ?? '#64748b'

  // Criticality rank among all chokepoints
  const rank = allChokepoints
    ? [...allChokepoints]
        .sort((a, b) => b.pct_world_trade - a.pct_world_trade)
        .findIndex(c => c.slug === slug) + 1
    : null

  // Flows traversing this chokepoint
  const traversingFlows = (allFlows ?? []).filter(f =>
    f.via_chokepoints?.includes(slug)
  )
  const totalTraversingVolume = traversingFlows.reduce((s, f) => s + f.volume_mt, 0)

  return (
    <div className="p-4 space-y-4 text-text text-sm overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold">{choke.name}</h2>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded capitalize"
            style={{ background: riskColor + '22', color: riskColor }}
          >
            {choke.risk_level}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="Transit" value={`${choke.oil_transit_mbd} Mb/d`} />
          <Stat label="World trade" value={`${choke.pct_world_trade}%`} />
          <Stat label="Rank" value={rank ? `#${rank}` : '—'} />
        </div>
      </div>

      {/* Traversing flows */}
      <Divider label={`FLOWS TRAVERSING (${traversingFlows.length})`} />
      <div className="bg-bg border border-border rounded p-2">
        <div className="text-[10px] text-text-muted uppercase mb-1">Total volume via {choke.name}</div>
        <div className="text-lg font-bold text-primary">{totalTraversingVolume.toFixed(1)} Mt/yr</div>
      </div>
      {traversingFlows.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {traversingFlows
            .sort((a, b) => b.volume_mt - a.volume_mt)
            .slice(0, 10)
            .map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="text-text-muted w-16 shrink-0">{f.source_iso} → {f.target_iso}</span>
                <div className="flex-1 bg-bg rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber"
                    style={{ width: `${Math.min((f.volume_mt / (traversingFlows[0]?.volume_mt || 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-text-muted w-12 text-right">{f.volume_mt} Mt</span>
              </div>
            ))}
        </div>
      )}

      {/* Exposed countries */}
      <Divider label={`EXPOSED COUNTRIES (${choke.exposed_countries.length})`} />
      <div className="space-y-1">
        {choke.exposed_countries.slice(0, 15).map(c => (
          <button
            key={c.iso}
            onClick={() => setSelected({ type: 'country', iso: c.iso })}
            className="w-full flex items-center gap-2 hover:bg-bg/50 px-1 py-0.5 rounded transition-colors"
          >
            <span className="w-8 text-xs font-mono text-text-muted">{c.iso}</span>
            <div className="flex-1 bg-bg rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(c.exposure * 100)}%`, background: riskColor }}
              />
            </div>
            <span className="text-xs text-text-muted w-10 text-right">
              {Math.round(c.exposure * 100)}%
            </span>
          </button>
        ))}
      </div>

      {/* Data provenance */}
      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>info</span>
          {choke.source} · {choke.source_year}
        </p>
      </div>

      {/* Scenario hint */}
      {scenarioResult && (
        <div className="bg-disrupted/10 border border-disrupted/30 rounded p-2 text-xs text-disrupted">
          Scenario active — click exposed countries to see impact.
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg border border-border rounded p-2">
      <div className="text-[10px] text-text-muted uppercase">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
      <span>{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}
