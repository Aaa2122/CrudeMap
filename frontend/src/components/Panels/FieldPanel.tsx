import { useField } from '../../api/hooks/useFields'
import { useMapStore } from '../../store/mapStore'

const STATUS_COLOR: Record<string, string> = {
  producing: '#22c55e',
  declining: '#f97316',
  developing: '#38bdf8',
}

const TYPE_LABEL: Record<string, string> = {
  conventional: 'Conventional',
  shale: 'Shale / tight',
  offshore: 'Offshore',
  oil_sands: 'Oil sands',
  condensate: 'Gas condensate',
}

interface Props {
  id: number
}

export function FieldPanel({ id }: Props) {
  const { data: field, isLoading } = useField(id)
  const { setSelected } = useMapStore()

  if (isLoading || !field) {
    return <div className="p-4 text-text-muted text-sm">Loading…</div>
  }

  const statusColor = STATUS_COLOR[field.status] ?? '#64748b'
  const isGas = field.commodity === 'gas'

  return (
    <div className="p-4 space-y-4 text-text text-sm overflow-y-auto">
      <div>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold">{field.name}</h2>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded capitalize"
            style={{ background: statusColor + '22', color: statusColor }}
          >
            {field.status}
          </span>
        </div>
        <p className="text-text-muted text-xs mt-0.5">
          {isGas ? 'Gas field' : field.commodity === 'mixed' ? 'Oil & gas field' : 'Oil field'} ·{' '}
          {TYPE_LABEL[field.field_type ?? ''] ?? field.field_type}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {field.production_mt != null && field.production_mt > 0 && (
          <Stat label="Oil production" value={`${field.production_mt.toFixed(0)} Mt/yr`} />
        )}
        {field.production_bcm != null && field.production_bcm > 0 && (
          <Stat label="Gas production" value={`${field.production_bcm.toFixed(0)} bcm/yr`} />
        )}
        <Stat label="Discovered" value={field.discovered_year ? String(field.discovered_year) : '—'} />
        <Stat label="Operator" value={field.operator ?? '—'} />
        {field.country_iso && (
          <button
            onClick={() => setSelected({ type: 'country', iso: field.country_iso! })}
            className="bg-bg border border-border rounded p-2 text-left hover:border-primary/50 transition-colors"
          >
            <div className="text-[10px] text-text-muted uppercase">Country</div>
            <div className="text-sm font-medium text-primary">{field.country_iso}</div>
          </button>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>info</span>
          {field.source} · {field.confidence} confidence
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg border border-border rounded p-2">
      <div className="text-[10px] text-text-muted uppercase">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  )
}
