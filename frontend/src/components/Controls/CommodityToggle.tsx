import type { Commodity } from '../../api/types'
import { useMapStore } from '../../store/mapStore'
import { ui } from '../../uiTheme'

const OPTIONS: { key: Commodity; label: string; color: string }[] = [
  { key: 'oil', label: 'Oil', color: ui.oil },
  { key: 'gas', label: 'Gas', color: ui.gas },
]

/** Primary mode switch, iOS-segmented-control style. */
export function CommodityToggle() {
  const { commodity, setCommodity } = useMapStore()

  return (
    <div className="flex items-center rounded-full bg-inset p-0.5">
      {OPTIONS.map(option => {
        const active = commodity === option.key
        return (
          <button
            key={option.key}
            onClick={() => setCommodity(option.key)}
            className={`flex h-7 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-all ${
              active ? 'bg-surface text-text shadow-float' : 'text-text-muted hover:text-text'
            }`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: option.color, opacity: active ? 1 : 0.45 }}
            />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
