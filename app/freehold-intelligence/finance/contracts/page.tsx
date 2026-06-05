import { FileCheck, Calendar, ExternalLink } from 'lucide-react'

interface Contract {
  id: string
  name: string
  type: 'agency' | 'platform' | 'data' | 'legal'
  counterparty: string
  value: string
  startDate: string
  endDate: string
  status: 'active' | 'expiring' | 'expired' | 'draft'
  autoRenew: boolean
}

const contracts: Contract[] = [
  {
    id: 'CTR-001', name: 'Meta Business Agreement',
    type: 'platform', counterparty: 'Meta Platforms Inc.',
    value: 'AED 25,000 / mo', startDate: 'Jan 2025', endDate: 'Dec 2026',
    status: 'active', autoRenew: true,
  },
  {
    id: 'CTR-002', name: 'Google Ads Terms of Service',
    type: 'platform', counterparty: 'Google LLC',
    value: 'AED 18,000 / mo', startDate: 'Jan 2025', endDate: 'Dec 2026',
    status: 'active', autoRenew: true,
  },
  {
    id: 'CTR-003', name: 'DLD Data Feed License',
    type: 'data', counterparty: 'Dubai Land Department',
    value: 'AED 12,000 / yr', startDate: 'Mar 2025', endDate: 'Feb 2027',
    status: 'active', autoRenew: false,
  },
  {
    id: 'CTR-004', name: 'PropTrack Data API',
    type: 'data', counterparty: 'PropTrack DMCC',
    value: 'AED 8,400 / yr', startDate: 'Jun 2025', endDate: 'May 2026',
    status: 'expiring', autoRenew: false,
  },
  {
    id: 'CTR-005', name: 'Agency Retainer — Digital Media',
    type: 'agency', counterparty: 'Pixel House Agency LLC',
    value: 'AED 15,000 / mo', startDate: 'Oct 2025', endDate: 'Sep 2026',
    status: 'active', autoRenew: false,
  },
  {
    id: 'CTR-006', name: 'Legal Advisory — Real Estate',
    type: 'legal', counterparty: 'Al Tamimi & Company',
    value: 'AED 5,000 / mo', startDate: 'Jan 2026', endDate: 'Dec 2026',
    status: 'active', autoRenew: true,
  },
]

const TYPE_LABEL: Record<Contract['type'], string> = {
  agency: 'Agency', platform: 'Platform', data: 'Data', legal: 'Legal',
}

const STATUS_CLASS: Record<Contract['status'], string> = {
  active:   'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]',
  expiring: 'border-amber-400/20 bg-amber-400/10 text-amber-400',
  expired:  'border-red-400/20 bg-red-400/10 text-red-400',
  draft:    'border-white/[0.08] bg-white/[0.04] text-white/40',
}

export default function ContractsPage() {
  const expiring = contracts.filter((c) => c.status === 'expiring')

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Contracts</h1>
        <p className="mt-1 text-sm text-white/40">Active agreements, renewals, and platform terms</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Contracts', value: contracts.length },
          { label: 'Active',          value: contracts.filter((c) => c.status === 'active').length },
          { label: 'Expiring Soon',   value: expiring.length, accent: expiring.length > 0 ? 'text-amber-400' : undefined },
          { label: 'Auto-Renew',      value: contracts.filter((c) => c.autoRenew).length },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-white/80'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Expiring banner */}
      {expiring.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 flex items-start gap-3">
          <Calendar className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-medium text-amber-300">Renewal action required</div>
            <div className="mt-0.5 text-[13px] text-white/50">
              {expiring.map((c) => c.name).join(', ')} expire{expiring.length === 1 ? 's' : ''} within 30 days.
            </div>
          </div>
        </div>
      )}

      {/* Contracts table */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Contract', 'Type', 'Counterparty', 'Value', 'Term', 'Auto-Renew', 'Status', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {contracts.map((c) => (
                <tr key={c.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <div className="font-medium text-white/85">{c.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/30">{c.id}</div>
                  </td>
                  <td className="px-5 py-4 text-[13px] text-white/50">{TYPE_LABEL[c.type]}</td>
                  <td className="px-5 py-4 text-white/65">{c.counterparty}</td>
                  <td className="px-5 py-4 tabular-nums text-white/70">{c.value}</td>
                  <td className="px-5 py-4 text-[13px] text-white/45">{c.startDate} – {c.endDate}</td>
                  <td className="px-5 py-4 text-[13px]">
                    <span className={c.autoRenew ? 'text-[#D4AF37]' : 'text-white/30'}>{c.autoRenew ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium ${STATUS_CLASS[c.status]}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button className="inline-flex items-center gap-1 text-[13px] text-white/30 transition hover:text-white/60">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
