import { useField } from '../../api/hooks/useFields'
import { useMapStore } from '../../store/mapStore'
import { InsetGroup, InsetRow, Pill } from './panelKit'
import { statusColor, ui } from '../../uiTheme'

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
    return <div className="p-5 text-sm text-text-muted">Loading…</div>
  }

  const isGas = field.commodity === 'gas'

  return (
    <div className="space-y-4 overflow-y-auto px-5 pb-5 text-sm text-text">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">{field.name}</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {isGas ? 'Gas field' : field.commodity === 'mixed' ? 'Oil & gas field' : 'Oil field'} ·{' '}
            {TYPE_LABEL[field.field_type ?? ''] ?? field.field_type}
          </p>
        </div>
        <Pill color={statusColor(field.status)}>{field.status}</Pill>
      </div>

      <InsetGroup>
        {field.production_mt != null && field.production_mt > 0 && (
          <InsetRow label="Oil production" value={`${field.production_mt.toFixed(0)} Mt/yr`} />
        )}
        {field.production_bcm != null && field.production_bcm > 0 && (
          <InsetRow label="Gas production" value={`${field.production_bcm.toFixed(0)} bcm/yr`} />
        )}
        <InsetRow label="Discovered" value={field.discovered_year ? String(field.discovered_year) : '—'} />
        <InsetRow label="Operator" value={field.operator ?? '—'} />
        {field.country_iso && (
          <InsetRow
            label="Country"
            value={field.country_iso}
            valueColor={ui.blue}
            onClick={() => setSelected({ type: 'country', iso: field.country_iso! })}
          />
        )}
      </InsetGroup>

      <p className="flex items-center gap-1 border-t border-border pt-3 text-[11px] text-text-muted">
        <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>info</span>
        {field.source} · {field.confidence} confidence
      </p>
    </div>
  )
}
