import { useState } from 'react'
import type { LayerKey } from '../../store/mapStore'
import { useMapStore } from '../../store/mapStore'
import { ui } from '../../uiTheme'

interface LayerRow {
  key: LayerKey
  label: string
  color: string
  count?: number
}

interface LayerGroup {
  title: string
  rows: LayerRow[]
}

interface Props {
  counts: Partial<Record<LayerKey, number>>
}

/** Compact, collapsed-by-default layer control (top-left). */
export function LayersPanel({ counts }: Props) {
  const { layers, toggleLayer, commodity, aisStatus } = useMapStore()
  const [open, setOpen] = useState(false)

  const isGas = commodity === 'gas'
  const activeCount = Object.values(layers).filter(Boolean).length
  const accent = isGas ? ui.gas : ui.oil
  const groups: LayerGroup[] = [
    {
      title: 'Base',
      rows: [{ key: 'countries', label: 'Country choropleth', color: isGas ? ui.gas : ui.blue }],
    },
    {
      title: 'Flows',
      rows: [
        { key: 'aisLive', label: 'Live tankers (AIS)', color: accent, count: aisStatus.count || undefined },
        { key: 'flows', label: isGas ? 'Gas trade flows' : 'Oil trade flows', color: accent, count: counts.flows },
        { key: 'vessels', label: 'Simulated traffic', color: ui.neutral, count: counts.vessels },
        { key: 'pipelines', label: isGas ? 'Gas pipelines' : 'Oil pipelines', color: ui.neutral, count: counts.pipelines },
      ],
    },
    {
      title: 'Infrastructure',
      rows: isGas
        ? [
            { key: 'lngTerminals', label: 'LNG terminals', color: ui.gas, count: counts.lngTerminals },
            { key: 'fields', label: 'Gas fields', color: ui.gas, count: counts.fields },
          ]
        : [
            { key: 'terminals', label: 'Terminals & ports', color: ui.oil, count: counts.terminals },
            { key: 'refineries', label: 'Refineries', color: ui.neutral, count: counts.refineries },
            { key: 'fields', label: 'Oil fields', color: ui.oil, count: counts.fields },
          ],
    },
    {
      title: 'Maritime',
      rows: [
        { key: 'chokepoints', label: 'Chokepoints', color: ui.alert, count: counts.chokepoints },
        { key: 'shippingLanes', label: 'Container corridors', color: ui.neutral, count: counts.shippingLanes },
        { key: 'containerPorts', label: 'Container ports', color: ui.neutral, count: counts.containerPorts },
      ],
    },
  ]

  return (
    <div className="floating-card absolute left-4 top-4 z-40 w-[212px]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
      >
        <span className="text-[12px] font-semibold text-text">Layers</span>
        <span className="flex items-center gap-2">
          {aisStatus.enabled && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              title={aisStatus.connected ? 'AIS live' : 'AIS reconnecting'}
              style={{ background: aisStatus.connected ? ui.safe : ui.orange }}
            />
          )}
          <span className="font-mono text-[9px] text-text-muted">{activeCount} on</span>
          <span className="material-symbols-outlined text-text-muted" style={{ fontSize: '0.95rem' }}>
            {open ? 'remove' : 'add'}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-3.5 pb-3">
          {groups.map(group => (
            <div key={group.title} className="mt-2.5">
              <div className="section-label">{group.title}</div>
              <div className="mt-1.5 space-y-0.5">
                {group.rows.map(row => {
                  const active = layers[row.key]
                  return (
                    <button
                      key={row.key}
                      onClick={() => toggleLayer(row.key)}
                      className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-[4px] text-left text-[11px] transition-colors ${
                        active ? 'text-text hover:bg-inset' : 'text-text-muted/60 hover:text-text-muted'
                      }`}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full border"
                        style={{
                          backgroundColor: active ? row.color : 'transparent',
                          borderColor: active ? row.color : 'rgba(0,0,0,0.18)',
                        }}
                      />
                      <span className="flex-1 truncate">{row.label}</span>
                      {row.count != null && active && (
                        <span className="font-mono text-[9px] text-text-muted">{row.count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
