'use client'

/**
 * AUDIENCE LAB — the three questions a targeting stack has to answer, in one
 * place, each backed by a measurement rather than an instinct.
 *
 *   1. What has the funnel PROVEN?  (relevance, from registration events)
 *   2. Is the seed deep enough?     (cohorts, weights, readiness)
 *   3. Does each layer bite?        (reach probes, before spending)
 *
 * Every panel here is read-only except the one button that sends hashed
 * identifiers to Meta, which asks first.
 */
import { useState, useEffect, useCallback } from 'react'
import { FlaskConical, Layers, Users, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Signal = {
  id: string; kind: string; value: string
  withTotal: number; rateWith: number; rateWithout: number
  lift: number; p: number; verdict: 'relevant' | 'counter' | 'undecided'
  leadsNeeded: number | null; sentence: string
}
type Report = { signals: Signal[]; relevant: Signal[]; counter: Signal[]; undecided: Signal[]; tooRare: number; headline: string; nextTest: string }
type Relevance = {
  events: number
  all: { behavior: Report; interest: Report; placement: Report; creative: Report }
  solo: { events: number; behavior: Report }
  note: string
}
type Seed = {
  readiness: { rows: number; expectedMatched: number; level: string; moreNeeded: number; message: string }
  counts: { seed: number; matchable: number; exclude: number; neutral: number }
  topSeed: { id: string; quality: number; weight: number; reason: string }[]
}

const VERDICT_STYLE: Record<Signal['verdict'], string> = {
  relevant: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  counter: 'border-red-400/30 bg-red-400/10 text-red-300',
  undecided: 'border-line bg-surface-2 text-slate-500',
}

function Dimension({ title, report }: { title: string; report: Report | undefined }) {
  const t = useT()
  if (!report || report.signals.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {report?.headline ?? t('lab.rel.none')}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{report.headline}</p>
      <div className="mt-2.5 space-y-1.5">
        {report.signals.slice(0, 8).map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-2">
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${VERDICT_STYLE[s.verdict]}`}>
              {t(`lab.verdict.${s.verdict}`)}
            </span>
            <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-300">{s.sentence}</span>
          </div>
        ))}
      </div>
      {report.tooRare > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">{t('lab.rel.tooRare', { n: report.tooRare })}</p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-gold/80">{report.nextTest}</p>
    </div>
  )
}

export default function AudienceLabPage() {
  const t = useT()
  const [rel, setRel] = useState<Relevance | null>(null)
  const [relLoading, setRelLoading] = useState(true)
  const [seed, setSeed] = useState<Seed | null>(null)
  const [seedLoading, setSeedLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [buildMsg, setBuildMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Capture coverage. Shown because the relevance panel above is empty for two
  // completely different reasons — no paid leads yet, or capture not reaching
  // them — and an empty panel that cannot say which is useless.
  const [snap, setSnap] = useState<{ captured: number; pending: number; note: string } | null>(null)
  const [backfilling, setBackfilling] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/ads/relevance', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then(setRel).catch(() => {})
      .finally(() => setRelLoading(false))
    fetch('/api/freehold/ads/audiences/deep-seed', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then(setSeed).catch(() => {})
      .finally(() => setSeedLoading(false))
    fetch('/api/freehold/ads/snapshots', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then(setSnap).catch(() => {})
  }, [])

  const backfill = useCallback(async () => {
    setBackfilling(true)
    try {
      const res = await fetch('/api/freehold/ads/snapshots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200 }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setSnap((p) => (p ? { ...p, captured: p.captured + (d.written ?? 0), pending: Math.max(0, p.pending - (d.written ?? 0)), note: String(d.note ?? p.note) } : p))
      }
    } catch { /* the panel keeps its previous numbers */ }
    finally { setBackfilling(false) }
  }, [])

  const build = useCallback(async () => {
    // Hashed identifiers leave the server here. It asks, every time.
    if (!window.confirm(t('lab.seed.confirm'))) return
    setBuilding(true); setBuildMsg(null)
    try {
      const res = await fetch('/api/freehold/ads/audiences/deep-seed', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, buildExclusion: true, ratio: 0.01, country: 'AE' }),
      })
      const d = await res.json().catch(() => ({}))
      setBuildMsg(res.ok
        ? { ok: true, text: `${t('lab.seed.built', { n: d.uploaded ?? 0 })} ${d.note ?? ''}` }
        : { ok: false, text: String(d.error ?? t('lab.seed.failed')) })
    } catch {
      setBuildMsg({ ok: false, text: t('lab.seed.failed') })
    } finally { setBuilding(false) }
  }, [t])

  const ready = seed?.readiness.level === 'ready' || seed?.readiness.level === 'thin'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <header>
        <h1 className="flex items-center gap-2.5 text-[22px] font-bold text-white">
          <FlaskConical className="h-5 w-5 text-gold" /> {t('lab.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">{t('lab.subtitle')}</p>
      </header>

      {/* 1 — what the funnel has proven */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" /> {t('lab.rel.title')}
        </div>
        {snap && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">{t('lab.snap.title')}</span>
            <span className="text-lg font-semibold text-white">{snap.captured.toLocaleString()}</span>
            <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-400">{snap.note}</span>
            {snap.pending > 0 && (
              <button type="button" onClick={backfill} disabled={backfilling}
                className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
                {backfilling ? <Loader2 className="h-3 w-3 animate-spin" /> : t('lab.snap.backfill')}
              </button>
            )}
          </div>
        )}
        {relLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-5 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('lab.loading')}
          </div>
        ) : !rel || rel.events === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-2 px-5 py-5">
            <p className="text-sm text-slate-300">{t('lab.rel.empty')}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{rel?.note ?? ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-400">{t('lab.rel.events', { n: rel.events })} {rel.note}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Dimension title={t('lab.dim.behavior')} report={rel.all.behavior} />
              <Dimension title={t('lab.dim.interest')} report={rel.all.interest} />
              <Dimension title={t('lab.dim.placement')} report={rel.all.placement} />
              <Dimension title={t('lab.dim.creative')} report={rel.all.creative} />
            </div>
            {rel.solo.events > 0 && (
              <div className="rounded-xl border border-gold/25 bg-gold/[0.05] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold/85">{t('lab.solo.title')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t('lab.solo.hint', { n: rel.solo.events })}</p>
                <div className="mt-2.5 space-y-1.5">
                  {rel.solo.behavior.signals.slice(0, 5).map((s) => (
                    <p key={s.id} className="text-[11px] leading-relaxed text-slate-300">· {s.sentence}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2 — is the seed deep enough */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          <Users className="h-3.5 w-3.5 text-gold" /> {t('lab.seed.title')}
        </div>
        {seedLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-5 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('lab.loading')}
          </div>
        ) : !seed ? (
          <div className="rounded-2xl border border-line bg-surface-2 px-5 py-5 text-sm text-slate-400">{t('lab.seed.unavailable')}</div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface-2 p-5">
            {/* Readiness is stated in MATCHED people, never in rows. */}
            <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 ${
              ready ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-amber-400/25 bg-amber-400/[0.06]'}`}>
              {ready
                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />}
              <p className={`text-xs leading-relaxed ${ready ? 'text-emerald-100/90' : 'text-amber-100/90'}`}>
                {seed.readiness.message}
              </p>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {([
                ['lab.seed.cohort', seed.counts.seed],
                ['lab.seed.matchable', seed.counts.matchable],
                ['lab.seed.suppress', seed.counts.exclude],
                ['lab.seed.neutral', seed.counts.neutral],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{t(k)}</p>
                  <p className="mt-0.5 text-lg font-semibold text-white">{v.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {seed.topSeed.length > 0 && (
              <div className="mt-3.5 divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-line bg-surface">
                {seed.topSeed.slice(0, 6).map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <span className="w-10 shrink-0 font-semibold text-gold">{l.quality}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{l.reason}</span>
                    {/* Nothing takes the same weight — the weight is shown. */}
                    <span className="shrink-0 text-slate-500">×{l.weight.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={build} disabled={building || !ready}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50">
              {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              {t('lab.seed.build')}
            </button>
            {!ready && <p className="mt-1.5 text-[11px] text-slate-500">{t('lab.seed.blocked')}</p>}
            {buildMsg && (
              <p className={`mt-2.5 text-xs leading-relaxed ${buildMsg.ok ? 'text-emerald-200' : 'text-red-300'}`}>{buildMsg.text}</p>
            )}
          </div>
        )}
      </section>

      {/* 3 — layer audit lives on the stack being edited, not here */}
      <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          <Layers className="h-3.5 w-3.5 text-gold" /> {t('lab.layers.title')}
        </div>
        <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-slate-400">{t('lab.layers.hint')}</p>
      </section>
    </div>
  )
}
