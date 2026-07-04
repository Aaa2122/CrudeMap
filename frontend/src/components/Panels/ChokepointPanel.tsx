import { useChokepoint, useChokepoints } from '../../api/hooks/useChokepoints'
import { useFlows } from '../../api/hooks/useFlows'
import { useMapStore } from '../../store/mapStore'
import { InsetGroup, InsetRow, MeterBar, Pill, SectionLabel } from './panelKit'
import { riskColor, ui } from '../../uiTheme'

interface Props { slug: string }

export function ChokepointPanel({ slug }: Props) {
  const { data: choke, isLoading } = useChokepoint(slug)
  const { data: allChokepoints } = useChokepoints()
  const { data: allFlows } = useFlows()
  const { setSelected } = useMapStore()

  if (isLoading || !choke) {
    return <div className="p-5 text-sm text-text-muted">Loading…</div>
  }

  const riskCol = riskColor(choke.risk_level)

  // Criticality rank among all chokepoints
  const rank = allChokepoints
    ? [...allChokepoints]
        .sort((a, b) => b.pct_world_trade - a.pct_world_trade)
        .findIndex(c => c.slug === slug) + 1
    : null

  // Flows traversing this chokepoint
  const traversingFlows = (allFlows ?? []).filter(f => f.via_chokepoints?.includes(slug))
  const totalTraversingVolume = traversingFlows.reduce((s, f) => s + f.volume_mt, 0)

  return (
    <div className="space-y-4 overflow-y-auto px-5 pb-5 text-sm text-text">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h2 className="text-[17px] font-semibold tracking-tight">{choke.name}</h2>
        <Pill color={riskCol}>{choke.risk_level}</Pill>
      </div>

      <InsetGroup>
        <InsetRow label="Oil transit" value={`${choke.oil_transit_mbd} Mb/d`} />
        <InsetRow label="Share of world trade" value={`${choke.pct_world_trade}%`} />
        <InsetRow label="Criticality rank" value={rank ? `#${rank}` : '—'} />
        <InsetRow label={`Volume via ${choke.name}`} value={`${totalTraversingVolume.toFixed(1)} Mt/yr`} valueColor={ui.ink} />
      </InsetGroup>

      {/* Traversing flows */}
      {traversingFlows.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Flows traversing ({traversingFlows.length})</SectionLabel>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {traversingFlows
              .sort((a, b) => b.volume_mt - a.volume_mt)
              .slice(0, 10)
              .map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[11px]">
                  <span className="w-16 shrink-0 text-text-muted">{f.source_iso} → {f.target_iso}</span>
                  <MeterBar pct={(f.volume_mt / (traversingFlows[0]?.volume_mt || 1)) * 100} color={ui.oil} />
                  <span className="w-12 text-right font-mono text-text-muted">{f.volume_mt} Mt</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Exposed countries */}
      <div className="space-y-1.5">
        <SectionLabel>Exposed countries ({choke.exposed_countries.length})</SectionLabel>
        <div className="space-y-1">
          {choke.exposed_countries.slice(0, 15).map(c => (
            <button
              key={c.iso}
              onClick={() => setSelected({ type: 'country', iso: c.iso })}
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-inset"
            >
              <span className="w-8 shrink-0 text-left font-mono text-[11px] text-text-muted">{c.iso}</span>
              <MeterBar pct={Math.round(c.exposure * 100)} color={riskCol} />
              <span className="w-10 text-right font-mono text-[11px] text-text-muted">
                {Math.round(c.exposure * 100)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Data provenance */}
      <p className="flex items-center gap-1 border-t border-border pt-3 text-[11px] text-text-muted">
        <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>info</span>
        {choke.source} · {choke.source_year}
      </p>
    </div>
  )
}
