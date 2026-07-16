'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Users, Sparkles, Loader2, Search, X, Trash2, Upload, ShieldCheck, Rocket, Globe, Handshake,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'

// ─── Types mirrored from the API ──────────────────────────────────────────────

interface SavedAudience {
  id: string
  name: string
  description: string
  kind: 'behavioral' | 'narrow' | 'lookalike' | 'custom_list'
  spec: CampaignTargeting
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
interface Suggestion {
  name: string
  description: string
  kind: 'saved' | 'composed'
  audienceId?: string
  spec: CampaignTargeting
  reach: Reach | null
}
interface VocabEntry { id: string; name: string; audienceLower?: number; audienceUpper?: number; path?: string }

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

// ─── Vocabulary picker (live Meta search) ─────────────────────────────────────

function EntityPicker({
  kind, placeholder, selected, onChange, connected,
}: {
  kind: 'interest' | 'behavior'
  placeholder: string
  selected: TargetingEntity[]
  onChange: (next: TargetingEntity[]) => void
  connected: boolean
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<VocabEntry[]>([])
  const [searching, setSearching] = useState(false)
  const [touched, setTouched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback((term: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (!term.trim()) { setResults([]); return }
      setSearching(true)
      try {
        const res = await fetch(`/api/freehold/ads/audiences/vocab?kind=${kind}&q=${encodeURIComponent(term)}`)
        const data = await res.json()
        setResults(Array.isArray(data.entries) ? data.entries : [])
        setTouched(true)
      } catch { setResults([]) } finally { setSearching(false) }
    }, 350)
  }, [kind])

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((e) => (
          <span key={e.id} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold">
            {e.name}
            <button type="button" onClick={() => onChange(selected.filter((s) => s.id !== e.id))} aria-label={`Remove ${e.name}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); runSearch(e.target.value) }}
          placeholder={placeholder}
          disabled={!connected}
          className="w-full rounded-lg border border-line bg-surface-2 py-2 ps-9 pe-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40 disabled:opacity-50"
        />
        {searching && <Loader2 className="absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-500" />}
      </div>
      {q.trim() && !searching && (
        <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1.5">
          {results.length === 0 && (
            <div className="px-2 py-1.5 text-[12px] text-slate-500">{touched ? t('lm.aud.build.noResults') : t('lm.aud.build.searchFirst')}</div>
          )}
          {results.filter((r) => !selected.some((s) => s.id === r.id)).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onChange([...selected, { id: r.id, name: r.name }]); setQ(''); setResults([]) }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-[12px] text-slate-300 transition hover:bg-surface-2"
            >
              <span>{r.name}{r.path ? <span className="ms-1.5 text-[10px] text-slate-500">{r.path}</span> : null}</span>
              {typeof r.audienceLower === 'number' && r.audienceLower > 0 && (
                <span className="shrink-0 text-[10px] text-slate-500">{fmt(r.audienceLower)}+ · {t('lm.aud.build.size')}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AudiencesPage() {
  const t = useT()
  const [audiences, setAudiences] = useState<SavedAudience[]>([])
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
        body: JSON.stringify({ confirm: true, label: buyersName.trim() || 'Freehold', country: buyersCountry, ratio: buyersRatio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setBuyersMsg(t('lm.aud.buyers.done').replace('{n}', String(data.uploaded)))
      setBuyersName(''); setBuyersConfirm(false)
      await Promise.all([load(), loadBuyers()])
    } catch (e) { setBuyersMsg(e instanceof Error ? e.message : 'Failed') } finally { setBuyersWorking(false) }
  }

  // ── AI match ──
  const [match, setMatch] = useState({ name: '', area: '', price: '', type: '' })
  const [matching, setMatching] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [matchNote, setMatchNote] = useState<string | null>(null)
  const [strategyLine, setStrategyLine] = useState<string | null>(null)

  async function runMatch() {
    setMatching(true)
    setSuggestions(null)
    try {
      const res = await fetch('/api/freehold/ads/audiences/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: match.name || match.area || match.price
            ? { name: match.name, area: match.area, price: Number(match.price) || 0, type: match.type }
            : null,
        }),
      })
      const data = await res.json()
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      setMatchNote(typeof data.note === 'string' ? data.note : null)
      const rec = data.recommendation
      setStrategyLine(rec && typeof rec.rationale === 'string' && rec.rationale ? rec.rationale : null)
    } catch {
      setSuggestions([])
      setMatchNote('Request failed — try again.')
    } finally { setMatching(false) }
  }

  async function saveSuggestion(s: Suggestion) {
    const res = await fetch('/api/freehold/ads/audiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: s.name, description: s.description, kind: (s.spec.narrowing?.length ? 'narrow' : 'behavioral'), spec: s.spec }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      await load()
      // Carry the new id back onto the card so "Use in campaign" appears.
      setSuggestions((prev) => prev?.map((x) => (x === s ? { ...x, kind: 'saved', audienceId: data?.audience?.id } : x)) ?? null)
    }
  }

  // ── Builder ──
  const emptySpec = useMemo(() => ({
    countries: ['AE'], ageMin: 25, ageMax: 55, genders: [] as number[],
    interests: [] as TargetingEntity[], behaviors: [] as TargetingEntity[],
    narrowInterests: [] as TargetingEntity[], narrowBehaviors: [] as TargetingEntity[],
    excludeInterests: [] as TargetingEntity[],
  }), [])
  const [b, setB] = useState(emptySpec)
  const [bName, setBName] = useState('')
  const [bDesc, setBDesc] = useState('')
  const [bSaving, setBSaving] = useState(false)
  const [bMsg, setBMsg] = useState<string | null>(null)
  const [bReach, setBReach] = useState<Reach | null>(null)
  const [bReachLoading, setBReachLoading] = useState(false)

  const builderSpec = useCallback((): Partial<CampaignTargeting> => ({
    countries: b.countries,
    ageMin: b.ageMin,
    ageMax: b.ageMax,
    genders: b.genders.length ? b.genders : undefined,
    interests: b.interests,
    behaviors: b.behaviors,
    narrowing: b.narrowInterests.length + b.narrowBehaviors.length > 0
      ? [{ interests: b.narrowInterests, behaviors: b.narrowBehaviors }]
      : [],
    exclusions: b.excludeInterests.length ? { interests: b.excludeInterests } : undefined,
  }), [b])

  async function checkBuilderReach() {
    setBReachLoading(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences/reach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec: builderSpec() }),
      })
      const data = await res.json()
      setBReach(data.reach ?? null)
    } finally { setBReachLoading(false) }
  }

  async function saveBuilder() {
    setBMsg(null)
    if (!bName.trim()) { setBMsg(t('lm.aud.build.needName')); return }
    if (b.interests.length + b.behaviors.length === 0) { setBMsg(t('lm.aud.build.needBase')); return }
    setBSaving(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bName, description: bDesc,
          kind: b.narrowInterests.length + b.narrowBehaviors.length > 0 ? 'narrow' : 'behavioral',
          spec: builderSpec(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      setBMsg(t('lm.aud.build.saved'))
      setB(emptySpec); setBName(''); setBDesc(''); setBReach(null)
      await load()
    } catch (e) { setBMsg(e instanceof Error ? e.message : 'Save failed') } finally { setBSaving(false) }
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
  }

  const specSummary = (spec: CampaignTargeting) => {
    const bits: string[] = []
    if (spec.interests.length) bits.push(`${t('lm.aud.mine.interests')}: ${spec.interests.map((i) => i.name).slice(0, 3).join(', ')}${spec.interests.length > 3 ? '…' : ''}`)
    if (spec.behaviors?.length) bits.push(`${t('lm.aud.mine.behaviors')}: ${spec.behaviors.map((i) => i.name).slice(0, 3).join(', ')}${spec.behaviors.length > 3 ? '…' : ''}`)
    if (spec.narrowing?.length) bits.push(`${t('lm.aud.mine.narrowedBy')}: ${spec.narrowing.flatMap((g) => [...(g.interests ?? []), ...(g.behaviors ?? [])]).map((e) => e.name).slice(0, 3).join(', ')}`)
    const ex = [...(spec.exclusions?.interests ?? []), ...(spec.exclusions?.behaviors ?? [])]
    if (ex.length) bits.push(`${t('lm.aud.mine.excludes')}: ${ex.map((e) => e.name).slice(0, 2).join(', ')}`)
    if (spec.customAudienceIds?.length) bits.push(t('lm.aud.mine.metaIds'))
    return bits
  }

  const useHref = (id: string) => `/freehold-intelligence/lead-machine/campaigns/new?audience=${encodeURIComponent(id)}`

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-[22px] font-bold text-white"><Users className="h-5 w-5 text-gold" /> {t('lm.aud.title')}</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-400">{t('lm.aud.subtitle')}</p>
        {!loading && !connected && (
          <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-300">{t('lm.aud.notConnected')}</p>
        )}
      </header>

      {/* AI best-match */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-white"><Sparkles className="h-4 w-4 text-gold" /> {t('lm.aud.match.title')}</div>
        <p className="mt-1 text-[12px] text-slate-400">{t('lm.aud.match.sub')}</p>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-5">
          {([
            ['name', t('lm.aud.match.name')], ['area', t('lm.aud.match.area')],
            ['price', t('lm.aud.match.price')], ['type', t('lm.aud.match.type')],
          ] as const).map(([key, label]) => (
            <input
              key={key}
              value={match[key]}
              onChange={(e) => setMatch((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={label}
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40"
            />
          ))}
          <button
            type="button"
            onClick={runMatch}
            disabled={matching}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {matching ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.aud.match.working')}</> : <>{t('lm.aud.match.cta')}</>}
          </button>
        </div>
        {strategyLine && (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-slate-300">
            <span className="me-1.5 font-semibold uppercase tracking-wider text-gold">{t('lm.aud.match.strategyNote')}</span>{strategyLine}
          </p>
        )}
        {matchNote && <p className="mt-3 text-[12px] text-slate-400">{matchNote}</p>}
        {suggestions && suggestions.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {suggestions.map((s, i) => (
              <div key={`${s.name}-${i}`} className="rounded-xl border border-line bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13px] font-semibold text-white">{s.name}</div>
                  <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                    {s.kind === 'saved' ? t('lm.aud.match.saved') : t('lm.aud.match.composed')}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{s.description}</p>
                <div className="mt-2 space-y-0.5">
                  {specSummary(s.spec).map((line) => <div key={line} className="text-[11px] text-slate-500">{line}</div>)}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">{t('lm.aud.reach')}: <span className="font-semibold text-gold">{reachLabel(s.reach, t, connected)}</span></span>
                  {s.audienceId ? (
                    <Link href={useHref(s.audienceId)} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold text-black"><Rocket className="h-3 w-3" /> {t('lm.aud.match.use')}</Link>
                  ) : s.kind === 'composed' ? (
                    <button type="button" onClick={() => void saveSuggestion(s)} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20">{t('lm.aud.match.save')}</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                {specSummary(a.spec).map((line) => <div key={line} className="text-[11px] text-slate-500">{line}</div>)}
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

      {/* Builder */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold text-white">{t('lm.aud.build.title')}</h2>
        <p className="mt-1 text-[12px] text-slate-400">{t('lm.aud.build.sub')}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.name')}</label>
              <input value={bName} onChange={(e) => setBName(e.target.value)} placeholder={t('lm.aud.build.namePh')} className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.desc')}</label>
              <input value={bDesc} onChange={(e) => setBDesc(e.target.value)} placeholder={t('lm.aud.build.descPh')} className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Globe className="me-1 inline h-3 w-3" />{t('lm.aud.build.countries')}</label>
              <div className="flex flex-wrap gap-1.5">
                {COUNTRY_OPTIONS.map((c) => {
                  const on = b.countries.includes(c)
                  return (
                    <button key={c} type="button"
                      onClick={() => setB((p) => ({ ...p, countries: on ? p.countries.filter((x) => x !== c) : [...p.countries, c] }))}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.age')}</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={18} max={65} value={b.ageMin} onChange={(e) => setB((p) => ({ ...p, ageMin: Number(e.target.value) || 18 }))} className="w-16 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-center text-[13px] text-slate-200 outline-none focus:border-gold/40" />
                  <span className="text-slate-500">–</span>
                  <input type="number" min={18} max={65} value={b.ageMax} onChange={(e) => setB((p) => ({ ...p, ageMax: Number(e.target.value) || 65 }))} className="w-16 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-center text-[13px] text-slate-200 outline-none focus:border-gold/40" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.gender')}</label>
                <div className="flex gap-1.5">
                  {([['all', []], ['men', [1]], ['women', [2]]] as const).map(([key, val]) => {
                    const on = JSON.stringify(b.genders) === JSON.stringify(val)
                    return (
                      <button key={key} type="button" onClick={() => setB((p) => ({ ...p, genders: [...val] }))}
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${on ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                        {t(`lm.aud.build.gender.${key}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.base')}</label>
              <div className="space-y-2">
                <EntityPicker kind="interest" placeholder={t('lm.aud.build.searchInterests')} selected={b.interests} onChange={(v) => setB((p) => ({ ...p, interests: v }))} connected={connected} />
                <EntityPicker kind="behavior" placeholder={t('lm.aud.build.searchBehaviors')} selected={b.behaviors} onChange={(v) => setB((p) => ({ ...p, behaviors: v }))} connected={connected} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.narrow')}</label>
              <div className="space-y-2">
                <EntityPicker kind="interest" placeholder={t('lm.aud.build.searchInterests')} selected={b.narrowInterests} onChange={(v) => setB((p) => ({ ...p, narrowInterests: v }))} connected={connected} />
                <EntityPicker kind="behavior" placeholder={t('lm.aud.build.searchBehaviors')} selected={b.narrowBehaviors} onChange={(v) => setB((p) => ({ ...p, narrowBehaviors: v }))} connected={connected} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('lm.aud.build.exclude')}</label>
              <EntityPicker kind="interest" placeholder={t('lm.aud.build.searchInterests')} selected={b.excludeInterests} onChange={(v) => setB((p) => ({ ...p, excludeInterests: v }))} connected={connected} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveBuilder} disabled={bSaving} className="flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-60">
            {bSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.aud.build.saving')}</> : t('lm.aud.build.save')}
          </button>
          <button type="button" onClick={checkBuilderReach} disabled={bReachLoading || !connected} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-[13px] font-semibold text-slate-300 transition hover:text-white disabled:opacity-50">
            {bReachLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t('lm.aud.reach.check')}
          </button>
          {(bReach || !connected) && (
            <span className="text-[12px] text-slate-400">{t('lm.aud.reach')}: <span className="font-semibold text-gold">{reachLabel(bReach, t, connected)}</span></span>
          )}
          {bMsg && <span className="text-[12px] text-slate-300">{bMsg}</span>}
        </div>
      </section>

      {/* Lookalike from closed deals — automatic, no upload */}
      {buyers && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><Handshake className="h-4 w-4 text-gold" /> {t('lm.aud.buyers.title')}</div>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.buyers.sub')}</p>
          {!buyers.metaConnected ? (
            <p className="mt-3 text-[12px] text-amber-300">{t('lm.aud.buyers.needMeta')}</p>
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
          <p className="mt-3 text-[12px] text-amber-300">{t('lm.aud.seed.needMeta')}</p>
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
