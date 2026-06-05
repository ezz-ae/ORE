import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function LandingBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    live:           'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
    draft:          'bg-amber-400/10 text-amber-300 border-amber-400/20',
    pending_review: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
    missing:        'bg-red-400/10 text-white/50 border-red-400/20',
  }
  const label: Record<string, string> = { live: 'Live', draft: 'Draft', pending_review: 'Pending', missing: 'Missing' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${map[status]}`}>
      {label[status] ?? status}
    </span>
  )
}

export default function ReadyPage() {
  const props = inventoryProperties
    .filter((p) => p.status === 'ready' || p.status === 'active')
    .sort((a, b) => b.leads30d - a.leads30d)

  const totalLeads = props.reduce((s, p) => s + p.leads30d, 0)
  const liveLandings = props.filter((p) => p.landingStatus === 'live').length
  const missingLandings = props.filter((p) => p.landingStatus === 'missing').length

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Ready Properties</h1>
        <p className="mt-1 text-sm text-white/40">Available and move-in-ready inventory</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Ready Units',      value: props.length },
          { label: 'Live Landings',    value: liveLandings, accent: 'text-[#D4AF37]' },
          { label: 'Missing Landing',  value: missingLandings, accent: missingLandings > 0 ? 'text-red-400' : undefined },
          { label: '30d Total Leads',  value: totalLeads, accent: 'text-[#D4AF37]' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-white/80'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Alert for missing landings */}
      {missingLandings > 0 && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.04] px-5 py-4 text-[13px]">
          <span className="font-medium text-red-400">{missingLandings} ready propert{missingLandings !== 1 ? 'ies are' : 'y is'} missing a landing page</span>
          <span className="ml-2 text-white/40">— these are losing leads without an ad destination.</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Property', 'Area / Dev', 'From', 'ROI %', 'Bedrooms', 'Landing', 'Ad Readiness', 'Leads 30d', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {props.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-[13px] text-white/30">No ready properties found.</td></tr>
              ) : props.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/[0.02]">
                  <td className="max-w-[200px] pl-5 pr-4 py-3.5">
                    <div className="truncate font-medium text-white/85">{p.name}</div>
                    <div className="mt-0.5 text-[12px] capitalize text-white/35">{p.type}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-white/65">{p.area}</div>
                    <div className="mt-0.5 text-[12px] text-white/35">{p.developer}</div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-white/65">{formatPrice(p.startingPriceAED)}</td>
                  <td className="px-4 py-3.5 tabular-nums">
                    {p.roi !== null
                      ? <span className="text-[#D4AF37]">{p.roi.toFixed(1)}%</span>
                      : <span className="text-white/25">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-white/55">{p.bedrooms}</td>
                  <td className="px-4 py-3.5"><LandingBadge status={p.landingStatus} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${p.adReadiness}%` }} />
                      </div>
                      <span className="text-[12px] text-white/40 tabular-nums">{p.adReadiness}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums">
                    {p.leads30d > 0 ? <span className="text-white/75">{p.leads30d}</span> : <span className="text-white/25">0</span>}
                  </td>
                  <td className="pr-5 pl-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/freehold-intelligence/inventory/${p.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-white/55 transition hover:border-white/20 hover:text-white">
                        View <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      <Link href={`/freehold-intelligence/inventory/${p.id}/generate`}
                        className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-1 text-[12px] text-[#D4AF37]/80 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37]">
                        <Sparkles className="h-3 w-3" /> LP
                      </Link>
                    </div>
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
