import { useMemo, useState } from 'react'
import { useMapStore, type LayerKey } from './store/mapStore'
import { useScenarioStore } from './store/scenarioStore'
import { useScenarios } from './api/hooks/useScenario'
import { useFlows } from './api/hooks/useFlows'
import { useInfrastructures } from './api/hooks/useInfrastructures'
import { useFieldsData } from './api/hooks/useFields'
import { useChokepoints } from './api/hooks/useChokepoints'
import { WorldMap } from './components/Map/WorldMap'
import { SidePanel } from './components/Panels/SidePanel'
import { SimulationResults } from './components/Simulation/SimulationResults'
import { CommodityToggle } from './components/Controls/CommodityToggle'
import { LayersPanel } from './components/Controls/LayersPanel'
import { SearchBox } from './components/Controls/SearchBox'
import { OverviewDashboard } from './components/Overview/OverviewDashboard'
import { DataSourcesModal } from './components/Modals/DataSourcesModal'

type Tab = 'network' | 'overview'

export default function App() {
  const { commodity, viewMode, setViewMode } = useMapStore()
  const { activeSlug, loading, activateScenario, clearScenario } = useScenarioStore()
  const { data: scenarios } = useScenarios()
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
      <header className="flex items-center justify-between border-b border-border bg-surface/90 px-5 h-12 shrink-0 gap-4 backdrop-blur">
        <div className="flex items-center gap-5 min-w-0">
          {/* Wordmark */}
          <div className="flex items-baseline gap-2 select-none">
            <span className="display-caps text-[15px]" style={{ color: isGas ? '#46C8DC' : '#DCA54A' }}>
              CrudeMap
            </span>
            <span className="font-mono text-[9px] tracking-caps uppercase text-text-muted">
              energy flows
            </span>
          </div>

          <CommodityToggle />

          <div className="h-5 w-px bg-border" />

          <nav className="flex gap-5">
            {(
              [
                { key: 'network', label: 'Map' },
                { key: 'overview', label: 'Overview' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-[11px] font-semibold uppercase tracking-caps pb-0.5 transition-colors border-b ${
                  activeTab === tab.key
                    ? 'text-text border-text'
                    : 'text-text-muted border-transparent hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <SearchBox />

          <button
            onClick={() => setViewMode(viewMode === 'flat' ? 'globe' : 'flat')}
            className={`flex items-center gap-1.5 text-[10px] font-semibold h-7 px-2.5 rounded-sm border transition-colors uppercase tracking-caps ${
              viewMode === 'globe'
                ? 'border-primary/50 text-primary'
                : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
              {viewMode === 'globe' ? 'public' : 'map'}
            </span>
            {viewMode === 'globe' ? 'Globe' : 'Flat'}
          </button>

          <button
            onClick={() => setShowSources(true)}
            title="Data sources & methodology"
            className="w-7 h-7 rounded-sm border border-transparent flex items-center justify-center text-text-muted hover:text-text hover:border-border transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>info</span>
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

          <SimulationResults />

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

      {/* ── Footer: scenario bar + status ── */}
      <footer className="shrink-0 border-t border-border bg-surface/90 flex items-center justify-between px-5 h-9 backdrop-blur">
        <div
          className="flex items-center gap-1.5 overflow-x-auto"
          title={isGas ? 'Disruption simulation runs on the oil network — switch to Oil to use scenarios' : undefined}
        >
          <span className="caps-label shrink-0 mr-1.5">Scenario</span>
          <button
            onClick={clearScenario}
            disabled={isGas}
            className={`shrink-0 h-5.5 px-2.5 py-0.5 rounded-sm font-mono text-[10px] transition-colors disabled:opacity-30 ${
              !activeSlug
                ? 'bg-text text-bg font-semibold'
                : 'border border-border text-text-muted hover:text-text'
            }`}
          >
            none
          </button>
          {(scenarios ?? []).map(s => {
            const isActive = activeSlug === s.slug
            return (
              <button
                key={s.slug}
                onClick={() => isActive ? clearScenario() : activateScenario(s.slug)}
                disabled={loading || isGas}
                title={isGas ? 'Oil-network simulation — switch to Oil mode' : s.description ?? ''}
                className={`shrink-0 px-2.5 py-0.5 rounded-sm font-mono text-[10px] transition-colors disabled:opacity-30 ${
                  isActive
                    ? 'bg-disrupted/15 border border-disrupted/60 text-disrupted'
                    : 'border border-border text-text-muted hover:text-text hover:border-text-muted'
                }`}
              >
                {s.name}
                {isActive && <span className="ml-1.5 opacity-70">✕</span>}
              </button>
            )
          })}
          {loading && <span className="font-mono text-[10px] text-text-muted animate-pulse shrink-0">running…</span>}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-safe" />
            <span className="caps-label !text-safe">Live</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span className="font-mono text-[9px] text-text-muted">v1.1.0</span>
        </div>
      </footer>

      {showSources && <DataSourcesModal onClose={() => setShowSources(false)} />}
    </div>
  )
}
