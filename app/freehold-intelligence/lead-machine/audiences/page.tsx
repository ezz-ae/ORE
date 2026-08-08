'use client'

/**
 * THE SMART AUDIENCE CREATOR.
 *
 * This page MAKES audiences; the ready-made market list lives on the
 * Targeting page. Three ways to make one, all through the same kitchen:
 *
 *   · PERSONAS — our list of people ("doctors", "golden-visa seekers"),
 *     stackable up to three, each translating to a LIST of live Meta signals
 *     server-side. The operator combines words; the kitchen does Meta.
 *   · A PATTERN — describe the person in a salesperson's words, one dial.
 *   · LOOKALIKES — similar people to our own records (closed deals, the CRM,
 *     imported lists, or a CSV), analysed and tiered before upload, at up to
 *     three similarity levels in one go.
 *
 * One hard rule everywhere: real-estate interest is a MUST in every audience
 * this page produces. The recipes never reach the browser.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Rocket, Trash2, ArrowUpRight, Sparkles, PenLine, Database, X, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { CampaignTargeting } from '@/lib/meta/types'
import PatternBuilder from './PatternBuilder'
import PersonaStudio from './PersonaStudio'
import LookalikeStudio from './LookalikeStudio'
import CrmAudiences from './CrmAudiences'

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
  /** Meta's live estimate. Present only when Meta answered — never a placeholder. */
  reach?: { lower: number; upper: number }
}
interface MetaAudienceRow {
  id: string
  name: string
  subtype: string
  approxLower: number | null
  approxUpper: number | null
}

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))

