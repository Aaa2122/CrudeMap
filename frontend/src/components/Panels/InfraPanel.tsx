import useSWR from 'swr'
import { apiClient } from '../../api/client'
import type { Infrastructure } from '../../api/types'
import { useMapStore } from '../../store/mapStore'
import { InsetGroup, InsetRow, MeterBar, Pill, SectionLabel } from './panelKit'
import { statusColor, ui } from '../../uiTheme'

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

interface Props { id: number }

export function InfraPanel({ id }: Props) {
  const { data: infra, isLoading } = useSWR<Infrastructure>(`/infrastructures/${id}`, fetcher)
  const { setSelected } = useMapStore()

  if (isLoading || !infra) {
    return <div className="p-5 text-sm text-text-muted">Loading…</div>
  }

  const statusCol = statusColor(infra.status)
  const critColor = infra.criticality_score >= 70 ? ui.alert : infra.criticality_score >= 40 ? ui.orange : ui.safe

  const capacity = infra.capacity_bcm
    ? `${infra.capacity_bcm} bcm/yr`
    : infra.capacity_mt > 0
    ? `${infra.capacity_mt} Mt/yr`
    : 'N/A'

  return (
    <div className="space-y-4 overflow-y-auto px-5 pb-5 text-sm text-text">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">{infra.name}</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">{infra.type} · {infra.subtype}</p>
        </div>
        <Pill color={statusCol}>{infra.status}</Pill>
      </div>

      <InsetGroup>
        <InsetRow label="Capacity" value={capacity} />
        {infra.geometry?.coordinates && (
          <InsetRow label="Route length" value={`~${formatPipelineLength(infra.geometry.coordinates)} km`} />
        )}
        <InsetRow label="Criticality" value={`${infra.criticality_score}/100`} valueColor={critColor} />
        <InsetRow label="Operator" value={infra.operator ?? '—'} />
        {infra.country_iso && (
          <InsetRow
            label="Country"
            value={infra.country_iso}
            valueColor={ui.blue}
            onClick={() => setSelected({ type: 'country', iso: infra.country_iso! })}
          />
        )}
      </InsetGroup>

      {/* Criticality bar */}
      <div className="space-y-1.5">
        <SectionLabel>Criticality score</SectionLabel>
        <div className="flex items-center gap-2.5">
          <MeterBar pct={infra.criticality_score} color={critColor} />
          <span className="w-9 text-right font-mono text-[11px]" style={{ color: critColor }}>{infra.criticality_score}</span>
        </div>
      </div>

      {/* Data provenance */}
      <p className="flex items-center gap-1 border-t border-border pt-3 text-[11px] text-text-muted">
        <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>info</span>
        {infra.source} · {infra.confidence} confidence
      </p>
    </div>
  )
}

function formatPipelineLength(coordinates: [number, number][]): string {
  let total = 0
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lon1, lat1] = coordinates[i - 1]
    const [lon2, lat2] = coordinates[i]
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
    total += 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
  }
  return Math.round(total / 50) * 50 >= 1000
    ? `${(Math.round(total / 50) * 50).toLocaleString()}`
    : `${Math.round(total / 50) * 50}`
}
