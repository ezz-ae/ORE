'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Users, Sparkles, Loader2, Search, X, Trash2, Upload, ShieldCheck, Rocket, Globe, Handshake,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'
import { BRAND } from '@/lib/freehold/brand'
import PatternBuilder from './PatternBuilder'
import ArmPlanner from './ArmPlanner'

// ─── Types mirrored from the API ──────────────────────────────────────────────

interface SavedAudience {
  id: string
  name: string
  description: string
  kind: 'behavioral' | 'narrow' | 'lookalike' | 'custom_list' | 'pattern'
  // Absent for pattern audiences, on purpose — the server never sends the
  // recipe to the browser. The card describes the person instead.
  spec?: CampaignTargeting
  uploadedCount: number
}
interface MetaAudienceRow {
  id: string
  name: string
  subtype: string
  approxLower: number | null
  approxUpper: number | null
}
interface Reach { lower: number; upper: number; ready: boolean }

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))
const reachLabel = (r: Reach | null, t: (k: string) => string, connected: boolean) =>
  !connected ? t('lm.aud.reach.connect') : !r ? t('lm.aud.reach.warming') : `${fmt(r.lower)}–${fmt(r.upper)}`

const COUNTRY_OPTIONS = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'GB', 'DE', 'IN', 'RU', 'CN', 'US']

// ─── CSV parsing (client-side; contacts go straight to the seed API) ─────────

const EMAIL_HEADERS = ['email', 'e-mail', 'mail', 'email address']
const PHONE_HEADERS = ['phone', 'mobile', 'phone number', 'tel', 'telephone', 'whatsapp', 'mobile number', 'contact']

function parseCsvContacts(text: string): { email: string; phone: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const split = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (const ch of line) {
      if (ch === '"') quoted = !quoted
      else if (ch === delim && !quoted) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim().replace(/^"|"$/g, ''))
  }
  const headers = split(lines[0]).map((h) => h.toLowerCase().trim())
  const emailIdx = headers.findIndex((h) => EMAIL_HEADERS.some((k) => h.includes(k)))
  const phoneIdx = headers.findIndex((h) => PHONE_HEADERS.some((k) => h.includes(k)))
  if (emailIdx < 0 && phoneIdx < 0) return []
  const rows: { email: string; phone: string }[] = []
  for (const line of lines.slice(1)) {
    const cells = split(line)
    const email = emailIdx >= 0 ? (cells[emailIdx] ?? '') : ''
    const phone = phoneIdx >= 0 ? (cells[phoneIdx] ?? '') : ''
    if ((email && email.includes('@')) || phone.replace(/\D/g, '').length >= 7) rows.push({ email, phone })
  }
  return rows
}


