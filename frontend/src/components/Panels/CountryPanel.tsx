import { useCountry, useCountryFlows, useCountryChokeExposure, useCountryInfras } from '../../api/hooks/useCountries'
import { useScenarioStore } from '../../store/scenarioStore'
import { useMapStore } from '../../store/mapStore'
import { SupplierBar } from '../Charts/SupplierBar'
import { RouteDonut } from '../Charts/RouteDonut'
import { WaterfallImpact } from '../Charts/WaterfallImpact'

function resilience_label(score: number) {
  if (score >= 70) return { label: 'Resilient', color: '#22c55e' }
  if (score >= 40) return { label: 'Moderate', color: '#f97316' }
  return { label: 'Vulnerable', color: '#ef4444' }
}

interface Props { iso: string }

export function CountryPanel({ iso }: Props) {
  const { data: country, isLoading } = useCountry(iso)
  const { data: flows } = useCountryFlows(iso)
  const { data: exposure } = useCountryChokeExposure(iso)
  const { data: infras } = useCountryInfras(iso)
  const { result: scenarioResult } = useScenarioStore()
  const { setSelected } = useMapStore()

  const impact = scenarioResult?.impacts.find(i => i.country_iso === iso)
  const resLabel = country ? resilience_label(country.resilience_score) : null

  if (isLoading || !country) {
    return <div className="p-4 text-text-muted text-sm">Loading…</div>
  }

  const balanceNet = country.export_oil_mt - country.import_oil_mt

  return (
    <div className="p-4 space-y-4 text-text text-sm overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">{country.name}</h2>
            <p className="text-text-muted text-xs">
              {country.region} · {country.role}
              {country.data_level === 'A' && (
                <span className="ml-1 text-[9px] bg-border/50 text-text-muted px-1 rounded">MACRO</span>
              )}
            </p>
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: resLabel?.color + '22', color: resLabel?.color }}
          >
            {resLabel?.label}
          </span>
        </div>

        {/* Key metrics grid */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Production" value={`${country.production_oil_mt} Mt`} />
          <Stat label="Consumption" value={`${country.consumption_oil_mt} Mt`} />
          <Stat label="Import" value={`${country.import_oil_mt} Mt`} />
          <Stat label="Export" value={`${country.export_oil_mt} Mt`} />
        </div>

        {/* Balance + Importance row */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="bg-bg border border-border rounded p-2 text-center">
            <div className="text-[10px] text-text-muted uppercase">Balance</div>
            <div className={`text-sm font-bold ${balanceNet >= 0 ? 'text-safe' : 'text-disrupted'}`}>
              {balanceNet >= 0 ? '+' : ''}{balanceNet.toFixed(1)} Mt
            </div>
          </div>
          <div className="bg-bg border border-border rounded p-2 text-center">
            <div className="text-[10px] text-text-muted uppercase">Importance</div>
            <div className="text-sm font-bold text-primary">{Math.round(country.importance_score)}/100</div>
          </div>
        </div>
      </div>

      {/* Vulnerability breakdown */}
      <Divider label="VULNERABILITY" />
      <div className="space-y-2">
        <VulnBar label="Import dependency" value={country.dependency_score} />
        <VulnBar label="Supplier concentration" value={Math.min(country.supplier_hhi / 10000, 1)} />
        {exposure && (
          <>
            <VulnBar label="Hormuz exposure" value={exposure.hormuz ?? 0} />
            <VulnBar label="Malacca exposure" value={exposure.malacca ?? 0} />
          </>
        )}
      </div>

      {/* Top suppliers */}
      <Divider label="TOP SUPPLIERS" />
      {flows && flows.length > 0
        ? <SupplierBar flows={flows} targetIso={iso} />
        : <p className="text-text-muted text-xs">No import flows</p>
      }

      {/* Route exposure */}
      <Divider label="ROUTE EXPOSURE" />
      {exposure
        ? <RouteDonut exposure={exposure} />
        : <p className="text-text-muted text-xs">Loading…</p>
      }

      {/* Key infrastructures */}
      {infras && infras.length > 0 && (
        <>
          <Divider label={`INFRASTRUCTURES (${infras.length})`} />
          <div className="space-y-1">
            {infras.slice(0, 8).map(inf => {
              const statusColor = inf.status === 'active' ? '#22c55e' : inf.status === 'limited' ? '#f97316' : '#ef4444'
              return (
                <button
                  key={inf.id}
                  onClick={() => setSelected({ type: 'infrastructure', id: inf.id })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-bg border border-border rounded hover:border-primary/50 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '0.85rem' }}>
                    {inf.type === 'pipeline' ? 'schema' : inf.type === 'terminal' ? 'anchor' : 'factory'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium truncate">{inf.name}</div>
                    <div className="text-[9px] text-text-muted">{inf.type} · {inf.subtype}</div>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: statusColor }}
                  />
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Data provenance */}
      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>info</span>
          {country.source} · {country.source_year} ·
          <span className={`font-medium ${
            country.confidence === 'high' ? 'text-safe' :
            country.confidence === 'medium' ? 'text-amber' :
            'text-disrupted'
          }`}>
            {country.confidence}
          </span>
        </p>
      </div>

      {/* Scenario impact */}
      {impact && (
        <>
          <Divider label="SCENARIO IMPACT" highlight />
          <WaterfallImpact impact={impact} baseline_import_mt={impact.baseline_import_mt} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg border border-border rounded p-2 text-center">
      <div className="text-[10px] text-text-muted uppercase">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

function VulnBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? '#ef4444' : pct >= 40 ? '#f97316' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-muted w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-bg rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] w-8 text-right font-medium" style={{ color }}>{pct}%</span>
    </div>
  )
}

function Divider({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest ${highlight ? 'text-amber' : 'text-text-muted'}`}>
      <span>{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}
