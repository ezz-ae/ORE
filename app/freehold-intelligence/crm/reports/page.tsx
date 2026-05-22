import { TrendingUp } from 'lucide-react'

export default function CrmReportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
        <TrendingUp className="h-3.5 w-3.5" /> Reports
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        CRM reports<br/><span className="text-white/35">coming soon.</span>
      </h1>
      <p className="mt-5 text-[16px] text-white/55">Lead source breakdown, conversion rates, and agent performance analytics.</p>
    </div>
  )
}
