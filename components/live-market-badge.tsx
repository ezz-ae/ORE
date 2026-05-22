"use client"

import { useEffect, useState } from "react"

const formatter = new Intl.DateTimeFormat("en-AE", {
  timeZone: "Asia/Dubai",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

export function LiveMarketBadge() {
  const [now, setNow] = useState<string>("")

  useEffect(() => {
    const tick = () => setNow(formatter.format(new Date()))
    tick()
    const id = setInterval(tick, 1000 * 30)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4AC50]/25 bg-gradient-to-r from-[#D4AC50]/15 via-[#D4AC50]/10 to-transparent px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F0D792] sm:px-4 sm:text-[11px] sm:tracking-[0.18em]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      </span>
      <span>Live Market Intelligence</span>
      {now && (
        <>
          <span className="hidden h-3 w-px bg-white/15 sm:inline-block" />
          <span className="hidden font-mono text-[10px] font-medium tracking-[0.08em] text-white/65 sm:inline tabular-nums">
            {now} GST
          </span>
        </>
      )}
    </div>
  )
}
