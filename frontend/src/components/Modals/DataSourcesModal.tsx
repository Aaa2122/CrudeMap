import { pastel, ui } from '../../uiTheme'

interface Props {
  onClose: () => void
}

const SOURCES = [
  { dataset: 'Country oil balances', source: 'JODI Oil + historical EI/EIA fallback', vintage: '2026 YTD' },
  { dataset: 'Country gas balances', source: 'JODI Gas + EIA International annual fallback', vintage: '2026 YTD / 2024' },
  { dataset: 'Bilateral oil flows', source: 'UN Comtrade + Eurostat Comext + EIA U.S.', vintage: '2026 YTD / 2024' },
  { dataset: 'LNG & pipeline gas flows', source: 'UN Comtrade + Eurostat + EIA U.S. + ENTSOG', vintage: '2026 YTD / 2024' },
  { dataset: 'Chokepoint transit volumes', source: 'EIA World Oil Transit Chokepoints', vintage: '2024' },
  { dataset: 'Terminals, ports & refineries', source: 'EIA, company reports (Aramco, ADNOC…)', vintage: '2024' },
  { dataset: 'Pipeline routes', source: 'Global Energy Monitor trackers, manual tracing', vintage: '2024' },
  { dataset: 'Oil & gas fields', source: 'Global Energy Monitor, EIA, operator data', vintage: '2024' },
  { dataset: 'Container corridors & ports', source: 'Lloyd’s List One Hundred Ports, manual tracing', vintage: '2024' },
]

export function DataSourcesModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[580px] max-w-[92vw] rounded-panel bg-surface shadow-pop"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Data sources</h2>
            <p className="mt-0.5 text-[12px] text-text-muted">What feeds this map, and how much to trust it</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-inset hover:text-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-6 pb-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="section-label">
                <th className="pb-2 font-medium">Dataset</th>
                <th className="pb-2 font-medium">Primary sources</th>
                <th className="pb-2 text-right font-medium">Vintage</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(row => (
                <tr key={row.dataset} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium text-text">{row.dataset}</td>
                  <td className="py-2 pr-3 text-text-muted">{row.source}</td>
                  <td className="py-2 text-right font-mono text-text-muted">{row.vintage}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 rounded-ctl px-4 py-3 text-[12px] leading-relaxed" style={pastel(ui.oil)}>
            <span className="font-semibold">Mixed-vintage verified snapshot.</span>{' '}
            <span className="text-text-muted">
              JODI country observations come from 2026 monthly publications and are clearly marked
              as annualized YTD. ENTSOG pipeline flows are daily physical observations converted from
              energy to volume and annualized over the stated period. Uncovered values retain their older
              stated vintage; they are never relabelled as 2026. Period, source and confidence remain visible.
            </span>
          </div>

          {/* About (migrated from the removed footer) */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-text-muted">
            <span>Crude oil & natural gas network · partial 2026 YTD coverage</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ui.safe }} />
              Live · v1.2.0
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
