'use client'

/**
 * THE ORDER COUNTER.
 *
 * Everything on this screen is a sentence about a PERSON. Nothing on it is a
 * Meta field, an interest id, a narrowing group or the word "audience
 * definition". The operator taps who they are selling to and moves one dial;
 * the kitchen behind the API turns that into real targeting they never see.
 *
 * Two rules this file has to keep:
 *
 *  1. NO SPEC EVER ARRIVES HERE. The preview endpoint returns the reach band
 *     and the shape of the match — never the targeting. So there is nothing on
 *     this page to read in a network tab, by construction rather than by
 *     discipline.
 *  2. NO FORM. Chips and one dial. The moment this becomes labelled inputs and
 *     a Save button it is Ads Manager in different colours, and the person
 *     using it has learned Meta instead of learning us.
 *
 * The dial has no number on it on purpose. A number invites "is 63 better than
 * 61", which nobody can answer. Cold to hot is a feeling and the trade-off it
 * stands for — reach against precision — is real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Sparkles, Flame, Snowflake, Check } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// ─── The vocabulary, mirrored from the kitchen ───────────────────────────────
// Values only. The server owns what each one means; this file owns nothing but
// how it looks and what it is called in three languages.

const RESIDENCY = ['resident', 'expat', 'gcc', 'overseas'] as const
const SPEAKERS = ['arabic', 'english', 'european'] as const
const LIFE_STAGE = ['single', 'couple', 'young_family', 'established_family', 'downsizing'] as const
const MOTIVE = ['first_home', 'upgrade', 'investment', 'holiday_home', 'golden_visa', 'relocation'] as const
const MONEY = ['unknown', 'mortgage', 'payment_plan', 'cash'] as const
const READINESS = ['browsing', 'comparing', 'ready'] as const
const EXCLUDE = ['renters_only', 'job_seekers', 'agents_and_brokers', 'bargain_hunters'] as const

interface Pattern {
  name: string
  residency: string[]
  speakers: string[]
  lifeStage: string[]
  motive: string[]
  money: string
  readiness: string
  exclude: string[]
  strictness: number
}

const EMPTY: Pattern = {
  name: '', residency: [], speakers: [], lifeStage: [], motive: [],
  money: 'unknown', readiness: 'browsing', exclude: [], strictness: 50,
}

interface Preview {
  boundTraits: number
  hintedTraits: number
  temperature: 'cold' | 'warm' | 'hot'
  needsRetargetingSource: boolean
  unreachable: string[]
}
interface Reach { lower: number; upper: number; ready: boolean }

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)

/**
 * Ice at 0, fire at 100. Hue runs 198° → 18° and saturation climbs, so the dot
 * genuinely reads as freezing then burning rather than as a blue-to-orange
 * gradient someone picked. This is the only feedback the dial gives.
 */
const dialColor = (v: number) => {
  const p = Math.min(100, Math.max(0, v)) / 100
  return `hsl(${198 - 180 * p} ${62 + 28 * p}% ${58 - 6 * p}%)`
}

