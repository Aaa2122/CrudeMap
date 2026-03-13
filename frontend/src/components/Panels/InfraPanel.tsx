import useSWR from 'swr'
import { apiClient } from '../../api/client'
import type { Infrastructure } from '../../api/types'
import { useMapStore } from '../../store/mapStore'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

interface Props { id: number }

export function InfraPanel({ id }: Props) {
  const { data: infra, isLoading } = useSWR<Infrastructure>(`/infrastructures/${id}`, fetcher)
  const { setSelected } = useMapStore()

  if (isLoading || !infra) {
    return <div className="p-4 text-text-muted text-sm">Loading…</div>
  }

  const statusColor = infra.status === 'active' ? '#22c55e' : infra.status === 'limited' ? '#f97316' : '#ef4444'
  const critColor = infra.criticality_score >= 70 ? '#ef4444' : infra.criticality_score >= 40 ? '#f97316' : '#22c55e'

  return (
    <div className="p-4 space-y-4 text-text text-sm overflow-y-auto">
      <div>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold">{infra.name}</h2>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded capitalize"
            style={{ background: statusColor + '22', color: statusColor }}
          >
            {infra.status}
          </span>
        </div>
        <p className="text-text-muted text-xs mt-0.5">
          {infra.type} · {infra.subtype}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Capacity" value={infra.capacity_mt > 0 ? `${infra.capacity_mt} Mt/yr` : 'N/A'} />
        <Stat label="Criticality" value={`${infra.criticality_score}/100`} valueColor={critColor} />
        <Stat label="Operator" value={infra.operator ?? '—'} />
        {infra.country_iso && (
          <button
            onClick={() => setSelected({ type: 'country', iso: infra.country_iso! })}
            className="bg-bg border border-border rounded p-2 text-left hover:border-primary/50 transition-colors"
          >
            <div className="text-[10px] text-text-muted uppercase">Country</div>
            <div className="text-sm font-medium text-primary">{infra.country_iso}</div>
          </button>
        )}
      </div>

      {/* Criticality bar */}
      <div>
        <div className="text-[10px] text-text-muted uppercase mb-1">Criticality score</div>
        <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${infra.criticality_score}%`, background: critColor }}
          />
        </div>
      </div>

      {/* Data provenance */}
      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>info</span>
          {infra.source} · {infra.confidence} confidence
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-bg border border-border rounded p-2">
      <div className="text-[10px] text-text-muted uppercase">{label}</div>
      <div className="text-sm font-medium break-words" style={valueColor ? { color: valueColor } : {}}>{value}</div>
    </div>
  )
}
