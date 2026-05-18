export function CrmFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#071811]/75">
      <div className="container flex flex-col gap-3 py-4 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#D4AC50]">Freehold</span>
          <p>Freehold CRM workspace for listings, leads, AI operations, and campaign management.</p>
        </div>
        <p>Internal use only.</p>
      </div>
    </footer>
  )
}
