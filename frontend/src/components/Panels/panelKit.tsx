import type { ReactNode } from 'react'

/** Sentence-case muted section heading. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label mt-1">{children}</div>
}

/** iOS-style inset group: rounded grey container with hairline-divided rows. */
export function InsetGroup({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-ctl bg-inset">{children}</div>
}

export function InsetRow({
  label,
  value,
  valueColor,
  onClick,
}: {
  label: string
  value: ReactNode
  valueColor?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="text-[12px] text-text-muted">{label}</span>
      <span
        className="font-mono text-[12px] font-medium text-text"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </>
  )
  if (onClick) {
    return (
      <button onClick={onClick} className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-black/[0.03]">
        {content}
      </button>
    )
  }
  return <div className="flex items-center justify-between px-3.5 py-2">{content}</div>
}

/** Pastel capsule badge (12% tint background, full-strength text). */
export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
      style={{ background: `${color}1f`, color }}
    >
      {children}
    </span>
  )
}

/** Rounded progress bar on an inset track. */
export function MeterBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}
