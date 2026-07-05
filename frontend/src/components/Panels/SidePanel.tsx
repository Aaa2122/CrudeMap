import { useMapStore } from '../../store/mapStore'
import { CountryPanel } from './CountryPanel'
import { ChokepointPanel } from './ChokepointPanel'
import { InfraPanel } from './InfraPanel'
import { FieldPanel } from './FieldPanel'

export function SidePanel() {
  const { selected, clearSelected } = useMapStore()

  if (!selected) return null

  return (
    <div className="absolute top-4 right-4 bottom-4 z-40 flex w-[380px] flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-float">
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
          {selected.type === 'country' && `country / ${selected.iso}`}
          {selected.type === 'chokepoint' && `chokepoint / ${selected.slug}`}
          {selected.type === 'infrastructure' && `asset / ${selected.id}`}
          {selected.type === 'field' && `field / ${selected.id}`}
        </span>
        <button
          onClick={clearSelected}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-inset hover:text-text"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto">
        {selected.type === 'country' && <CountryPanel iso={selected.iso} />}
        {selected.type === 'chokepoint' && <ChokepointPanel slug={selected.slug} />}
        {selected.type === 'infrastructure' && <InfraPanel id={selected.id} />}
        {selected.type === 'field' && <FieldPanel id={selected.id} />}
      </div>
    </div>
  )
}
