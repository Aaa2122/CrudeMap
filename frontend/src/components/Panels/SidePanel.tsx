import { useMapStore } from '../../store/mapStore'
import { CountryPanel } from './CountryPanel'
import { ChokepointPanel } from './ChokepointPanel'
import { InfraPanel } from './InfraPanel'
import { FieldPanel } from './FieldPanel'

export function SidePanel() {
  const { selected, clearSelected } = useMapStore()

  if (!selected) return null

  return (
    <div className="absolute top-0 right-0 h-full w-[372px] bg-surface/95 border-l border-border flex flex-col z-40 shadow-2xl shadow-black/60 backdrop-blur">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="caps-label !text-text font-mono">
          {selected.type === 'country' && `country / ${selected.iso}`}
          {selected.type === 'chokepoint' && `chokepoint / ${selected.slug}`}
          {selected.type === 'infrastructure' && `asset / ${selected.id}`}
          {selected.type === 'field' && `field / ${selected.id}`}
        </span>
        <button
          onClick={clearSelected}
          className="text-text-muted hover:text-text transition-colors text-lg leading-none"
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
