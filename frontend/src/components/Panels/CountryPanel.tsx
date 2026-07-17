import { useCountry, useCountryFlows, useCountryChokeExposure, useCountryInfras } from '../../api/hooks/useCountries'
import { useMapStore } from '../../store/mapStore'
import { SupplierBar } from '../Charts/SupplierBar'
import { RouteDonut } from '../Charts/RouteDonut'
import { InsetGroup, InsetRow, MeterBar, Pill, SectionLabel } from './panelKit'
import { statusColor, ui } from '../../uiTheme'

function resilienceInfo(score: number) {
  if (score >= 70) return { label: 'Resilient', color: ui.safe }
  if (score >= 40) return { label: 'Moderate', color: ui.orange }
  return { label: 'Vulnerable', color: ui.alert }
}

function vulnColor(pct: number) {
  if (pct >= 70) return ui.alert
  if (pct >= 40) return ui.orange
  return ui.safe
}

interface Props { iso: string }

export function CountryPanel({ iso }: Props) {
  const { data: country, isLoading } = useCountry(iso)
  const { data: flows } = useCountryFlows(iso)
  const { data: exposure } = useCountryChokeExposure(iso)
  const { data: infras } = useCountryInfras(iso)
  const { setSelected } = useMapStore()

  if (isLoading || !country) {
    return <div className="p-5 text-sm text-text-muted">Loading…</div>
  }

  const res = resilienceInfo(country.resilience_score)
  const balanceNet = country.export_oil_mt - country.import_oil_mt
  const gasBalanceNet = country.export_gas_bcm - country.import_gas_bcm
  const hasGasData =
    country.production_gas_bcm > 0 || country.import_gas_bcm > 0 || country.consumption_gas_bcm > 0

  return (
    <div className="space-y-4 overflow-y-auto px-5 pb-5 text-sm text-text">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">{country.name}</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {country.region} · {country.role}
          </p>
        </div>
        <Pill color={res.color}>{res.label}</Pill>
      </div>

      {/* Crude oil */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Crude oil</SectionLabel>
          <span className="font-mono text-[10px] text-text-muted">
            {country.oil_period ? `${country.oil_period} · ` : ''}Mt/yr
          </span>
        </div>
        <InsetGroup>
          <InsetRow label="Production" value={country.production_oil_mt} />
          <InsetRow label="Consumption" value={country.consumption_oil_mt} />
          <InsetRow label="Import" value={country.import_oil_mt} />
          <InsetRow label="Export" value={country.export_oil_mt} />
          <InsetRow
            label="Net balance"
            value={`${balanceNet >= 0 ? '+' : ''}${balanceNet.toFixed(1)}`}
            valueColor={balanceNet >= 0 ? ui.safe : ui.alert}
          />
          <InsetRow label="Refining capacity" value={country.refining_capacity_mt} />
        </InsetGroup>
      </div>

      {/* Natural gas */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Natural gas</SectionLabel>
          <span className="font-mono text-[10px] text-text-muted">
            {country.gas_period ? `${country.gas_period} · ` : ''}bcm/yr
          </span>
        </div>
        {hasGasData ? (
          <InsetGroup>
            <InsetRow label="Production" value={country.production_gas_bcm} />
            <InsetRow label="Consumption" value={country.consumption_gas_bcm} />
            <InsetRow label="Import" value={country.import_gas_bcm} />
            <InsetRow label="Export" value={country.export_gas_bcm} />
            <InsetRow
              label="Net balance"
              value={`${gasBalanceNet >= 0 ? '+' : ''}${gasBalanceNet.toFixed(1)}`}
              valueColor={gasBalanceNet >= 0 ? ui.safe : ui.alert}
            />
            <InsetRow
              label="Import dependency"
              value={`${Math.round(country.dependency_score_gas * 100)}%`}
              valueColor={vulnColor(Math.round(country.dependency_score_gas * 100))}
            />
          </InsetGroup>
        ) : (
          <p className="text-[12px] text-text-muted">No significant gas trade tracked.</p>
        )}
      </div>

      {/* Vulnerability */}
      <div className="space-y-2">
        <SectionLabel>Vulnerability</SectionLabel>
        <VulnRow label="Oil import dependency" value={country.dependency_score} />
        {hasGasData && <VulnRow label="Gas import dependency" value={country.dependency_score_gas} />}
        <VulnRow label="Supplier concentration" value={Math.min(country.supplier_hhi / 10000, 1)} />
        {exposure && (
          <>
            <VulnRow label="Hormuz exposure" value={exposure.hormuz ?? 0} />
            <VulnRow label="Malacca exposure" value={exposure.malacca ?? 0} />
          </>
        )}
      </div>

      {/* Top suppliers */}
      <div className="space-y-1.5">
        <SectionLabel>Top suppliers</SectionLabel>
        {flows && flows.length > 0
          ? <SupplierBar flows={flows} targetIso={iso} />
          : <p className="text-[12px] text-text-muted">No import flows</p>}
      </div>

      {/* Route exposure */}
      <div className="space-y-1.5">
        <SectionLabel>Route exposure</SectionLabel>
        {exposure ? <RouteDonut exposure={exposure} /> : <p className="text-[12px] text-text-muted">Loading…</p>}
      </div>

      {/* Key infrastructures */}
      {infras && infras.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Infrastructures ({infras.length})</SectionLabel>
          <div className="space-y-1">
            {infras.slice(0, 8).map(inf => (
              <button
                key={inf.id}
                onClick={() => setSelected({ type: 'infrastructure', id: inf.id })}
                className="flex w-full items-center gap-2.5 rounded-ctl bg-inset px-3 py-2 text-left transition-colors hover:bg-black/[0.05]"
              >
                <span className="material-symbols-outlined text-text-muted" style={{ fontSize: '0.9rem' }}>
                  {inf.type === 'pipeline' ? 'schema' : inf.type === 'terminal' ? 'anchor' : 'factory'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{inf.name}</div>
                  <div className="text-[10px] text-text-muted">{inf.type} · {inf.subtype}</div>
                </div>
                <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor(inf.status) }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data provenance */}
      <div className="space-y-1 border-t border-border pt-3 text-[11px] text-text-muted">
        <p className="flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>info</span>
          Oil: {country.oil_source ?? country.source} · {country.oil_period ?? country.source_year}
          {country.oil_is_partial ? ` · ${country.oil_data_type.replace(/_/g, ' ')}` : ''}
        </p>
        <p className="pl-4">
          {country.gas_source
            ? <>Gas: {country.gas_source} · {country.gas_period ?? 'period unknown'}</>
            : <>Gas: no reported profile</>}
        </p>
        <p className="pl-4 flex gap-3">
          <span>Oil confidence:{' '}
          <span
            className="font-medium"
            style={{ color: (country.oil_confidence ?? country.confidence) === 'high' ? ui.safe : (country.oil_confidence ?? country.confidence) === 'medium' ? ui.orange : ui.alert }}
          >
            {country.oil_confidence ?? country.confidence}
          </span>
          </span>
          <span>Gas confidence:{' '}
            <span
              className="font-medium"
              style={{ color: (country.gas_confidence ?? country.confidence) === 'high' ? ui.safe : (country.gas_confidence ?? country.confidence) === 'medium' ? ui.orange : ui.alert }}
            >
              {country.gas_confidence ?? country.confidence}
            </span>
          </span>
        </p>
      </div>

      {country.data_level === 'R' && (
        <div className="rounded-ctl border border-border bg-inset px-3 py-2 text-[12px] leading-relaxed text-text-muted">
          This map polygon is a non-additive geographic rollup. Its oil and gas balance is included in the
          parent country named in the source; the zeroes below are placeholders, not independent reported values.
        </div>
      )}
    </div>
  )
}

function VulnRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = vulnColor(pct)
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-36 shrink-0 truncate text-[11px] text-text-muted">{label}</span>
      <MeterBar pct={pct} color={color} />
      <span className="w-9 text-right font-mono text-[11px] font-medium" style={{ color }}>{pct}%</span>
    </div>
  )
}
