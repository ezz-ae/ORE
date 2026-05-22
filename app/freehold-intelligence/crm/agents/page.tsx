import { UserCheck } from 'lucide-react'

const AGENTS = [
  { name: 'Ahmad K.', leads: 12, hot: 3, status: 'Active' },
  { name: 'Sara M.', leads: 9, hot: 2, status: 'Active' },
  { name: 'Rami T.', leads: 7, hot: 1, status: 'Follow-up delayed' },
]

export default function CrmAgentsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
        <UserCheck className="h-3.5 w-3.5" /> Agents
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        Sales team<br/><span className="text-white/35">performance.</span>
      </h1>
      <div className="mt-10 grid gap-4">
        {AGENTS.map((agent) => (
          <div key={agent.name} className="flex items-center justify-between rounded-[20px] border border-white/[0.06] bg-[#0A0D10] px-6 py-5">
            <div>
              <div className="text-lg font-semibold text-white">{agent.name}</div>
              <div className="mt-1 text-[12px] text-white/45">{agent.status}</div>
            </div>
            <div className="flex gap-6 text-center">
              <div><div className="text-[22px] font-semibold text-white">{agent.leads}</div><div className="text-[10px] text-white/35">Leads</div></div>
              <div><div className="text-[22px] font-semibold text-red-400">{agent.hot}</div><div className="text-[10px] text-white/35">Hot</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
