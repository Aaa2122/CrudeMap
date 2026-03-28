import { useMemo, useState } from 'react'
import type { CountryMetricKey, FlowMode } from './api/types'
import { useMapStore } from './store/mapStore'
import { useScenarioStore } from './store/scenarioStore'
import { useScenarios } from './api/hooks/useScenario'
import { useCountries } from './api/hooks/useCountries'
import { WorldMap } from './components/Map/WorldMap'
import { COUNTRY_METRIC_OPTIONS } from './components/Map/countryMetrics'
import { SidePanel } from './components/Panels/SidePanel'
import { SimulationResults } from './components/Simulation/SimulationResults'

const SCENARIO_TYPE_ICON: Record<string, string> = {
  chokepoint: 'anchor',
  country: 'public',
  infrastructure: 'bolt',
}

export default function App() {
  const {
    showCountryLayer,
    showFlowLayer,
    showChokeLayer,
    showInfraLayer,
    toggleLayer,
    viewMode,
    setViewMode,
    selectedMetric,
    setSelectedMetric,
    flowMode,
    setFlowMode,
    filters,
    setFilter,
    clearFilters,
  } = useMapStore()
  const { activeSlug, loading, activateScenario, clearScenario } = useScenarioStore()
  const { data: scenarios } = useScenarios()
  const { data: countries } = useCountries()
  const [activeNav, setActiveNav] = useState<'overview' | 'network' | 'scenarios'>('overview')
  const [showFilters, setShowFilters] = useState(false)

  // Derive unique regions and roles for filter dropdowns
  const regions = useMemo(() => {
    const set = new Set((countries ?? []).map(c => c.region).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [countries])

  const roles = useMemo(() => {
    const set = new Set((countries ?? []).map(c => c.role).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [countries])

  const hasActiveFilters = filters.region || filters.role || filters.minImportance > 0

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-bg text-text">

      {/* ── Header ── */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2.5 text-primary">
            <span className="material-symbols-outlined text-2xl">oil_barrel</span>
            <span className="text-base font-black tracking-tight uppercase">CrudeMap</span>
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Nav tabs */}
          <nav className="flex gap-4">
            {(['overview', 'network', 'scenarios'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveNav(tab)}
                className={`text-[11px] font-bold uppercase tracking-wider pb-0.5 transition-colors ${
                  activeNav === tab
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab === 'overview' ? 'System Overview' : tab === 'network' ? 'Network Map' : 'Scenarios'}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: layer toggles + icons */}
        <div className="flex items-center gap-3">
          <LayerToggle label="Countries" icon="public" active={showCountryLayer} onClick={() => toggleLayer('country')} color="#38bdf8" />
          <LayerToggle label="Flows" icon="hub" active={showFlowLayer} onClick={() => toggleLayer('flow')} color="#f59e0b" />
          <LayerToggle label="Chokepoints" icon="anchor" active={showChokeLayer} onClick={() => toggleLayer('choke')} color="#ef4444" />
          <LayerToggle label="Infra" icon="factory" active={showInfraLayer} onClick={() => toggleLayer('infra')} color="#818cf8" />

          <div className="h-5 w-px bg-border mx-1" />

          {/* Globe / Flat toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'flat' ? 'globe' : 'flat')}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors uppercase tracking-wide ${
              viewMode === 'globe'
                ? 'border-primary/55 bg-primary/22 text-primary'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
              {viewMode === 'globe' ? 'public' : 'map'}
            </span>
            {viewMode === 'globe' ? 'Globe' : 'Flat'}
          </button>

          <div className="h-5 w-px bg-border mx-1" />

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors uppercase tracking-wide ${
              showFilters || hasActiveFilters
                ? 'border-primary/55 bg-primary/22 text-primary'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>filter_alt</span>
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>

          <IconBtn icon="notifications" />
          <IconBtn icon="settings" />
          <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '1rem' }}>person</span>
          </div>
        </div>
      </header>

      {/* ── Filters bar ── */}
      {showFilters && (
        <div className="shrink-0 flex items-center gap-3 px-5 py-2 border-b border-border bg-surface/80 text-xs">
          <FilterSelect
            label="Region"
            value={filters.region}
            options={regions}
            onChange={v => setFilter('region', v)}
          />
          <FilterSelect
            label="Role"
            value={filters.role}
            options={roles}
            onChange={v => setFilter('role', v)}
          />
          <MetricSelect
            value={selectedMetric}
            onChange={setSelectedMetric}
          />
          <FlowModeSelect
            value={flowMode}
            disabled={!showFlowLayer}
            onChange={setFlowMode}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted uppercase font-bold">Min importance</span>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={filters.minImportance}
              onChange={e => setFilter('minImportance', Number(e.target.value))}
              className="w-20 h-1 accent-primary"
            />
            <span className="text-[10px] text-text w-6">{filters.minImportance}</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[10px] text-disrupted font-bold uppercase hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-14 flex flex-col items-center py-5 gap-4 border-r border-border bg-surface shrink-0">
          <SidebarBtn icon="dashboard" active tooltip="Dashboard" />
          <SidebarBtn icon="public" tooltip="Globe view" active={viewMode === 'globe'} onClick={() => setViewMode(viewMode === 'flat' ? 'globe' : 'flat')} />
          <SidebarBtn icon="oil_barrel" active tooltip="Crude Oil" activeColor />
          <SidebarBtn icon="schema" tooltip="Pipelines" />
          <div className="mt-auto">
            <SidebarBtn icon="help" tooltip="Help" />
          </div>
        </aside>

        {/* Map area */}
        <main className="flex-1 relative terminal-grid">
          <div className="absolute inset-0">
            <WorldMap />
          </div>

          {/* Simulation impact ranking (top-left overlay) */}
          <SimulationResults />

          {/* Side panel */}
          <div className="absolute inset-y-0 right-0 pointer-events-none">
            <div className="pointer-events-auto h-full">
              <SidePanel />
            </div>
          </div>
        </main>
      </div>

      {/* ── Footer: scenario bar + status ── */}
      <footer className="shrink-0 border-t border-border bg-surface flex items-center justify-between px-5 h-9">
        {/* Scenario selector */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted shrink-0">
            Scenario
          </span>
          <button
            onClick={clearScenario}
            className={`shrink-0 px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
              !activeSlug
                ? 'bg-primary text-white'
                : 'bg-bg border border-border text-text-muted hover:text-text'
            }`}
          >
            None
          </button>
          {(scenarios ?? []).map(s => {
            const isActive = activeSlug === s.slug
            return (
              <button
                key={s.slug}
                onClick={() => isActive ? clearScenario() : activateScenario(s.slug)}
                disabled={loading}
                title={s.description ?? ''}
                className={`shrink-0 px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 ${
                  isActive
                    ? 'bg-disrupted text-white'
                    : 'bg-bg border border-border text-text-muted hover:text-text hover:border-primary'
                } disabled:opacity-50`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
                  {SCENARIO_TYPE_ICON[s.scenario_type ?? ''] ?? 'warning'}
                </span>
                {s.name}
                {isActive && <span className="ml-0.5 opacity-70">✕</span>}
              </button>
            )
          })}
          {loading && <span className="text-[10px] text-text-muted animate-pulse shrink-0">Running…</span>}
        </div>

        {/* Status */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-safe" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-safe">System Active</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span className="text-[9px] font-mono text-text-muted">v0.1.0-MVP</span>
        </div>
      </footer>
    </div>
  )
}

function LayerToggle({
  label, icon, active, onClick, color,
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors uppercase tracking-wide ${
        active ? 'border-transparent' : 'border-border text-text-muted hover:text-text'
      }`}
      style={active ? { background: color + '22', color, borderColor: color + '55' } : {}}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>{icon}</span>
      {label}
    </button>
  )
}

function SidebarBtn({
  icon, active, activeColor, tooltip, onClick,
}: {
  icon: string
  active?: boolean
  activeColor?: boolean
  tooltip?: string
  onClick?: () => void
}) {
  return (
    <button
      title={tooltip}
      onClick={onClick}
      className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
        activeColor
          ? 'bg-primary/15 text-primary'
          : active
          ? 'bg-primary text-white shadow-lg shadow-primary/20'
          : 'text-text-muted hover:text-text hover:bg-white/5'
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{icon}</span>
    </button>
  )
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string
  value: string | null
  options: string[]
  onChange: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted uppercase font-bold">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="bg-bg border border-border rounded text-[11px] py-0.5 px-2 text-text focus:ring-1 focus:ring-primary focus:outline-none"
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function MetricSelect({
  value,
  onChange,
}: {
  value: CountryMetricKey
  onChange: (value: CountryMetricKey) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted uppercase font-bold">Metric</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as CountryMetricKey)}
        className="bg-bg border border-border rounded text-[11px] py-0.5 px-2 text-text focus:ring-1 focus:ring-primary focus:outline-none"
      >
        {COUNTRY_METRIC_OPTIONS.map(option => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function FlowModeSelect({
  value,
  disabled,
  onChange,
}: {
  value: FlowMode
  disabled: boolean
  onChange: (value: FlowMode) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted uppercase font-bold">Flows</span>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as FlowMode)}
        className="bg-bg border border-border rounded text-[11px] py-0.5 px-2 text-text focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-40"
      >
        <option value="selected">Selected country</option>
        <option value="top20">Top 20 routes</option>
      </select>
    </div>
  )
}

function IconBtn({ icon }: { icon: string }) {
  return (
    <button className="w-8 h-8 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-white/5 transition-colors">
      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{icon}</span>
    </button>
  )
}
