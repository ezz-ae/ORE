import Link from 'next/link'
import { FileCheck, AlertCircle, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { getIntegrationStatusSummary } from '@/lib/freehold/integration-status'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { PageHeader, Panel } from '@/components/freehold/ui'
import { getServerT } from '@/lib/i18n/server'

// Launch requirements — DERIVED LIVE from the real system state: which
// integrations still need connecting and which projects lack the assets a
// campaign needs. Nothing on this page is a hardcoded to-do.

interface Req {
  id: string
  severity: 'critical' | 'high'
  title: string
  desc: string
  href: string
  cta: string
}

export const dynamic = 'force-dynamic'

export default async function RequirementsPage() {
  const { t } = await getServerT()
  const [summary, props] = await Promise.all([
    getIntegrationStatusSummary().catch(() => null),
    getInventoryPropertiesFromDB().catch(() => [] as Awaited<ReturnType<typeof getInventoryPropertiesFromDB>>),
  ])

  const reqs: Req[] = []

  // Integrations that block ad launches / lead capture.
  const CRITICAL = new Set(['neon', 'ai', 'session'])
  for (const s of summary?.statuses ?? []) {
    if (s.state === 'connected') continue
    if (!['meta-ads', 'google-ads', 'whatsapp', 'ai', 'neon', 'session'].includes(s.id)) continue
    reqs.push({
      id: s.id,
      severity: CRITICAL.has(s.id) ? 'critical' : 'high',
      title: t('lm.req.connect', { name: s.name }),
      desc: s.note,
      href: '/freehold-intelligence/integrations',
      cta: t('nav.integrations'),
    })
  }

  // Inventory gaps that block campaigns for specific projects.
  const missingLp = props.filter((p) => p.landingStatus === 'missing').length
  if (missingLp > 0) {
    reqs.push({
      id: 'missing-lp',
      severity: 'high',
      title: t('lm.req.missingLp', { n: missingLp }),
      desc: t('lm.req.missingLpDesc'),
      href: '/freehold-intelligence/inventory/landings',
      cta: t('lm.hub.nav.landings'),
    })
  }
  const noImages = props.filter((p) => !p.hasImages).length
  if (noImages > 0) {
    reqs.push({
      id: 'no-images',
      severity: 'high',
      title: t('lm.req.noImages', { n: noImages }),
      desc: t('lm.req.noImagesDesc'),
      href: '/freehold-intelligence/inventory/data-quality',
      cta: t('lm.req.dataQuality'),
    })
  }

  const critical = reqs.filter((r) => r.severity === 'critical')
  const high = reqs.filter((r) => r.severity === 'high')

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PageHeader
        eyebrow={t('lm.hub.eyebrow')}
        Icon={FileCheck}
        title={t('lm.req.title')}
        subtitle={t('lm.req.subtitle')}
      />

      {reqs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/[0.04] px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-gold" />
          <p className="mt-3 text-sm font-medium text-slate-200">{t('lm.req.allClear')}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {[...critical, ...high].map((r) => (
            <Panel key={r.id}>
              <div className="flex items-start gap-4 p-5">
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${r.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{r.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{r.desc}</div>
                </div>
                <Link href={r.href} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line-strong bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40 hover:text-white">
                  {r.cta} <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
