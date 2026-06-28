import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { inventoryProperties, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { getServerT } from '@/lib/i18n/server'

type TFn = (key: string, vars?: Record<string, string | number>) => string

function QualityBand({ value, t }: { value: number; t: TFn }) {
  const color = value >= 80 ? 'bg-gold' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'
  const label = value >= 80 ? t('inv.dq.band.good') : value >= 50 ? t('inv.dq.band.needsWork') : t('inv.dq.band.poor')
  const textColor = value >= 80 ? 'text-gold' : value >= 50 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{value}</span>
      <span className={`text-xs ${textColor} opacity-60`}>{label}</span>
    </div>
  )
}

const ISSUE_TYPES = [
  { key: 'noImages',        labelKey: 'inv.dq.issue.noImages',      check: (p: InventoryProperty) => !p.hasImages },
  { key: 'lowImageCount',   labelKey: 'inv.dq.issue.lowImageCount', check: (p: InventoryProperty) => p.hasImages && p.imageCount < 5 },
  { key: 'noLanding',       labelKey: 'inv.dq.issue.noLanding',     check: (p: InventoryProperty) => p.landingStatus === 'missing' },
  { key: 'lowQuality',      labelKey: 'inv.dq.issue.lowQuality',    check: (p: InventoryProperty) => p.dataQuality < 60 },
  { key: 'noCampaigns',     labelKey: 'inv.dq.issue.noCampaigns',   check: (p: InventoryProperty) => p.linkedCampaigns === 0 },
]

export default async function DataQualityPage() {
  const { t } = await getServerT()
  const dbProperties = await getInventoryPropertiesFromDB()
  const allProperties = dbProperties.length > 0 ? dbProperties : inventoryProperties
  const sorted = [...allProperties].sort((a, b) => a.dataQuality - b.dataQuality)

  const poorCount  = sorted.filter((p) => p.dataQuality < 50).length
  const needsCount = sorted.filter((p) => p.dataQuality >= 50 && p.dataQuality < 80).length
  const goodCount  = sorted.filter((p) => p.dataQuality >= 80).length
  const avgQuality = Math.round(sorted.reduce((s, p) => s + p.dataQuality, 0) / sorted.length)

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('inv.dq.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('inv.dq.subtitle')}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t('inv.dq.kpi.avgQuality'), value: `${avgQuality}%`, accent: avgQuality >= 70 ? 'text-gold' : 'text-amber-400' },
          { label: t('inv.dq.kpi.good'),       value: goodCount,         accent: 'text-gold' },
          { label: t('inv.dq.kpi.needsWork'),  value: needsCount,        accent: 'text-amber-400' },
          { label: t('inv.dq.kpi.poor'),       value: poorCount,         accent: poorCount > 0 ? 'text-red-400' : undefined },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
            <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ?? 'text-slate-300'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Issue summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ISSUE_TYPES.map(({ key, labelKey, check }) => {
          const affected = sorted.filter(check).length
          return (
            <div key={key} className={`rounded-2xl border px-5 py-4 flex items-center justify-between ${
              affected === 0
                ? 'border-gold/15 bg-gold/[0.03]'
                : affected <= 2
                ? 'border-amber-400/15 bg-amber-400/[0.03]'
                : 'border-red-400/15 bg-red-400/[0.03]'
            }`}>
              <div className="flex items-center gap-2.5">
                {affected === 0
                  ? <CheckCircle2 className="h-4 w-4 text-gold" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400" />
                }
                <span className="text-sm text-slate-300">{t(labelKey)}</span>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${
                affected === 0 ? 'text-gold' : affected <= 2 ? 'text-amber-400' : 'text-red-400'
              }`}>{affected}</span>
            </div>
          )
        })}
      </div>

      {/* Full table */}
      <div className="rounded-2xl border border-line bg-surface-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {[
                  ['inv.dq.col.property', t('inv.dq.col.property')],
                  ['inv.dq.col.developer', t('inv.dq.col.developer')],
                  ['inv.dq.col.images', t('inv.dq.col.images')],
                  ['inv.dq.col.landing', t('inv.dq.col.landing')],
                  ['inv.dq.col.campaigns', t('inv.dq.col.campaigns')],
                  ['inv.dq.col.dataQuality', t('inv.dq.col.dataQuality')],
                  ['inv.dq.col.adReadiness', t('inv.dq.col.adReadiness')],
                  ['__blank', ''],
                ].map(([k, h]) => (
                  <th key={k} className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((p) => (
                <tr key={p.id} className={`transition hover:bg-surface-2 ${p.dataQuality < 50 ? 'bg-red-400/[0.02]' : ''}`}>
                  <td className="max-w-[200px] pl-5 pr-4 py-3.5">
                    <div className="truncate font-medium text-slate-100">{p.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{p.area}</div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">{p.developer}</td>
                  <td className="px-4 py-3.5 text-sm">
                    <span className={p.hasImages ? (p.imageCount >= 5 ? 'text-gold' : 'text-amber-400') : 'text-red-400'}>
                      {p.hasImages ? `${p.imageCount}` : '0'}
                    </span>
                    <span className="ml-1 text-slate-500">{t('inv.dq.img')}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    <span className={
                      p.landingStatus === 'live' ? 'text-gold' :
                      p.landingStatus === 'missing' ? 'text-red-400' : 'text-amber-400'
                    }>
                      {p.landingStatus === 'live' ? t('inv.landing.live') : p.landingStatus === 'missing' ? t('inv.landing.missing') : t('inv.landing.draft')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    <span className={p.linkedCampaigns > 0 ? 'text-slate-300' : 'text-red-400'}>
                      {p.linkedCampaigns}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><QualityBand value={p.dataQuality} t={t} /></td>
                  <td className="px-4 py-3.5"><QualityBand value={p.adReadiness} t={t} /></td>
                  <td className="pr-5 pl-4 py-3.5">
                    <Link href={`/freehold-intelligence/inventory/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-slate-400 transition hover:border-white/20 hover:text-white">
                      {t('inv.dq.fix')} <ArrowUpRight className="h-3 w-3" />
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
