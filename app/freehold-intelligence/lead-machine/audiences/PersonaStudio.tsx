'use client'

/**
 * PERSONA STUDIO — audiences from OUR list of people, not Meta's.
 *
 * "Doctors in the UAE" does not exist as a Meta audience — which is exactly
 * why it is on this list. The operator picks up to three of our words, a
 * language and a market; the kitchen translates each word into a LIST of live
 * Meta interests and behaviours (never one-to-one), stacks the picks as
 * must-match layers, and requires a real-estate signal on top of all of it.
 *
 * This file knows the words and the dials. The ingredients live server-side
 * and never reach the browser.
 */
import { useEffect, useState } from 'react'
import { BadgeCheck, Loader2, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/** Mirrored from the kitchen's library — ids only, grouped for display. */
const PERSONA_GROUPS: { id: string; personas: string[] }[] = [
  { id: 'professions', personas: ['doctors', 'engineers', 'lawyers', 'techPros', 'aviationPeople', 'educators', 'actorsCreatives', 'governmentSector', 'policeSecurity'] },
  { id: 'money',       personas: ['ceosExecutives', 'topProfessionals', 'businessOwners', 'financePros', 'traders', 'luxuryLife', 'propertyOwners'] },
  { id: 'communities', personas: ['egyptianCommunity', 'lebaneseCommunity', 'goldenVisaSeekers', 'uaeVisitors'] },
]
const MAX_STACK = 3

const SPEAKERS = ['arabic', 'english', 'russian'] as const
// Meta's gender codes. 'all' sends nothing — everyone — which stays the default.
const GENDERS = ['all', 'women', 'men'] as const
const GENDER_CODE: Record<(typeof GENDERS)[number], number[]> = { all: [], women: [2], men: [1] }
const MARKETS = ['resident', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'gcc', 'egypt', 'france', 'europe', 'overseas'] as const

interface Reach { lower: number; upper: number; ready: boolean }
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))

export default function PersonaStudio({ onSaved }: { onSaved: () => void }) {
  const t = useT()
  const [picked, setPicked] = useState<string[]>([])
  const [speaker, setSpeaker] = useState<(typeof SPEAKERS)[number]>('arabic')
  const [market, setMarket] = useState<(typeof MARKETS)[number]>('resident')
  const [gender, setGender] = useState<(typeof GENDERS)[number]>('all')
  const [name, setName] = useState('')
  const [reach, setReach] = useState<Reach | null>(null)
  const [layers, setLayers] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [metaConnected, setMetaConnected] = useState(true)

  useEffect(() => {
    fetch('/api/freehold/ads/audiences/persona')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMetaConnected(d.metaConnected === true) })
      .catch(() => {})
  }, [])

  function toggle(id: string) {
    setMsg(null); setReach(null); setLayers(null)
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_STACK ? p : [...p, id])
  }

  async function run(save: boolean) {
    setMsg(null)
    if (save) setSaving(true); else setPreviewing(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences/persona', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaIds: picked, speaker, residency: market, save,
          genders: GENDER_CODE[gender],
          ...(save ? {
            name: name.trim(),
            description: `${picked.map((id) => t(`lm.aud.persona.${id}.name`)).join(' + ')} · ${t(`lm.aud.pat.speakers.${speaker}`)} · ${t(`lm.aud.pat.res.${market}`)}`,
          } : {}),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      setReach((d?.reach ?? null) as Reach | null)
      setLayers(typeof d?.preview?.layers === 'number' ? d.preview.layers : null)
      if (save) {
        setMsg(t('lm.aud.persona.saved'))
        setPicked([]); setName(''); setReach(null); setLayers(null)
        onSaved()
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally { setSaving(false); setPreviewing(false) }
  }

  const busy = previewing || saving

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Sparkles className="h-4 w-4 text-gold" /> {t('lm.aud.persona.title')}
      </div>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.persona.sub')}</p>

      {PERSONA_GROUPS.map((g) => (
        <div key={g.id} className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t(`lm.aud.persona.g.${g.id}`)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.personas.map((id) => {
              const on = picked.includes(id)
              return (
                <button
                  key={id} type="button" onClick={() => toggle(id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                    on ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:text-white'
                  }`}
                >
                  {t(`lm.aud.persona.${id}.name`)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {picked.length > 0 && (
        <div className="mt-4 space-y-3.5 border-t border-line pt-4">
          {/* Selected personas, restated as one sentence of intent. */}
          <p className="text-[12px] text-slate-300">
            {picked.map((id) => t(`lm.aud.persona.${id}.name`)).join(' + ')}
            <span className="text-slate-500"> · {t(`lm.aud.build.language.${speaker === 'arabic' ? 'ar' : speaker === 'english' ? 'en' : 'ru'}`)} · {t(`lm.aud.pat.res.${market}`)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {SPEAKERS.map((s) => (
              <button key={s} type="button" onClick={() => { setSpeaker(s); setReach(null) }}
                className={`rounded-full border px-3 py-1 text-[12px] transition ${speaker === s ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
                {t(`lm.aud.pat.speakers.${s}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <button key={m} type="button" onClick={() => { setMarket(m); setReach(null) }}
                className={`rounded-full border px-3 py-1 text-[12px] transition ${market === m ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
                {t(`lm.aud.pat.res.${m}`)}
              </button>
            ))}
          </div>
          {/* A real Meta field — the honest half of "local women". The other
              half is the language + market pickers above, and nothing else. */}
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button key={g} type="button" onClick={() => { setGender(g); setReach(null) }}
                className={`rounded-full border px-3 py-1 text-[12px] transition ${gender === g ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
                {t(`lm.aud.gender.${g}`)}
              </button>
            ))}
          </div>

          {!metaConnected && <p className="text-[12px] text-slate-400">{t('lm.aud.notConnected')}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void run(false)} disabled={busy || !metaConnected}
              className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-[13px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
              {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('lm.aud.persona.preview')}
            </button>
            {reach && (
              <span className="text-[12px] text-slate-200">
                {t('lm.aud.ready.reach')}: <span className="font-semibold text-white">{fmt(reach.lower)}–{fmt(reach.upper)}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('lm.aud.persona.namePh')}
              className="w-full max-w-sm rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
            <button type="button" onClick={() => void run(true)} disabled={busy || !metaConnected || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />} {t('lm.aud.persona.save')}
            </button>
          </div>
          {msg && <p className="text-[12px] text-slate-300">{msg}</p>}
        </div>
      )}
    </section>
  )
}
