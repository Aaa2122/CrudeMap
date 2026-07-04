import { useMemo, useState } from 'react'
import { useMapStore, type LayerKey } from './store/mapStore'
import { useFlows } from './api/hooks/useFlows'
import { useInfrastructures } from './api/hooks/useInfrastructures'
import { useFieldsData } from './api/hooks/useFields'
import { useChokepoints } from './api/hooks/useChokepoints'
import { WorldMap } from './components/Map/WorldMap'
import { SidePanel } from './components/Panels/SidePanel'
import { CommodityToggle } from './components/Controls/CommodityToggle'
import { LayersPanel } from './components/Controls/LayersPanel'
import { SearchBox } from './components/Controls/SearchBox'
import { OverviewDashboard } from './components/Overview/OverviewDashboard'
import { DataSourcesModal } from './components/Modals/DataSourcesModal'

type Tab = 'network' | 'overview'

export default function App() {
  const { commodity, viewMode, setViewMode } = useMapStore()
  const { data: flows } = useFlows(commodity)
  const { data: infras } = useInfrastructures()
  const { data: fields } = useFieldsData()
  const { data: chokepoints } = useChokepoints()
  const [activeTab, setActiveTab] = useState<Tab>('network')
  const [showSources, setShowSources] = useState(false)

  const isGas = commodity === 'gas'

  // Live per-layer entity counts for the layers panel
  const layerCounts = useMemo<Partial<Record<LayerKey, number>>>(() => {
    const commodityInfras = (infras ?? []).filter(i => (isGas ? i.commodity === 'gas' : i.commodity !== 'gas'))
    return {
      flows: (flows ?? []).length,
      pipelines: commodityInfras.filter(i => i.type === 'pipeline').length,
      terminals: commodityInfras.filter(i => i.type === 'terminal' || i.type === 'port').length,
      refineries: commodityInfras.filter(i => i.type === 'refinery').length,
      lngTerminals: commodityInfras.filter(i => i.type === 'lng_terminal').length,
      fields: (fields ?? []).filter(f => f.commodity === 'mixed' || f.commodity === commodity).length,
      chokepoints: (chokepoints ?? []).length,
      shippingLanes: 16,
      containerPorts: 26,
    }
  }, [infras, flows, fields, chokepoints, commodity, isGas])

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-bg text-text">

      {/* ── Header ── */}
      <header className="glass-bar z-50 flex h-[52px] shrink-0 items-center justify-between gap-4 px-5">
        <div className="flex min-w-0 items-center gap-5">
          {/* Wordmark */}
          <div className="flex select-none items-baseline gap-2">
            <span className="text-[16px] font-semibold tracking-tight text-text">CrudeMap</span>
            <span className="text-[11px] text-text-muted">Energy flows</span>
          </div>

          <CommodityToggle />

          <nav className="flex items-center rounded-full bg-inset p-0.5">
            {(
              [
                { key: 'network', label: 'Map' },
                { key: 'overview', label: 'Overview' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`h-7 rounded-full px-3.5 text-[12px] font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-surface text-text shadow-float'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <SearchBox />

          <button
            onClick={() => setViewMode(viewMode === 'flat' ? 'globe' : 'flat')}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${
              viewMode === 'globe'
                ? 'bg-inset text-text'
                : 'text-text-muted hover:bg-inset hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
              {viewMode === 'globe' ? 'public' : 'map'}
            </span>
            {viewMode === 'globe' ? 'Globe' : 'Flat'}
          </button>

          <button
            onClick={() => setShowSources(true)}
            title="Data sources & methodology"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-inset hover:text-text"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>info</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map stays mounted when switching tabs: avoids tearing down the
            WebGL context and makes coming back instant. */}
        <main
          className="flex-1 relative ocean-ground"
          style={activeTab === 'network' ? undefined : { display: 'none' }}
        >
          <div className="absolute inset-0">
            <WorldMap />
          </div>

          <LayersPanel counts={layerCounts} />

          <div className="absolute inset-y-0 right-0 pointer-events-none">
            <div className="pointer-events-auto h-full">
              <SidePanel />
            </div>
          </div>
        </main>
        {activeTab === 'overview' && (
          <main className="flex-1 relative overflow-hidden bg-bg">
            <OverviewDashboard />
          </main>
        )}
      </div>

      {showSources && <DataSourcesModal onClose={() => setShowSources(false)} />}
    </div>
  )
}
