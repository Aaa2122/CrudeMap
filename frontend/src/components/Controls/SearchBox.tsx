import { useEffect, useMemo, useRef, useState } from 'react'
import { useChokepoints } from '../../api/hooks/useChokepoints'
import { useCountries } from '../../api/hooks/useCountries'
import { useFieldsData } from '../../api/hooks/useFields'
import { useInfrastructures } from '../../api/hooks/useInfrastructures'
import type { SelectableEntity } from '../../api/types'
import { useMapStore } from '../../store/mapStore'

interface SearchResult {
  label: string
  sublabel: string
  group: string
  icon: string
  entity: NonNullable<SelectableEntity>
}

const GROUP_ORDER = ['Countries', 'Chokepoints', 'Infrastructure', 'Fields']

function matches(query: string, ...haystacks: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase()
  return haystacks.some(h => h?.toLowerCase().includes(q))
}

/** Client-side search across everything already loaded; select = fly to + open panel. */
export function SearchBox() {
  const { setSelected } = useMapStore()
  const { data: countries } = useCountries()
  const { data: chokepoints } = useChokepoints()
  const { data: infras } = useInfrastructures()
  const { data: fields } = useFieldsData()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim()
    if (q.length < 2) return []

    const found: SearchResult[] = []
    for (const c of countries ?? []) {
      if (matches(q, c.name, c.iso)) {
        found.push({
          label: c.name,
          sublabel: `${c.iso} · ${c.region ?? ''}`,
          group: 'Countries',
          icon: 'public',
          entity: { type: 'country', iso: c.iso },
        })
      }
    }
    for (const cp of chokepoints ?? []) {
      if (matches(q, cp.name, cp.slug)) {
        found.push({
          label: cp.name,
          sublabel: `${cp.oil_transit_mbd} Mb/d · ${cp.risk_level} risk`,
          group: 'Chokepoints',
          icon: 'warning',
          entity: { type: 'chokepoint', slug: cp.slug },
        })
      }
    }
    for (const i of infras ?? []) {
      if (matches(q, i.name, i.operator)) {
        found.push({
          label: i.name,
          sublabel: `${i.type?.replace('_', ' ')} · ${i.country_iso ?? ''}`,
          group: 'Infrastructure',
          icon: i.type === 'pipeline' ? 'timeline' : 'factory',
          entity: { type: 'infrastructure', id: i.id },
        })
      }
    }
    for (const f of fields ?? []) {
      if (matches(q, f.name, f.operator)) {
        found.push({
          label: f.name,
          sublabel: `${f.commodity} field · ${f.country_iso ?? ''}`,
          group: 'Fields',
          icon: 'oil_barrel',
          entity: { type: 'field', id: f.id },
        })
      }
    }

    found.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    return found.slice(0, 12)
  }, [query, countries, chokepoints, infras, fields])

  useEffect(() => setHighlighted(0), [query])

  // Close on outside click
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Global "/" shortcut focuses the search box
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const select = (result: SearchResult) => {
    setSelected(result.entity)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (event.key === 'Enter' && results[highlighted]) {
      event.preventDefault()
      select(results[highlighted])
    } else if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  let lastGroup = ''

  return (
    <div ref={rootRef} className="relative w-[260px]">
      <div className="flex h-8 items-center gap-2 rounded-full bg-inset px-3 transition-shadow focus-within:ring-2 focus-within:ring-primary/30">
        <span className="material-symbols-outlined text-text-muted" style={{ fontSize: '0.9rem' }}>search</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search the network…"
          className="w-full bg-transparent text-[12px] text-text placeholder:text-text-muted/60 focus:outline-none"
        />
        <kbd className="rounded-md bg-surface px-1.5 font-mono text-[9px] text-text-muted shadow-sm">/</kbd>
      </div>

      {open && results.length > 0 && (
        <div className="floating-card absolute left-0 right-0 top-full z-50 mt-2 max-h-[340px] overflow-y-auto py-1.5">
          {results.map((result, index) => {
            const showGroup = result.group !== lastGroup
            lastGroup = result.group
            return (
              <div key={`${result.group}-${result.label}-${index}`}>
                {showGroup && (
                  <div className="section-label px-3.5 pt-2 pb-0.5">
                    {result.group}
                  </div>
                )}
                <button
                  // pointerdown (not click): selecting closes the dropdown, and a
                  // click would race against the unmount/blur of its own row
                  onPointerDown={event => {
                    event.preventDefault()
                    select(result)
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-lg px-3.5 py-1.5 text-left transition-colors ${
                    index === highlighted ? 'bg-inset text-text' : 'text-text-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '0.95rem' }}>
                    {result.icon}
                  </span>
                  <span className="flex-1 truncate">
                    <span className="block text-[12px] font-medium text-text">{result.label}</span>
                    <span className="block truncate text-[10px] text-text-muted">{result.sublabel}</span>
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
