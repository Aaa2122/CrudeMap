interface Props {
  onClose: () => void
}

const SOURCES = [
  { dataset: 'Country oil balances', source: 'Energy Institute Statistical Review, EIA, JODI', vintage: '2024' },
  { dataset: 'Country gas balances', source: 'Energy Institute Statistical Review', vintage: '2024' },
  { dataset: 'Bilateral oil flows', source: 'IEA, UN Comtrade, Vortexa-style estimates', vintage: '2024' },
  { dataset: 'LNG & pipeline gas flows', source: 'GIIGNL Annual Report, Gassco, operator data', vintage: '2024' },
  { dataset: 'Chokepoint transit volumes', source: 'EIA World Oil Transit Chokepoints', vintage: '2024' },
  { dataset: 'Terminals, ports & refineries', source: 'EIA, company reports (Aramco, ADNOC…)', vintage: '2024' },
  { dataset: 'Pipeline routes', source: 'Global Energy Monitor trackers, manual tracing', vintage: '2024' },
  { dataset: 'Oil & gas fields', source: 'Global Energy Monitor, EIA, operator data', vintage: '2024' },
  { dataset: 'Container corridors & ports', source: 'Lloyd’s List One Hundred Ports, manual tracing', vintage: '2024' },
]

export function DataSourcesModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] rounded border border-border bg-surface shadow-2xl shadow-black/50"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Data sources</h2>
            <p className="mt-0.5 text-[11px] text-text-muted">What feeds this map, and how much to trust it</p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none text-text-muted transition-colors hover:text-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-text-muted">
                <th className="pb-2 font-bold">Dataset</th>
                <th className="pb-2 font-bold">Primary sources</th>
                <th className="pb-2 text-right font-bold">Vintage</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(row => (
                <tr key={row.dataset} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium text-text">{row.dataset}</td>
                  <td className="py-2 pr-3 text-text-muted">{row.source}</td>
                  <td className="py-2 text-right font-mono text-text-muted">{row.vintage}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 rounded border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] leading-relaxed text-text-muted">
            <span className="font-bold uppercase text-amber">Curated demonstration dataset.</span>{' '}
            Values are realistic 2024 orders of magnitude assembled from public sources for
            visualization and scenario exploration — not a live data feed. Each record carries its
            own source attribution and confidence level, visible in the detail panels.
          </div>
        </div>
      </div>
    </div>
  )
}
