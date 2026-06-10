import type { Commodity } from '../../api/types'
import { useMapStore } from '../../store/mapStore'

const OPTIONS: { key: Commodity; label: string; color: string }[] = [
  { key: 'oil', label: 'Oil', color: '#DCA54A' },
  { key: 'gas', label: 'Gas', color: '#46C8DC' },
]

/** Primary mode switch: the whole map (flows, infra, metrics) follows it. */
export function CommodityToggle() {
  const { commodity, setCommodity } = useMapStore()

  return (
    <div className="flex items-center rounded-sm border border-border p-px">
      {OPTIONS.map(option => {
        const active = commodity === option.key
        return (
          <button
            key={option.key}
            onClick={() => setCommodity(option.key)}
            className={`h-6 px-3 font-mono text-[10px] uppercase tracking-caps transition-colors ${
              active ? 'font-semibold text-bg' : 'text-text-muted hover:text-text'
            }`}
            style={active ? { background: option.color } : {}}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
