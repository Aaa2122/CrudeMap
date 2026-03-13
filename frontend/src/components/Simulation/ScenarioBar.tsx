import { useScenarios } from '../../api/hooks/useScenario'
import { useScenarioStore } from '../../store/scenarioStore'

const TYPE_ICON: Record<string, string> = {
  chokepoint: '🚢',
  country: '🌍',
  infrastructure: '⚡',
}

export function ScenarioBar() {
  const { data: scenarios } = useScenarios()
  const { activeSlug, loading, activateScenario, clearScenario } = useScenarioStore()

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border px-4 py-2 flex items-center gap-2 z-40 overflow-x-auto">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted shrink-0 mr-1">
        Scenario
      </span>

      {/* None button */}
      <button
        onClick={clearScenario}
        className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
          !activeSlug
            ? 'bg-amber text-bg'
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
            className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'bg-disrupted text-white'
                : 'bg-bg border border-border text-text-muted hover:text-text hover:border-amber'
            } disabled:opacity-50`}
            title={s.description ?? ''}
          >
            <span>{TYPE_ICON[s.scenario_type ?? ''] ?? '⚠️'}</span>
            <span>{s.name}</span>
            {isActive && <span className="ml-1">✕</span>}
          </button>
        )
      })}

      {loading && (
        <span className="text-xs text-text-muted shrink-0 animate-pulse">Running…</span>
      )}
    </div>
  )
}