export default function AudiencesPage() {
  const t = useT()
  const [audiences, setAudiences] = useState<SavedAudience[]>([])
  const [metaAudiences, setMetaAudiences] = useState<MetaAudienceRow[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  // Cards choose the tool; the page never opens as a wall of forms.
  const [tool, setTool] = useState<'personas' | 'pattern' | null>(null)
  const [crmOpen, setCrmOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  // Combine: pick 2+ saved audiences, name the union, save it as one.
  const [combining, setCombining] = useState(false)
  const [combinePicked, setCombinePicked] = useState<string[]>([])
  const [combineName, setCombineName] = useState('')
  const [combineWorking, setCombineWorking] = useState(false)
  const [combineMsg, setCombineMsg] = useState<string | null>(null)

  async function saveCombined() {
    setCombineMsg(null)
    setCombineWorking(true)
    try {
      const res = await fetch('/api/freehold/ads/audiences/combine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: combinePicked, name: combineName.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      setCombining(false); setCombinePicked([]); setCombineName('')
      await load()
    } catch (e) { setCombineMsg(e instanceof Error ? e.message : 'Failed') } finally { setCombineWorking(false) }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/audiences?reach=1')
      const data = await res.json()
      setAudiences(Array.isArray(data.audiences) ? data.audiences : [])
      setMetaAudiences(Array.isArray(data.meta?.customAudiences) ? data.meta.customAudiences : [])
      setConnected(data.meta?.connected === true)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

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
        {/* The ready-made market list moved to Targeting — say so where people
            used to find it, with the way there. */}
        <Link href="/freehold-intelligence/lead-machine/targeting" className="mt-2 inline-flex items-center gap-1 text-[12px] text-gold/80 transition hover:text-gold">
          {t('lm.aud.readyMoved')} <ArrowUpRight className="h-3 w-3" />
        </Link>
        {!loading && !connected && (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-slate-400">{t('lm.aud.notConnected')}</p>
        )}
      </header>

      {/* Four ways to make an audience, as cards — the page never opens as a
          wall of forms. Personas and the pattern builder expand below;
          CRM and Data open as popups. */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { id: 'personas', icon: Sparkles, onClick: () => setTool(tool === 'personas' ? null : 'personas'), active: tool === 'personas' },
          { id: 'pattern', icon: PenLine, onClick: () => setTool(tool === 'pattern' ? null : 'pattern'), active: tool === 'pattern' },
          { id: 'crm', icon: Users, onClick: () => setCrmOpen(true), active: false },
          { id: 'data', icon: Database, onClick: () => setDataOpen(true), active: false },
        ] as const).map(({ id, icon: Icon, onClick, active }) => (
          <button key={id} type="button" onClick={onClick}
            className={`flex flex-col items-start rounded-2xl border p-4 text-start transition ${
              active ? 'border-gold/50 bg-gold/10' : 'border-line bg-surface hover:border-slate-600'
            }`}>
            <Icon className={`h-4 w-4 ${active ? 'text-gold' : 'text-gold/70'}`} />
            <span className={`mt-2 text-[13px] font-semibold ${active ? 'text-gold' : 'text-white'}`}>{t(`lm.aud.create.${id}.name`)}</span>
            <span className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{t(`lm.aud.create.${id}.desc`)}</span>
          </button>
        ))}
      </section>

      {tool === 'personas' && <PersonaStudio onSaved={load} />}
      {tool === 'pattern' && <PatternBuilder onSaved={load} />}

      <CrmAudiences open={crmOpen} onClose={() => setCrmOpen(false)} onSaved={load} />

      {/* Data custom audiences — upload a list, get similar people. */}
      {dataOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDataOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button type="button" onClick={() => setDataOpen(false)}
                className="absolute end-3 top-3 z-10 rounded-full p-1 text-slate-500 transition hover:text-white" aria-label={t('lm.aud.crm.close')}>
                <X className="h-4 w-4" />
              </button>
              <LookalikeStudio onSaved={() => { void load() }} />
            </div>
          </div>
        </div>
      )}

      {/* The budget-split planner used to render here and is deliberately
          GONE from the product. How the machine splits budget between ad
          sets is our kitchen, not client information — they choose an
          audience and the system does the rest. The engine and its API stay
          for the machine itself. */}

      {/* My audiences */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-white">{t('lm.aud.mine.title')}</h2>
          {audiences.length >= 2 && (
            <button type="button"
              onClick={() => { setCombining((v) => !v); setCombinePicked([]); setCombineMsg(null) }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${combining ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
              {combining ? t('lm.aud.combine.cancel') : t('lm.aud.combine.start')}
            </button>
          )}
        </div>
        {combining && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
            <span className="text-[12px] text-slate-300">{t('lm.aud.combine.hint')}</span>
            <input value={combineName} onChange={(e) => setCombineName(e.target.value)} placeholder={t('lm.aud.combine.namePh')}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
            <button type="button" onClick={() => void saveCombined()} disabled={combineWorking || combinePicked.length < 2 || !combineName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-1.5 text-[12px] font-bold text-black transition hover:brightness-110 disabled:opacity-50">
              {combineWorking && <Loader2 className="h-3 w-3 animate-spin" />} {t('lm.aud.combine.cta')}
            </button>
            {combineMsg && <span className="text-[12px] text-slate-300">{combineMsg}</span>}
          </div>
        )}
        {!loading && audiences.length === 0 && <p className="mt-2 text-[13px] text-slate-500">{t('lm.aud.mine.empty')}</p>}
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a) => (
            <div key={a.id}
              onClick={combining ? () => setCombinePicked((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]) : undefined}
              className={`flex flex-col rounded-xl border bg-surface p-4 ${
                combining
                  ? `cursor-pointer ${combinePicked.includes(a.id) ? 'border-gold/60 bg-gold/[0.06]' : 'border-line hover:border-slate-600'}`
                  : 'border-line'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13px] font-semibold text-white">{a.name}</div>
                <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">{KIND_LABEL[a.kind]}</span>
              </div>
              {a.reach && (
                <p className="mt-1 text-[12px] font-semibold text-white">{t('lm.aud.ready.reach')}: {fmt(a.reach.lower)}–{fmt(a.reach.upper)}</p>
              )}
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
