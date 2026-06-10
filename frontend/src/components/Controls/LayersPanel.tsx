import { useState } from 'react'
import type { LayerKey } from '../../store/mapStore'
import { useMapStore } from '../../store/mapStore'

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
  const { layers, toggleLayer, commodity } = useMapStore()
  const [open, setOpen] = useState(false)

  const isGas = commodity === 'gas'
  const activeCount = Object.values(layers).filter(Boolean).length
  const groups: LayerGroup[] = [
    {
      title: 'Base',
      rows: [{ key: 'countries', label: 'Country choropleth', color: isGas ? '#30807C' : '#427494' }],
    },
    {
      title: 'Flows',
      rows: [
        { key: 'flows', label: isGas ? 'Gas trade flows' : 'Oil trade flows', color: isGas ? '#46C8DC' : '#DCA54A', count: counts.flows },
        { key: 'pipelines', label: isGas ? 'Gas pipelines' : 'Oil pipelines', color: isGas ? '#46C8DC' : '#3EA080', count: counts.pipelines },
      ],
    },
    {
      title: 'Infrastructure',
      rows: isGas
        ? [
            { key: 'lngTerminals', label: 'LNG terminals', color: '#46C8DC', count: counts.lngTerminals },
            { key: 'fields', label: 'Gas fields', color: '#DD9658', count: counts.fields },
          ]
        : [
            { key: 'terminals', label: 'Terminals & ports', color: '#DCA54A', count: counts.terminals },
            { key: 'refineries', label: 'Refineries', color: '#CB6E90', count: counts.refineries },
            { key: 'fields', label: 'Oil fields', color: '#97C166', count: counts.fields },
          ],
    },
    {
      title: 'Maritime',
      rows: [
        { key: 'chokepoints', label: 'Chokepoints', color: '#D9544D', count: counts.chokepoints },
        { key: 'shippingLanes', label: 'Container corridors', color: '#608EC4', count: counts.shippingLanes },
        { key: 'containerPorts', label: 'Container ports', color: '#76889C', count: counts.containerPorts },
      ],
    },
  ]

  return (
    <div className="terminal-card absolute left-4 top-4 z-40 w-[206px] rounded-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="caps-label !text-text">Layers</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-text-muted">{activeCount} on</span>
          <span className="material-symbols-outlined text-text-muted" style={{ fontSize: '0.95rem' }}>
            {open ? 'remove' : 'add'}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3">
          {groups.map(group => (
            <div key={group.title} className="mt-2.5">
              <div className="caps-label">{group.title}</div>
              <div className="mt-1.5 space-y-0.5">
                {group.rows.map(row => {
                  const active = layers[row.key]
                  return (
                    <button
                      key={row.key}
                      onClick={() => toggleLayer(row.key)}
                      className={`flex w-full items-center gap-2 rounded-sm px-1 py-[3px] text-left text-[11px] transition-colors ${
                        active ? 'text-text hover:bg-white/5' : 'text-text-muted/50 hover:text-text-muted'
                      }`}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-[2px] border"
                        style={{
                          backgroundColor: active ? row.color : 'transparent',
                          borderColor: active ? row.color : '#2A3D4F',
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
