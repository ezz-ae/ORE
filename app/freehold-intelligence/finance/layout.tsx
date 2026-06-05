'use client'

export function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sticky top-[56px] z-30 border-b border-white/[0.08] bg-[#0B0F1A]/80 backdrop-blur-xl">
        <div className="flex h-12 items-center justify-between px-6">
          {/* Left: section title */}
          <span className="text-[13px] font-medium text-white/90">Finance & Billing</span>

          {/* Right: current month badge */}
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
            May 2026
          </div>
        </div>
      </div>

      {children}
    </>
  )
}

export default FinanceLayout
