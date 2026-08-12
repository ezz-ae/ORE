import Link from 'next/link'
import { Zap, ArrowUpRight, FileText, Megaphone, Search, Monitor, AlertOctagon, Bot, ClipboardList } from 'lucide-react'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { PageHeader, StatCard, Section, Panel, buttonClass } from '@/components/freehold/ui'
import { MachinePulse } from '@/components/freehold/machine-pulse'
import LiveCampaignsWidget from '@/components/freehold/lead-machine/live-campaigns-widget'
import RocketAdWidget from '@/components/freehold/lead-machine/rocket-ad-widget'
import RatingLoopWidget from '@/components/freehold/rating-loop-widget'
import { getServerT } from '@/lib/i18n/server'

// The Lead Machine pipeline — LIVE data only. The mental model on this page:
//   Inventory (projects on the site) → Landing pages (selling pages) →
//   Meta / Google campaigns → live leads. No seed rows, no fake scores.

function scoreText(score: number) {
  if (score >= 80) return 'text-gold'
  if (score >= 50) return 'text-gold-bright'
  return 'text-red-300'
}
function scoreBg(score: number) {
  return score >= 50 ? 'bg-gold' : 'bg-red-400'
}
function landingTone(status: string) {
  if (status === 'live') return 'border-gold/20 bg-gold/10 text-gold'
  if (status === 'missing') return 'border-red-400/20 bg-red-400/10 text-red-300'
  return 'border-line-strong bg-surface-2 text-slate-400'
}

