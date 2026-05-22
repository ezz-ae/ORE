import { Users } from 'lucide-react'

export default function CrmPipelinePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
        <Users className="h-3.5 w-3.5" /> Pipeline
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        Sales pipeline<br/><span className="text-white/35">by stage.</span>
      </h1>
      <p className="mt-5 text-[16px] text-white/55">Kanban view and stage-by-stage breakdown — connecting to HubSpot pipeline.</p>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {['New Lead', 'Contacted', 'Viewing', 'Negotiation', 'Won'].map((stage, i) => (
          <div key={stage} className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">{stage}</div>
            <div className="mt-3 text-[28px] font-semibold text-white">{[3,5,2,1,1][i]}</div>
            <div className="text-[11px] text-white/35">leads</div>
          </div>
        ))}
      </div>
    </div>
  )
}
