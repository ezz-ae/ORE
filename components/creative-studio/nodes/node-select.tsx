'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

// Native <select> for React Flow nodes. Radix Select's portal + popper
// positioning fights React Flow's transformed pane, producing an empty,
// unclickable trigger inside node cards. The OS-native select is always
// clickable, always shows the current value, and works on mobile. nodrag/nopan
// stop the canvas panning while the user interacts with it.
export function NodeSelect({
  value, onChange, options, className, ariaLabel, mono, disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  ariaLabel?: string
  mono?: boolean
  disabled?: boolean
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <div className={`relative ${className ?? ''}`} onPointerDown={stop} onMouseDown={stop}>
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={stop}
        onPointerDown={stop}
        onMouseDown={stop}
        className={`nodrag nopan h-8 w-full cursor-pointer appearance-none rounded-md border border-input bg-background ps-3 pe-8 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 ${mono ? 'font-mono' : ''}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
