import Link from 'next/link'
import { ArrowUpRight, Building2 } from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

export default function ProjectsPage() {
  // Group properties by developer
  const byDeveloper = inventoryProperties.reduce<Record<string, typeof inventoryProperties>>((acc, p) => {
    if (!acc[p.developer]) acc[p.developer] = []
    acc[p.developer].push(p)
    return acc
  }, {})

  const developers = Object.entries(byDeveloper).sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Projects</h1>
        <p className="mt-1 text-sm text-white/40">All properties grouped by developer</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Developers',  value: developers.length },
          { label: 'Total Units', value: inventoryProperties.length },
          { label: 'Live Landings', value: inventoryProperties.filter((p) => p.landingStatus === 'live').length, accent: 'text-[#D4AF37]' },
          { label: 'Active Campaigns', value: inventoryProperties.reduce((s, p) => s + p.linkedCampaigns, 0) },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-white/80'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Developer groups */}
      <div className="space-y-5">
        {developers.map(([developer, props]) => {
          const totalLeads = props.reduce((s, p) => s + p.leads30d, 0)
          const avgReadiness = Math.round(props.reduce((s, p) => s + p.adReadiness, 0) / props.length)

          return (
            <div key={developer} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
              {/* Developer header */}
              <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                    <Building2 className="h-3.5 w-3.5 text-white/55" />
                  </div>
                  <span className="font-medium text-white/85">{developer}</span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[12px] text-white/45">
                    {props.length} project{props.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[13px] text-white/40">
                  <span>Avg readiness <span className="text-[#D4AF37] tabular-nums">{avgReadiness}%</span></span>
                  <span>30d leads <span className="text-white/70 tabular-nums">{totalLeads}</span></span>
                </div>
              </div>

              {/* Properties table */}
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/[0.03]">
                  {props.map((p) => (
                    <tr key={p.id} className="transition hover:bg-white/[0.02]">
                      <td className="max-w-[240px] pl-5 pr-4 py-3.5">
                        <div className="truncate font-medium text-white/80">{p.name}</div>
                        <div className="mt-0.5 text-[12px] text-white/35 capitalize">{p.area} · {p.type}</div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-white/60">{formatPrice(p.startingPriceAED)}</td>
                      <td className="px-4 py-3.5 text-[13px] text-white/45">{p.bedrooms} BR</td>
                      <td className="px-4 py-3.5 tabular-nums text-white/50">
                        {p.leads30d > 0 ? <span className="text-white/75">{p.leads30d}</span> : <span className="text-white/25">0</span>} leads
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                            <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${p.adReadiness}%` }} />
                          </div>
                          <span className="text-[12px] text-white/40 tabular-nums">{p.adReadiness}%</span>
                        </div>
                      </td>
                      <td className="pr-5 pl-4 py-3.5 text-right">
                        <Link
                          href={`/freehold-intelligence/inventory/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[13px] text-white/55 transition hover:border-white/20 hover:text-white"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