export default async function LeadMachineOverviewPage() {
  const { t } = await getServerT()
  const props = await getInventoryPropertiesFromDB()

  const livePages = props.filter((p) => p.landingStatus === 'live').length
  const missingPages = props.filter((p) => p.landingStatus === 'missing').length
  const adReady = props.filter((p) => p.adReadiness >= 80).length
  const matrix = [...props].sort((a, b) => b.adReadiness - a.adReadiness).slice(0, 10)

  const navSections = [
    {
      label: t('lm.hub.nav.machine'),
      href: '/freehold-intelligence/lead-machine/ads-machine',
      icon: Bot,
      desc: t('lm.hub.nav.machine.desc'),
    },
    {
      label: t('lm.hub.nav.landings'),
      href: '/freehold-intelligence/inventory/landings',
      icon: Monitor,
      desc: t('lm.hub.nav.landings.desc'),
      // Don't advertise "0 pages" — the count only helps once there are pages.
      count: livePages > 0 ? `${livePages} ${t('lm.hub.count.pages')}` : undefined,
    },
    {
      label: t('lm.hub.nav.metaCampaigns'),
      href: '/freehold-intelligence/lead-machine/campaigns',
      icon: Megaphone,
      desc: t('lm.hub.nav.metaCampaigns.desc'),
    },
    {
      label: t('lm.hub.nav.forms'),
      href: '/freehold-intelligence/lead-machine/forms',
      icon: ClipboardList,
      desc: t('lm.hub.nav.forms.desc'),
    },
    {
      label: t('lm.hub.nav.google'),
      href: '/freehold-intelligence/lead-machine/google',
      icon: Search,
      desc: t('lm.hub.nav.google.desc'),
    },
    {
      label: t('lm.hub.nav.adRequests'),
      href: '/freehold-intelligence/lead-machine/ad-requests',
      icon: FileText,
      desc: t('lm.hub.nav.adRequests.desc'),
    },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <PageHeader
        eyebrow={t('lm.hub.eyebrow')}
        Icon={Zap}
        title={t('lm.hub.titleDefault')}
        subtitle={t('lm.hub.flow')}
        actions={
          <>
            <Link href="/freehold-intelligence/lead-machine/campaigns/new" className={buttonClass('primary', 'md')}>
              <Zap className="h-3.5 w-3.5" /> {t('lm.hub.launch')}
            </Link>
            <Link href="/freehold-intelligence/lead-machine/campaigns" className={buttonClass('secondary', 'md')}>
              {t('lm.hub.allCampaigns')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      {/* THE MACHINE, FIRST. This page used to open with inventory readiness —
          how many projects have a landing page and what their data-quality
          score is. Useful, and not the subject: the subject is a machine
          spending money on decisions it can explain, and none of that was
          visible without clicking into an individual machine. */}
      {/* THE WIDGETS. This is the ads home, so it opens with the two things
          an operator comes here for: what the money is doing right now, and
          the fastest way to start something new. Everything below is context
          for those two. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <LiveCampaignsWidget />
        <RocketAdWidget />
        {/* WHAT THE TEAM'S RATINGS ARE DOING. It sits on the ads home rather
            than in the CRM on purpose: the people who need to see that the
            ratings are working are the ones spending the money, and a team
            that cannot see the effect stops rating within a week — which
            costs the single strongest signal this product has. */}
        <RatingLoopWidget />
      </div>

      <MachinePulse />

      {/* Inventory readiness — still here, now below the machine. It answers
          "what could I launch next", which is a real question and a second
          one. */}
      {props.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('lm.hub.stat.projects')} value={props.length} hint={t('lm.hub.stat.fromInventory')} />
          <StatCard label={t('lm.hub.stat.landingsReady')} value={livePages} hint={t('lm.hub.stat.canLaunch')} />
          <StatCard label={t('lm.hub.stat.missingPages')} value={missingPages} hint={t('lm.hub.stat.generateThem')} />
          <StatCard label={t('lm.hub.stat.adReady')} value={adReady} hint={t('lm.hub.stat.score80')} />
        </div>
      )}

      {/* Readiness matrix — real projects, real scores, links into Inventory */}
      {matrix.length > 0 ? (
        <Section
          className="mt-8"
          title={t('lm.hub.readiness')}
          description={t('lm.hub.readinessSub')}
          action={
            <Link href="/freehold-intelligence/inventory/projects" className="inline-flex items-center gap-1 text-xs text-gold/70 hover:text-gold">
              {t('nav.inventory')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <Panel>
            <div className="grid grid-cols-[1fr_90px_90px_90px_110px] gap-4 border-b border-line px-6 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('lm.hub.col.project')}</div>
              {[t('lm.hub.col.data'), t('lm.hub.col.ads'), t('lm.hub.col.signals')].map((h) => (
                <div key={h} className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{h}</div>
              ))}
              <div className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('lm.hub.col.landing')}</div>
            </div>
            <div className="divide-y divide-line">
              {matrix.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_90px_90px_90px_110px] items-center gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <Link href={`/freehold-intelligence/inventory/${p.id}`} className="truncate text-sm font-semibold text-white transition hover:text-gold">
                      {p.name}
                    </Link>
                    {/* The signals a launch actually depends on, from the
                        project's own record: where it is, what it starts at,
                        who builds it. A score with no facts under it is a
                        number nobody can act on. */}
                    <div className="mt-0.5 truncate text-[12px] text-slate-500">
                      {[p.area, p.developer, p.startingPriceAED ? `AED ${Math.round(p.startingPriceAED).toLocaleString()}+` : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {[p.dataQuality, p.adReadiness].map((score, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <span className={`text-sm font-semibold tabular-nums ${scoreText(score)}`}>{score}</span>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
                  {/* PERMIT · PHOTO · BROCHURE — present or absent, because
                      each one is a real gate: no permit stops a compliant
                      launch, no photo means the ad has nothing to show, no
                      brochure means no source for the copy. */}
                  <div className="flex items-center justify-center gap-1">
                    {([
                      [!!p.permitNumber, t('lm.hub.sig.permit')],
                      [p.hasImages, t('lm.hub.sig.photo')],
                      [!!p.brochureUrl, t('lm.hub.sig.brochure')],
                    ] as Array<[boolean, string]>).map(([on, label]) => (
                      <span key={label} title={label}
                        className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-gold' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                  <div className="text-center">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${landingTone(p.landingStatus)}`}>
                      {p.landingStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Section>
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-8 text-center">
          <AlertOctagon className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-2 text-sm text-slate-400">{t('lm.hub.empty')}</p>
          <Link href="/freehold-intelligence/inventory" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:opacity-80">
            {t('nav.inventory')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Sub-section nav — one card per pillar, no duplicates */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {navSections.map(({ label, href, icon: Icon, desc, count }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 transition hover:border-gold/25"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 transition group-hover:border-gold/20">
              <Icon className="h-4 w-4 text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-white">{label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-gold" />
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-400">{desc}</p>
              {count && <div className="mt-3 text-sm font-medium text-gold/70">{count}</div>}
            </div>
          </Link>
        ))}
      </section>

    </div>
  )
}
