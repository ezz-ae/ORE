import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

const STATUS_LABEL: Record<string, string> = {
  off_plan: 'Off Plan', under_construction: 'Under Construction', coming_soon: 'Coming Soon',
}
const STATUS_CLASS: Record<string, string> = {
  off_plan:           'bg-blue-400/10 text-blue-300 border-blue-400/20',
  under_construction: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  coming_soon:        'bg-white/[0.06] text-white/45 border-white/[0.10]',
}

export default function OffPlanPage() {
  const props = inventoryProperties
    .filter((p) => ['off_plan', 'under_construction', 'coming_soon'].includes(p.status))
    .sort((a, b) => b.leads30d - a.leads30d)

  const handovers = props.filter((p) => p.handoverYear).reduce<Record<number, number>>((acc, p) => {
    acc[p.handoverYear!] = (acc[p.handoverYear!] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Off-Plan</h1>
        <p className="mt-1 text-sm text-white/40">Pre-launch and under-construction properties</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Off-Plan',           value: props.filter((p) => p.status === 'off_plan').length },
          { label: 'Under Construction', value: props.filter((p) => p.status === 'under_construction').length, accent: 'text-amber-400' },
          { label: 'Coming Soon',        value: props.filter((p) => p.status === 'coming_soon').length },
          { label: '30d Leads',          value: props.reduce((s, p) => s + p.leads30d, 0), accent: 'text-[#D4AF37]' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-white/80'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Handover timeline */}
      {Object.keys(handovers).length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="text-[12px] font-medium uppercase tracking-wider text-white/30 self-center">Handover:</span>
          {Object.entries(handovers).sort().map(([yr, count]) => (
            <div key={yr} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-[13px]">
              <span className="font-medium text-white/70">{yr}</span>
              <span className="ml-2 text-white/35">{count} project{count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Property', 'Area', 'Status', 'From', 'Handover', 'Payment Plan', 'Readiness', 'Leads 30d', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {props.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-[13px] text-white/30">No off-plan properties.</td></tr>
              ) : props.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/[0.02]">
                  <td className="max-w-[200px] pl-5 pr-4 py-3.5">
                    <div className="truncate font-medium text-white/85">{p.name}</div>
                    <div className="mt-0.5 text-[12px] text-white/35">{p.developer}</div>
                  </td>
                  <td className="px-4 py-3.5 text-white/60">{p.area}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${STATUS_CLASS[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-white/65">{formatPrice(p.startingPriceAED)}</td>
                  <td className="px-4 py-3.5 text-[13px] text-white/50">{p.handoverYear ?? '—'}</td>
                  <td className="px-4 py-3.5 text-[13px] text-white/45">{p.paymentPlan ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${p.adReadiness}%` }} />
                      </div>
                      <span className="text-[12px] text-white/40 tabular-nums">{p.adReadiness}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-white/65">{p.leads30d}</td>
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
