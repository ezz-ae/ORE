import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

function QualityBand({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-[#D4AF37]' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'
  const label = value >= 80 ? 'Good' : value >= 50 ? 'Needs Work' : 'Poor'
  const textColor = value >= 80 ? 'text-[#D4AF37]' : value >= 50 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-[12px] font-medium tabular-nums ${textColor}`}>{value}</span>
      <span className={`text-[11px] ${textColor} opacity-60`}>{label}</span>
    </div>
  )
}

const ISSUE_TYPES = [
  { key: 'noImages',        label: 'No images',               check: (p: (typeof inventoryProperties)[0]) => !p.hasImages },
  { key: 'lowImageCount',   label: 'Fewer than 5 images',     check: (p: (typeof inventoryProperties)[0]) => p.hasImages && p.imageCount < 5 },
  { key: 'noLanding',       label: 'No landing page',         check: (p: (typeof inventoryProperties)[0]) => p.landingStatus === 'missing' },
  { key: 'lowQuality',      label: 'Data quality < 60',       check: (p: (typeof inventoryProperties)[0]) => p.dataQuality < 60 },
  { key: 'noCampaigns',     label: 'No linked campaigns',     check: (p: (typeof inventoryProperties)[0]) => p.linkedCampaigns === 0 },
]

export default function DataQualityPage() {
  const sorted = [...inventoryProperties].sort((a, b) => a.dataQuality - b.dataQuality)

  const poorCount  = sorted.filter((p) => p.dataQuality < 50).length
  const needsCount = sorted.filter((p) => p.dataQuality >= 50 && p.dataQuality < 80).length
  const goodCount  = sorted.filter((p) => p.dataQuality >= 80).length
  const avgQuality = Math.round(sorted.reduce((s, p) => s + p.dataQuality, 0) / sorted.length)

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Data Quality</h1>
        <p className="mt-1 text-sm text-white/40">Completeness and readiness scores across all inventory</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Avg Quality',  value: `${avgQuality}%`, accent: avgQuality >= 70 ? 'text-[#D4AF37]' : 'text-amber-400' },
          { label: 'Good (≥80)',   value: goodCount,         accent: 'text-[#D4AF37]' },
          { label: 'Needs Work',   value: needsCount,        accent: 'text-amber-400' },
          { label: 'Poor (<50)',   value: poorCount,         accent: poorCount > 0 ? 'text-red-400' : undefined },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/35">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-white/80'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Issue summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ISSUE_TYPES.map(({ key, label, check }) => {
          const affected = sorted.filter(check).length
          return (
            <div key={key} className={`rounded-2xl border px-5 py-4 flex items-center justify-between ${
              affected === 0
                ? 'border-[#D4AF37]/15 bg-[#D4AF37]/[0.03]'
                : affected <= 2
                ? 'border-amber-400/15 bg-amber-400/[0.03]'
                : 'border-red-400/15 bg-red-400/[0.03]'
            }`}>
              <div className="flex items-center gap-2.5">
                {affected === 0
                  ? <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400" />
                }
                <span className="text-[13px] text-white/70">{label}</span>
              </div>
              <span className={`text-[15px] font-semibold tabular-nums ${
                affected === 0 ? 'text-[#D4AF37]' : affected <= 2 ? 'text-amber-400' : 'text-red-400'
              }`}>{affected}</span>
            </div>
          )
        })}
      </div>

      {/* Full table */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Property', 'Developer', 'Images', 'Landing', 'Campaigns', 'Data Quality', 'Ad Readiness', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-white/35">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sorted.map((p) => (
                <tr key={p.id} className={`transition hover:bg-white/[0.02] ${p.dataQuality < 50 ? 'bg-red-400/[0.02]' : ''}`}>
                  <td className="max-w-[200px] pl-5 pr-4 py-3.5">
                    <div className="truncate font-medium text-white/85">{p.name}</div>
                    <div className="mt-0.5 text-[12px] text-white/35">{p.area}</div>
                  </td>
                  <td className="px-4 py-3.5 text-white/55">{p.developer}</td>
                  <td className="px-4 py-3.5 text-[13px]">
                    <span className={p.hasImages ? (p.imageCount >= 5 ? 'text-[#D4AF37]' : 'text-amber-400') : 'text-red-400'}>
                      {p.hasImages ? `${p.imageCount}` : '0'}
                    </span>
                    <span className="ml-1 text-white/30">img</span>
                  </td>
                  <td className="px-4 py-3.5 text-[13px]">
                    <span className={
                      p.landingStatus === 'live' ? 'text-[#D4AF37]' :
                      p.landingStatus === 'missing' ? 'text-red-400' : 'text-amber-400'
                    }>
                      {p.landingStatus === 'live' ? 'Live' : p.landingStatus === 'missing' ? 'Missing' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[13px]">
                    <span className={p.linkedCampaigns > 0 ? 'text-white/65' : 'text-red-400'}>
                      {p.linkedCampaigns}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><QualityBand value={p.dataQuality} /></td>
                  <td className="px-4 py-3.5"><QualityBand value={p.adReadiness} /></td>
                  <td className="pr-5 pl-4 py-3.5">
                    <Link href={`/freehold-intelligence/inventory/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-white/50 transition hover:border-white/20 hover:text-white">
                      Fix <ArrowUpRight className="h-3 w-3" />
                    </Link>
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
