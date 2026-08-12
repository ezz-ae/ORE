'use client'

/**
 * THE CREATIVE LAB — you look at it, you do not read it.
 *
 * The first version of this screen was correct and useless. It named designs
 * instead of showing them: "payBands", "Price first", "Arguments it can make",
 * and a word — "uniform" — that nobody in this business says out loud. An
 * operator opened it and could not tell what any of it meant, which is the
 * same failure as the gallery it replaced wearing better vocabulary.
 *
 * A THUMBNAIL IS THE ONLY HONEST LABEL FOR A DESIGN. So every design this
 * project can make is RENDERED here, from its own photo, price and terms,
 * using the same engine that builds the real ad. What you see is what would
 * run. Nothing is described.
 *
 * The three things on this screen, in the order somebody actually needs them:
 *
 *   1. WHAT ITS ADS LOOK LIKE — rendered. Greyed cards for the ones this
 *      project cannot make, each saying which fact is missing, because "why is
 *      that one grey" must be answerable without asking anyone.
 *   2. WHAT WORKED — only once real delivery can carry the claim, and only if
 *      anything has run.
 *   3. MAKE THIS NEXT — one design, rendered large, with the button.
 *
 * The palette is the project's own and does not change between visits. That is
 * not decoration: a development becomes a name people recognise by looking the
 * same every week.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, ArrowUpRight, Sparkles, Lock } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { PageHeader } from '@/components/freehold/ui'
import { composeProjectAd } from '@/lib/freehold/project-ad'
import type { LayoutKey } from '@/lib/freehold/ad-compose'
import type { ProjectUniform, RankedRecipe, Recipe, LabLayout } from '@/lib/freehold/creative-lab'

const FI = '/freehold-intelligence'

interface Project { id: string; name: string }
interface Facts {
  slug: string; name: string; area?: string | null
  startingPriceAED?: number | null; paymentPlan?: string | null; handoverYear?: number | null
}
interface Lab {
  project: { slug: string; name: string; heroImage?: string | null; area?: string | null }
  facts: Facts
  uniform: ProjectUniform
  ranked: RankedRecipe[]
  next: Recipe | null
  recorded: number
}

const VERDICT_TONE: Record<string, string> = {
  proven: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  poor: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  undecided: 'border-line bg-surface-2 text-slate-400',
}

export default function CreativeLabPage() {
  const t = useT()
  const [projects, setProjects] = useState<Project[]>([])
  const [slug, setSlug] = useState('')
  const [lab, setLab] = useState<Lab | null>(null)
  const [loading, setLoading] = useState(false)
  /** layout → rendered data URL. The whole point of the screen. */
  const [shots, setShots] = useState<Record<string, string>>({})
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = (Array.isArray(d?.properties) ? d.properties : [])
          .map((x: Record<string, unknown>) => ({ id: String(x.id ?? x.slug ?? ''), name: String(x.name ?? '') }))
          .filter((p: Project) => p.id && p.name)
        setProjects(list)
        if (list.length > 0) setSlug(list[0].id)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (s: string) => {
    if (!s) return
    setLoading(true); setShots({})
    try {
      const d = await fetch(`/api/freehold/ads/creative-lab?project=${encodeURIComponent(s)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      setLab(d?.uniform ? d as Lab : null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(slug) }, [slug, load])

  /**
   * Draw every design this project can make, at its own palette, from its own
   * photo and numbers. One render per allowed layout — the same call the real
   * ad uses, so the thumbnail is not an impression of the ad, it IS the ad.
   */
  useEffect(() => {
    if (!lab) return
    let cancelled = false
    setDrawing(true)
    ;(async () => {
      const out: Record<string, string> = {}
      const labels = {
        from: t('lm.pool.compose.from'),
        total: t('lm.pool.compose.total'),
        handover: (y: number) => t('lm.pool.compose.handover', { y }),
      }
      for (const layout of lab.uniform.layouts) {
        if (cancelled) return
        const url = await composeProjectAd(
          {
            projectName: lab.project.name,
            area: lab.facts.area,
            heroImage: lab.project.heroImage,
            startingPriceAED: lab.facts.startingPriceAED,
            paymentPlan: lab.facts.paymentPlan,
            handoverYear: lab.facts.handoverYear,
          },
          labels,
          { layout: layout as LayoutKey, palette: lab.uniform.palette, format: 'square' },
        )
        if (url) out[layout] = url
      }
      if (!cancelled) { setShots(out); setDrawing(false) }
    })()
    return () => { cancelled = true }
  }, [lab, t])

  const verdictOf = (layout: LabLayout) => {
    const rows = (lab?.ranked ?? []).filter((r) => r.layout === layout)
    if (rows.length === 0) return null
    if (rows.some((r) => r.verdict === 'proven')) return 'proven'
    if (rows.every((r) => r.verdict === 'poor')) return 'poor'
    return 'undecided'
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PageHeader
        eyebrow={t('lab.eyebrow')}
        Icon={FlaskConical}
        title={t('lab.title')}
        subtitle={t('lab.subtitle')}
        actions={
          <Link href={`${FI}/inventory`} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-gold/30 hover:text-white">
            {t('lab.addProject')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          {t('lab.project')}
          <select value={slug} onChange={(e) => setSlug(e.target.value)}
            className="max-w-[18rem] rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-slate-100 outline-none focus:border-gold/40">
            {projects.length === 0 && <option value="">{t('lab.noProjects')}</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {(loading || drawing) && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      </div>

      {!loading && !lab && slug && <p className="mt-8 text-sm text-slate-500">{t('lab.notFound')}</p>}

      {lab && (
        <>
          {/* ── MAKE THIS NEXT ──────────────────────────────────────────────
              First, not last: it is the only thing on the screen that is a
              decision. Everything below it is context for this one card. */}
          {!lab.next && (
            <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-slate-500" /> {t('lab.next.title')}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{t('lab.next.none')}</p>
            </section>
          )}
          {lab.next && (
            <section className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border border-gold/25 bg-gold/[0.05] p-5">
              <div className="w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                {shots[lab.next.layout]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={shots[lab.next.layout]} alt="" className="block w-full" />
                  : <div className="grid aspect-square place-items-center text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-gold" /> {t('lab.next.title')}
                </h2>
                <p className="mt-1.5 text-[13px] text-slate-200">
                  {t('lab.next.says', { angle: t(`lab.angle.${lab.next.angle}`) })}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {lab.ranked.some((r) => r.verdict === 'proven') ? t('lab.next.whyWinner') : t('lab.next.whyExplore')}
                </p>
                <Link
                  href={`${FI}/lead-machine/campaigns/quick?project=${encodeURIComponent(lab.project.slug)}&layout=${lab.next.layout}&angle=${lab.next.angle}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
                  {t('lab.next.make')} <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          )}

          {/* ── WHAT ITS ADS LOOK LIKE ──────────────────────────────────────
              Rendered, never described. A design named "payBands" means
              nothing; a picture of it means everything. */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-white">{t('lab.designs.title')}</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t('lab.designs.sub')}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {lab.uniform.layouts.map((layout) => {
                const v = verdictOf(layout)
                return (
                  <div key={layout} className="overflow-hidden rounded-xl border border-line bg-surface-2">
                    {shots[layout]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={shots[layout]} alt="" className="block w-full" />
                      : <div className="grid aspect-square place-items-center text-slate-700"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                    {/* The verdict sits ON the picture it judges — a table of
                        results elsewhere makes you hold two things in mind. */}
                    {v && (
                      <div className="px-2.5 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${VERDICT_TONE[v]}`}>
                          {t(`lab.verdict.${v}`)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* LOCKED, WITH THE REASON. "Why is that one grey" has to be
                  answerable without asking anybody. */}
              {lab.uniform.withheldLayouts.map((w) => (
                <div key={w.key} title={t('lab.designs.lockedHint')}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 text-center">
                  <Lock className="h-4 w-4 text-slate-700" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">{t('lab.designs.locked')}</span>
                  <span className="text-[11px] leading-snug text-slate-600">{t(`lab.why.${w.reason}`)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── WHAT WORKED ────────────────────────────────────────────────
              Only when there is something to say. An empty results table on a
              project that has run nothing is furniture. */}
          {lab.ranked.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-white">{t('lab.history.title')}</h2>
              <div className="mt-3 space-y-2">
                {lab.ranked.map((r) => (
                  <div key={`${r.layout}-${r.angle}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {shots[r.layout] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shots[r.layout]} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-slate-100">
                          {t('lab.next.says', { angle: t(`lab.angle.${r.angle}`) })}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {t('lab.history.runs', { n: r.runs, impressions: r.impressions.toLocaleString() })}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-end">
                      <div>
                        <div className="text-[13px] font-semibold tabular-nums text-gold">{r.leads}</div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-600">{t('lab.history.leads')}</div>
                      </div>
                      <div>
                        {/* A cost per lead from no leads is a division by
                            nothing dressed as a metric. */}
                        <div className="text-[13px] font-semibold tabular-nums text-slate-200">
                          {r.cplAed !== null ? `AED ${Math.round(r.cplAed).toLocaleString()}` : '—'}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-600">{t('lab.history.cpl')}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${VERDICT_TONE[r.verdict]}`}>
                        {t(`lab.verdict.${r.verdict}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {lab.ranked.length === 0 && (
            <p className="mt-6 text-[11px] leading-relaxed text-slate-600">{t('lab.history.empty')}</p>
          )}
        </>
      )}
    </div>
  )
}