// ─── Ready buyers ─────────────────────────────────────────────────────────────
// Four buyers this market actually has, pre-described. Each is a PATTERN — the
// same thing the builder below produces — so saving one gives a real, launchable
// audience with real narrowing, not a template that exists to fill the page.
// Every one carries a genuine buying signal (investing / cash / golden visa);
// none is built on the "Property" pond that buys the whole market.
const READY_BUYERS: { id: string; pattern: Record<string, unknown> }[] = [
  {
    id: 'arabicCash',
    pattern: {
      speakers: ['arabic'], residency: ['resident', 'gcc'], motive: ['investment'],
      money: 'cash', readiness: 'browsing', lifeStage: [],
      exclude: ['agents_and_brokers', 'job_seekers', 'bargain_hunters'], strictness: 75,
    },
  },
  {
    id: 'goldenVisa',
    pattern: {
      speakers: ['arabic'], residency: ['gcc', 'overseas'], motive: ['golden_visa', 'investment'],
      money: 'cash', readiness: 'browsing', lifeStage: [],
      exclude: ['agents_and_brokers', 'job_seekers', 'bargain_hunters'], strictness: 75,
    },
  },
  {
    id: 'europeanInvestor',
    pattern: {
      speakers: ['european'], residency: ['overseas'], motive: ['investment', 'holiday_home'],
      money: 'cash', readiness: 'browsing', lifeStage: [],
      exclude: ['agents_and_brokers', 'job_seekers', 'bargain_hunters'], strictness: 70,
    },
  },
  {
    id: 'expatInvestor',
    pattern: {
      speakers: ['english'], residency: ['expat', 'resident'], motive: ['investment'],
      money: 'mortgage', readiness: 'browsing', lifeStage: [],
      exclude: ['agents_and_brokers', 'job_seekers', 'bargain_hunters'], strictness: 70,
    },
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AudiencesPage() {
  const t = useT()
  const [audiences, setAudiences] = useState<SavedAudience[]>([])
  /** Which ready buyer is being saved right now. */
  const [readySaving, setReadySaving] = useState<string | null>(null)
  const [metaAudiences, setMetaAudiences] = useState<MetaAudienceRow[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/audiences')
      const data = await res.json()
      setAudiences(Array.isArray(data.audiences) ? data.audiences : [])
      setMetaAudiences(Array.isArray(data.meta?.customAudiences) ? data.meta.customAudiences : [])
      setConnected(data.meta?.connected === true)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  // ── Lookalike from closed deals (automatic — no upload) ──
  const [buyers, setBuyers] = useState<{ count: number; min: number; ready: boolean; metaConnected: boolean } | null>(null)
  const [buyersName, setBuyersName] = useState('')
  const [buyersCountry, setBuyersCountry] = useState('AE')
  const [buyersRatio, setBuyersRatio] = useState(0.03)
  const [buyersConfirm, setBuyersConfirm] = useState(false)
  const [buyersWorking, setBuyersWorking] = useState(false)
  const [buyersMsg, setBuyersMsg] = useState<string | null>(null)

  const loadBuyers = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/lookalike')
      const data = await res.json()
      if (res.ok) setBuyers(data)
    } catch { /* leave null — section stays hidden */ }
  }, [])
  useEffect(() => { void loadBuyers() }, [loadBuyers])

  async function buildBuyersLookalike() {
    setBuyersMsg(null)
    setBuyersWorking(true)
    try {
      const res = await fetch('/api/freehold/ads/lookalike', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, label: buyersName.trim() || BRAND.company, country: buyersCountry, ratio: buyersRatio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setBuyersMsg(t('lm.aud.buyers.done').replace('{n}', String(data.uploaded)))
      setBuyersName(''); setBuyersConfirm(false)
      await Promise.all([load(), loadBuyers()])
    } catch (e) { setBuyersMsg(e instanceof Error ? e.message : 'Failed') } finally { setBuyersWorking(false) }
  }

  /** Save a ready buyer as a real audience. Once saved it lives in "Your
   *  audiences" like anything else — same kitchen, same launch path. Guarded
   *  by name so a second click cannot create a twin. */
  async function saveReadyBuyer(id: string, pattern: Record<string, unknown>) {
    const name = t(`lm.aud.ready.${id}.name`)
    if (audiences.some((a) => a.name === name)) return
    setReadySaving(id)
    try {
      const res = await fetch('/api/freehold/ads/audiences/pattern', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true, name, pattern: { ...pattern, name } }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed')
      await load()
    } catch { /* the card simply stays unsaved */ }
    finally { setReadySaving(null) }
  }

  // ── Lookalike seed upload ──
  const [seedContacts, setSeedContacts] = useState<{ email: string; phone: string }[]>([])
  const [seedFileName, setSeedFileName] = useState('')
  const [seedName, setSeedName] = useState('')
  const [seedCountry, setSeedCountry] = useState('AE')
  const [seedRatio, setSeedRatio] = useState(0.03)
  const [seedConfirm, setSeedConfirm] = useState(false)
  const [seedWorking, setSeedWorking] = useState(false)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)

  async function onSeedFile(file: File | null) {
    if (!file) return
    setSeedFileName(file.name)
    const text = await file.text()
    setSeedContacts(parseCsvContacts(text))
    setSeedMsg(null)
  }

  async function buildSeed() {
    setSeedMsg(null)
    setSeedWorking(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, name: seedName || seedFileName.replace(/\.csv$/i, ''), country: seedCountry, ratio: seedRatio, contacts: seedContacts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setSeedMsg(t('lm.aud.seed.done').replace('{n}', String(data.uploaded)))
      setSeedContacts([]); setSeedFileName(''); setSeedName(''); setSeedConfirm(false)
      await load()
    } catch (e) { setSeedMsg(e instanceof Error ? e.message : 'Failed') } finally { setSeedWorking(false) }
  }

  async function removeAudience(id: string) {
    if (!window.confirm(t('lm.aud.mine.deleteConfirm'))) return
    await fetch(`/api/freehold/ads/audiences/${id}`, { method: 'DELETE' })
    await load()
  }

  const KIND_LABEL: Record<SavedAudience['kind'], string> = {
    behavioral: t('lm.aud.kind.behavioral'),
    narrow: t('lm.aud.kind.narrow'),
    lookalike: t('lm.aud.kind.lookalike'),
    custom_list: t('lm.aud.kind.custom_list'),
    pattern: t('lm.aud.kind.pattern'),
  }

  const specSummary = (spec: CampaignTargeting) => {
    const bits: string[] = []
    if (spec.interests.length) bits.push(`${t('lm.aud.mine.interests')}: ${spec.interests.map((i) => i.name).slice(0, 3).join(', ')}${spec.interests.length > 3 ? '…' : ''}`)
    if (spec.behaviors?.length) bits.push(`${t('lm.aud.mine.behaviors')}: ${spec.behaviors.map((i) => i.name).slice(0, 3).join(', ')}${spec.behaviors.length > 3 ? '…' : ''}`)
    if (spec.narrowing?.length) bits.push(`${t('lm.aud.mine.narrowedBy')}: ${spec.narrowing.flatMap((g) => [...(g.interests ?? []), ...(g.behaviors ?? [])]).map((e) => e.name).slice(0, 3).join(', ')}`)
    const ex = [...(spec.exclusions?.interests ?? []), ...(spec.exclusions?.behaviors ?? [])]
    if (ex.length) bits.push(`${t('lm.aud.mine.excludes')}: ${ex.map((e) => e.name).slice(0, 2).join(', ')}`)
    if (spec.customAudienceIds?.length) bits.push(t('lm.aud.mine.metaIds'))
    // Language belongs in the summary: it is the one part of a saved audience
    // that changes WHO sees the ad without appearing in any interest list, so
    // leaving it off the card hides a real narrowing from the person reusing it.
    if (spec.leadLanguages?.length) {
      bits.push(`${t('lm.aud.mine.language')}: ${spec.leadLanguages.map((c) => t(`lm.aud.build.language.${c}`)).join(', ')}`)
    }
    return bits
  }

  const useHref = (id: string) => `/freehold-intelligence/lead-machine/campaigns/new?audience=${encodeURIComponent(id)}`

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-[22px] font-bold text-white"><Users className="h-5 w-5 text-gold" /> {t('lm.aud.title')}</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">{t('lm.aud.subtitle')}</p>
        {!loading && !connected && (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-slate-400">{t('lm.aud.notConnected')}</p>
        )}
      </header>

      {/* Ready buyers first: most people should never need to build anything.
          Pick a buyer, it saves, it launches. The builder below is for the
          buyer we have not pre-described. */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <Users className="h-4 w-4 text-gold" /> {t('lm.aud.ready.title')}
        </div>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.ready.sub')}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {READY_BUYERS.map(({ id, pattern }) => {
            const name = t(`lm.aud.ready.${id}.name`)
            const saved = audiences.find((a) => a.name === name)
            return (
              <div key={id} className="flex flex-col rounded-xl border border-line bg-surface-2 p-4">
                <div className="text-[13px] font-semibold text-white">{name}</div>
                <p className="mt-1 flex-1 text-[12px] leading-relaxed text-slate-400">{t(`lm.aud.ready.${id}.desc`)}</p>
                <div className="mt-3">
                  {saved ? (
                    <Link href={useHref(saved.id)} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold text-black">
                      <Rocket className="h-3 w-3" /> {t('lm.aud.mine.use')}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void saveReadyBuyer(id, pattern)}
                      disabled={readySaving !== null}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
                    >
                      {readySaving === id && <Loader2 className="h-3 w-3 animate-spin" />}
                      {t('lm.aud.ready.save')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* The order counter, first on the page. Describing a person is how an
          audience should be made here; the interest-by-interest builder below
          stays for the cases that genuinely need it. */}
      <PatternBuilder onSaved={load} />

      {/* How the budget would be split across ad sets, and why. A read, never
          a launch — creating ad sets stays a separate, deliberate act. */}
      {audiences.length > 0 && (
        <ArmPlanner audiences={audiences.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} />
      )}

      {/* My audiences */}
      <section>
        <h2 className="text-[15px] font-semibold text-white">{t('lm.aud.mine.title')}</h2>
        {!loading && audiences.length === 0 && <p className="mt-2 text-[13px] text-slate-500">{t('lm.aud.mine.empty')}</p>}
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a) => (
            <div key={a.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13px] font-semibold text-white">{a.name}</div>
                <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">{KIND_LABEL[a.kind]}</span>
              </div>
              {a.description && <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{a.description}</p>}
              {a.kind === 'lookalike' && a.uploadedCount > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">{t('lm.aud.mine.seeded').replace('{n}', a.uploadedCount.toLocaleString())}</p>
              )}
              <div className="mt-2 space-y-0.5">
                {a.spec
                  ? specSummary(a.spec).map((line) => <div key={line} className="text-[11px] text-slate-500">{line}</div>)
                  : <div className="text-[11px] text-slate-500">{t('lm.aud.mine.patternHidden')}</div>}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <Link href={useHref(a.id)} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold text-black"><Rocket className="h-3 w-3" /> {t('lm.aud.mine.use')}</Link>
                <button type="button" onClick={() => void removeAudience(a.id)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:border-red-500/40 hover:text-red-400">
                  <Trash2 className="h-3 w-3" /> {t('lm.aud.mine.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lookalike from closed deals — automatic, no upload */}
      {buyers && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><Handshake className="h-4 w-4 text-gold" /> {t('lm.aud.buyers.title')}</div>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.buyers.sub')}</p>
          {!buyers.metaConnected ? (
            <p className="mt-3 text-[12px] text-slate-400">{t('lm.aud.buyers.needMeta')}</p>
          ) : (
            <div className="mt-4 space-y-3.5">
              <p className={`text-[12px] font-semibold ${buyers.count >= buyers.min ? 'text-emerald-400' : 'text-amber-400'}`}>
                {buyers.count >= buyers.min
                  ? t('lm.aud.buyers.count').replace('{n}', buyers.count.toLocaleString())
                  : t('lm.aud.buyers.tooFew').replace('{n}', String(buyers.count)).replace('{min}', String(buyers.min))}
              </p>
              {buyers.ready && (
                <>
                  <div className="grid gap-2.5 md:grid-cols-3">
                    <input value={buyersName} onChange={(e) => setBuyersName(e.target.value)} placeholder={t('lm.aud.buyers.namePh')} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
                    <select value={buyersCountry} onChange={(e) => setBuyersCountry(e.target.value)} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
                      {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={buyersRatio} onChange={(e) => setBuyersRatio(Number(e.target.value))} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
                      <option value={0.01}>1%</option><option value={0.03}>3%</option><option value={0.05}>5%</option><option value={0.1}>10%</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500">{t('lm.aud.seed.ratio')}: {t('lm.aud.seed.ratioNote')}</p>
                  <label className="flex items-start gap-2 text-[12px] text-slate-300">
                    <input type="checkbox" checked={buyersConfirm} onChange={(e) => setBuyersConfirm(e.target.checked)} className="mt-0.5" />
                    <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" /> {t('lm.aud.seed.confirm')}</span>
                  </label>
                  <button type="button" onClick={buildBuyersLookalike} disabled={!buyersConfirm || buyersWorking}
                    className="flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50">
                    {buyersWorking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.aud.seed.working')}</> : t('lm.aud.seed.cta')}
                  </button>
                </>
              )}
              {buyersMsg && <p className="text-[12px] text-slate-300">{buyersMsg}</p>}
            </div>
          )}
        </section>
      )}

      {/* Lookalike from lead list */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><Upload className="h-4 w-4 text-gold" /> {t('lm.aud.seed.title')}</div>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.seed.sub')}</p>
        {!connected ? (
          <p className="mt-3 text-[12px] text-slate-400">{t('lm.aud.seed.needMeta')}</p>
        ) : (
          <div className="mt-4 space-y-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-[13px] font-semibold text-slate-300 transition hover:text-white">
                <Upload className="h-3.5 w-3.5" /> {t('lm.aud.seed.pick')}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onSeedFile(e.target.files?.[0] ?? null)} />
              </label>
              {seedFileName && <span className="text-[12px] text-slate-400">{seedFileName}</span>}
              {seedContacts.length > 0 && (
                <span className={`text-[12px] font-semibold ${seedContacts.length >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {seedContacts.length >= 100
                    ? t('lm.aud.seed.parsed').replace('{n}', seedContacts.length.toLocaleString())
                    : t('lm.aud.seed.tooFew').replace('{n}', String(seedContacts.length))}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{t('lm.aud.seed.csvHint')}</p>
            {seedContacts.length >= 100 && (
              <>
                <div className="grid gap-2.5 md:grid-cols-3">
                  <input value={seedName} onChange={(e) => setSeedName(e.target.value)} placeholder={t('lm.aud.seed.namePh')} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
                  <select value={seedCountry} onChange={(e) => setSeedCountry(e.target.value)} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
                    {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={seedRatio} onChange={(e) => setSeedRatio(Number(e.target.value))} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
                    <option value={0.01}>1%</option><option value={0.03}>3%</option><option value={0.05}>5%</option><option value={0.1}>10%</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">{t('lm.aud.seed.ratio')}: {t('lm.aud.seed.ratioNote')}</p>
                <label className="flex items-start gap-2 text-[12px] text-slate-300">
                  <input type="checkbox" checked={seedConfirm} onChange={(e) => setSeedConfirm(e.target.checked)} className="mt-0.5" />
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" /> {t('lm.aud.seed.confirm')}</span>
                </label>
                <button type="button" onClick={buildSeed} disabled={!seedConfirm || seedWorking}
                  className="flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50">
                  {seedWorking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.aud.seed.working')}</> : t('lm.aud.seed.cta')}
                </button>
              </>
            )}
            {seedMsg && <p className="text-[12px] text-slate-300">{seedMsg}</p>}
          </div>
        )}
      </section>

      {/* Meta account audiences */}
      {connected && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-white">{t('lm.aud.meta.title')}</h2>
          <p className="mt-1 text-[12px] text-slate-400">{t('lm.aud.meta.sub')}</p>
          {metaAudiences.length === 0 ? (
            <p className="mt-3 text-[13px] text-slate-500">{t('lm.aud.meta.empty')}</p>
          ) : (
            <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {metaAudiences.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium text-slate-200">{m.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">{m.subtype}</div>
                  </div>
                  <div className="text-[12px] text-slate-400">
                    {m.approxLower != null ? `${t('lm.aud.meta.size')}: ${fmt(m.approxLower)}${m.approxUpper && m.approxUpper !== m.approxLower ? `–${fmt(m.approxUpper)}` : ''}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
