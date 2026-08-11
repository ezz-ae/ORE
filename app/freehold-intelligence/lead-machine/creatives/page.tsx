'use client'

/**
 * THE CREATIVE LAB.
 *
 * What stood here was a gallery: every ad creative in the account, newest
 * first, fifty cards, most of them blank grey squares because Meta returns no
 * thumbnail for a creative built from an image hash. No project, no result, no
 * memory — so it could not answer either question a creative screen exists
 * for, and nothing on it changed what the next ad would look like.
 *
 * A lab is three things about ONE project:
 *
 *   UNIFORM   what its ads may look like and may claim — and, for everything
 *             withheld, which fact its row is missing. The answer to "why
 *             can't I make that ad" belongs on the screen.
 *   HISTORY   every recipe it has run, with what that recipe did, and the
 *             honest word for each: proven, poor, or not tested enough.
 *   NEXT      the one recipe to make now, and the button that makes it.
 *
 * THE PALETTE IS THE PROJECT'S, FOR AS LONG AS IT EXISTS. Derived from the
 * slug, never random — a development becomes a name people recognise through
 * repeated exposure to a consistent mark, and re-rolling its colours weekly
 * throws that away.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, ArrowUpRight, Sparkles, Check, Minus } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { PageHeader } from '@/components/freehold/ui'
import { PALETTES } from '@/lib/freehold/ad-compose'
import type { ProjectUniform, RankedRecipe, Recipe } from '@/lib/freehold/creative-lab'

const FI = '/freehold-intelligence'

interface Project { id: string; name: string }
interface Lab {
  project: { slug: string; name: string; heroImage?: string | null; area?: string | null }
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

  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const items = Array.isArray(d?.properties) ? d.properties : []
        const list = items
          .map((x: Record<string, unknown>) => ({ id: String(x.id ?? x.slug ?? ''), name: String(x.name ?? '') }))
          .filter((p: Project) => p.id && p.name)
        setProjects(list)
        // Open on the first project rather than on an empty screen — a lab with
        // nothing selected is the gallery again.
        if (list.length > 0) setSlug(list[0].id)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (s: string) => {
    if (!s) return
    setLoading(true)
    try {
      const d = await fetch(`/api/freehold/ads/creative-lab?project=${encodeURIComponent(s)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      setLab(d?.uniform ? d as Lab : null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(slug) }, [slug, load])

  const palette = lab ? PALETTES[lab.uniform.palette % PALETTES.length] : null

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

      {/* THE ONLY INPUT: which project. Everything below is derived from its
          own row and its own ads — there is nothing else to configure. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          {t('lab.project')}
          <select value={slug} onChange={(e) => setSlug(e.target.value)}
            className="max-w-[18rem] rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-slate-100 outline-none focus:border-gold/40">
            {projects.length === 0 && <option value="">{t('lab.noProjects')}</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      </div>

      {!loading && !lab && slug && (
        <p className="mt-8 text-sm text-slate-500">{t('lab.notFound')}</p>
      )}

      {lab && (
        <>
          {/* ── THE UNIFORM ─────────────────────────────────────────────── */}
          <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">{t('lab.uniform.title')}</h2>
              {palette && (
                <div className="flex items-center gap-1.5" title={t('lab.uniform.paletteHint')}>
                  {[palette.bg, palette.bg2, palette.accent, palette.ink].map((c, i) => (
                    <span key={i} className="h-4 w-4 rounded border border-white/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lab.uniform.sub')}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Group title={t('lab.uniform.layouts')}
                allowed={lab.uniform.layouts.map((l) => t(`lab.layout.${l}`))}
                withheld={lab.uniform.withheldLayouts.map((w) => ({
                  label: t(`lab.layout.${w.key}`), why: t(`lab.why.${w.reason}`),
                }))} />
              <Group title={t('lab.uniform.angles')}
                allowed={lab.uniform.angles.map((a) => t(`lab.angle.${a}`))}
                withheld={lab.uniform.withheldAngles.map((w) => ({
                  label: t(`lab.angle.${w.key}`), why: t(`lab.why.${w.reason}`),
                }))} />
            </div>
          </section>

          {/* ── WHAT TO MAKE NEXT ───────────────────────────────────────── */}
          <section className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.05] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-gold" /> {t('lab.next.title')}
            </h2>
            {lab.next ? (
              <>
                <p className="mt-1.5 text-[13px] text-slate-200">
                  {t('lab.next.line', {
                    layout: t(`lab.layout.${lab.next.layout}`),
                    angle: t(`lab.angle.${lab.next.angle}`),
                  })}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {lab.ranked.some((r) => r.verdict === 'proven')
                    ? t('lab.next.whyWinner')
                    : t('lab.next.whyExplore')}
                </p>
                {/* The door: the quick launcher builds this project's ad, and
                    the recipe travels with it so the lesson is recorded. */}
                <Link
                  href={`${FI}/lead-machine/campaigns/quick?project=${encodeURIComponent(lab.project.slug)}&layout=${lab.next.layout}&angle=${lab.next.angle}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
                  {t('lab.next.make')} <ArrowUpRight className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <p className="mt-1.5 text-[13px] text-slate-400">{t('lab.next.none')}</p>
            )}
          </section>

          {/* ── WHAT IT HAS RUN ─────────────────────────────────────────── */}
          <section className="mt-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">{t('lab.history.title')}</h2>
              <span className="text-[11px] text-slate-500">
                {t('lab.history.count', { n: lab.recorded })}
              </span>
            </div>

            {lab.ranked.length === 0 ? (
              // A project that HAS run ads still shows nothing here until the
              // lab could watch them being made. Said plainly rather than left
              // to look like a failure.
              <p className="rounded-2xl border border-line bg-surface-2 px-5 py-8 text-center text-[13px] leading-relaxed text-slate-500">
                {t('lab.history.empty')}
              </p>
            ) : (
              <div className="space-y-2">
                {lab.ranked.map((r) => (
                  <div key={`${r.layout}-${r.angle}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-slate-100">
                        {t(`lab.layout.${r.layout}`)} · {t(`lab.angle.${r.angle}`)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {t('lab.history.runs', { n: r.runs, impressions: r.impressions.toLocaleString() })}
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
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** Allowed on the left with a tick; withheld on the right with the fact the
 *  project row is missing. Both halves matter — a list of what you CAN make,
 *  with no account of what you cannot, is where "why is that greyed out" comes
 *  from. */
function Group({ title, allowed, withheld }: {
  title: string
  allowed: string[]
  withheld: { label: string; why: string }[]
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="mt-2 space-y-1">
        {allowed.map((a) => (
          <div key={a} className="flex items-center gap-1.5 text-[12px] text-slate-200">
            <Check className="h-3 w-3 shrink-0 text-emerald-400" /> {a}
          </div>
        ))}
        {withheld.map((w) => (
          <div key={w.label} className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <Minus className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{w.label} <span className="text-slate-700">— {w.why}</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}