export default function PatternBuilder({ onSaved }: { onSaved: () => void }) {
  const t = useT()
  const [p, setP] = useState<Pattern>(EMPTY)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [reach, setReach] = useState<Reach | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const toggle = (key: 'residency' | 'speakers' | 'lifeStage' | 'motive' | 'exclude', v: string) =>
    setP((prev) => ({
      ...prev,
      [key]: prev[key].includes(v) ? prev[key].filter((x) => x !== v) : [...prev[key], v],
    }))

  const chosen =
    p.residency.length + p.speakers.length + p.lifeStage.length + p.motive.length +
    (p.money !== 'unknown' ? 1 : 0) + (p.readiness !== 'browsing' ? 1 : 0)

  /**
   * The sentence is built HERE, not fetched.
   *
   * The server writes its own copy for the stored description, but rendering
   * that would put an English sentence on an Arabic screen — and this line is
   * the single thing the operator reads to confirm the machine understood
   * them. It has to be in their language, so it is composed from the same
   * translated chip labels they just tapped.
   */
  const sentence = useMemo(() => {
    if (chosen === 0) return t('lm.aud.pat.nobody')
    const bits: string[] = []
    const join = (xs: string[], sep: string) => xs.join(sep)
    if (p.speakers.length) bits.push(join(p.speakers.map((x) => t(`lm.aud.pat.speakers.${x}`)), t('lm.aud.pat.and')))
    if (p.lifeStage.length) bits.push(join(p.lifeStage.map((x) => t(`lm.aud.pat.life.${x}`)), t('lm.aud.pat.or')))
    if (p.residency.length) bits.push(join(p.residency.map((x) => t(`lm.aud.pat.res.${x}`)), t('lm.aud.pat.or')))
    if (p.motive.length) bits.push(join(p.motive.map((x) => t(`lm.aud.pat.motive.${x}`)), t('lm.aud.pat.or')))
    if (p.money !== 'unknown') bits.push(t(`lm.aud.pat.money.${p.money}`))
    if (p.readiness !== 'browsing') bits.push(t(`lm.aud.pat.ready.${p.readiness}`))
    return bits.join(t('lm.aud.pat.comma'))
  }, [p, chosen, t])

  // Preview is debounced and last-write-wins. Without the guard a slow reach
  // call from an earlier dial position lands after a newer one and the screen
  // shows a number for a pattern that is no longer on it.
  const seq = useRef(0)
  const fetchPreview = useCallback(async (pat: Pattern) => {
    const mine = ++seq.current
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pat }),
      })
      const data = await res.json()
      if (mine !== seq.current) return
      if (res.ok) { setPreview(data.preview ?? null); setReach(data.reach ?? null) }
    } catch { /* a failed preview shows nothing rather than a stale number */ }
    finally { if (mine === seq.current) setLoading(false) }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { void fetchPreview(p) }, 420)
    return () => clearTimeout(id)
  }, [p, fetchPreview])

  async function save() {
    setMsg(null)
    if (!p.name.trim()) { setMsg(t('lm.aud.pat.needName')); return }
    if (chosen === 0) { setMsg(t('lm.aud.pat.needTraits')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: p, name: p.name, save: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('lm.aud.pat.saveFailed'))
      setMsg(t('lm.aud.pat.saved'))
      setP(EMPTY); setPreview(null); setReach(null)
      onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('lm.aud.pat.saveFailed'))
    } finally { setSaving(false) }
  }

  const Chips = ({
    label, values, prefix, selected, onPick,
  }: {
    label: string; values: readonly string[]; prefix: string
    selected: string[]; onPick: (v: string) => void
  }) => (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v) => {
          const on = selected.includes(v)
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                on
                  ? 'border-gold/50 bg-gold/15 text-gold'
                  : 'border-line bg-surface-2 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              {t(`${prefix}.${v}`)}
            </button>
          )
        })}
      </div>
    </div>
  )

  const temp = preview?.temperature ?? 'cold'

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Sparkles className="h-4 w-4 text-gold" /> {t('lm.aud.pat.title')}
      </div>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.pat.sub')}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Who they are ── */}
        <div className="space-y-5">
          <Chips label={t('lm.aud.pat.h.speakers')} values={SPEAKERS} prefix="lm.aud.pat.speakers"
            selected={p.speakers} onPick={(v) => toggle('speakers', v)} />
          <Chips label={t('lm.aud.pat.h.res')} values={RESIDENCY} prefix="lm.aud.pat.res"
            selected={p.residency} onPick={(v) => toggle('residency', v)} />
          <Chips label={t('lm.aud.pat.h.life')} values={LIFE_STAGE} prefix="lm.aud.pat.life"
            selected={p.lifeStage} onPick={(v) => toggle('lifeStage', v)} />
          <Chips label={t('lm.aud.pat.h.motive')} values={MOTIVE} prefix="lm.aud.pat.motive"
            selected={p.motive} onPick={(v) => toggle('motive', v)} />
          <Chips label={t('lm.aud.pat.h.money')} values={MONEY} prefix="lm.aud.pat.money"
            selected={[p.money]} onPick={(v) => setP((prev) => ({ ...prev, money: v }))} />
          <Chips label={t('lm.aud.pat.h.ready')} values={READINESS} prefix="lm.aud.pat.ready"
            selected={[p.readiness]} onPick={(v) => setP((prev) => ({ ...prev, readiness: v }))} />
          <Chips label={t('lm.aud.pat.h.exclude')} values={EXCLUDE} prefix="lm.aud.pat.exclude"
            selected={p.exclude} onPick={(v) => toggle('exclude', v)} />
        </div>

        {/* ── The dial, the sentence, the number ── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between text-slate-500">
              <Snowflake className="h-4 w-4" />
              {/* Deliberately no value, no label, no ticks. */}
              <Flame className="h-4 w-4" />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={p.strictness}
              onChange={(e) => setP((prev) => ({ ...prev, strictness: Number(e.target.value) }))}
              aria-label={t('lm.aud.pat.dial')}
              className="pattern-dial mt-2.5 w-full"
              style={{
                accentColor: dialColor(p.strictness),
                ['--dial' as string]: dialColor(p.strictness),
              }}
            />
            <p className="mt-2.5 text-center text-[11.5px] leading-relaxed text-slate-500">
              {p.strictness <= 30 ? t('lm.aud.pat.dial.wide')
                : p.strictness >= 75 ? t('lm.aud.pat.dial.tight')
                : t('lm.aud.pat.dial.mid')}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {t('lm.aud.pat.whoTitle')}
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-200">{sentence}</p>

            <div className="mt-3.5 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[11.5px] text-slate-500">{t('lm.aud.pat.reach')}</span>
              <span className="text-[13px] font-semibold text-white">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                  : reach ? `${fmt(reach.lower)}–${fmt(reach.upper)}`
                  : t('lm.aud.pat.reach.none')}
              </span>
            </div>

            {/* A hot pattern cannot be launched on targeting alone. Said here,
                before saving, rather than discovered at launch. */}
            {preview?.needsRetargetingSource && (
              <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] leading-relaxed text-slate-400">
                {t(`lm.aud.pat.warm.${temp}`)}
              </p>
            )}
            {/* A chosen group that did not survive is named. Never dropped in
                silence — they picked it and would otherwise never know. */}
            {preview && preview.unreachable.length > 0 && (
              <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] leading-relaxed text-slate-400">
                {t('lm.aud.pat.unreachable').replace('{list}', preview.unreachable.join(', '))}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <input
              value={p.name}
              onChange={(e) => setP((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('lm.aud.pat.namePlaceholder')}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40"
            />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t('lm.aud.pat.save')}
            </button>
            {msg && <p className="text-[11.5px] text-slate-400">{msg}</p>}
          </div>
        </div>
      </div>

      {/* Scoped so the dial can be a real range input — keyboard, screen
          readers and touch all come free — while still looking like one dot
          that ices or burns. */}
      <style jsx global>{`
        .pattern-dial {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, hsl(198 62% 58%), hsl(18 90% 52%));
          outline: none;
        }
        .pattern-dial::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: var(--dial);
          border: 2px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 12px var(--dial);
          cursor: pointer;
          transition: box-shadow 0.2s ease;
        }
        .pattern-dial::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: var(--dial);
          border: 2px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 12px var(--dial);
          cursor: pointer;
        }
      `}</style>
    </section>
  )
}
