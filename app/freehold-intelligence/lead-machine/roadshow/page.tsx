'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Megaphone, Target, Loader2, Sparkles, ArrowLeft, CalendarPlus, MapPin,
  LayoutTemplate, CalendarCheck, Rocket, ExternalLink, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useT, useI18n } from '@/lib/i18n/provider'

type CalEvent = { id: string; title: string; kind: string; startsAt: string; endsAt: string; location: string; externalParty: string; description: string; status: string; redacted: boolean }

type Plan = {
  objective?: string
  audience?: string
  keyMessage?: string
  where?: string
  timeline?: { phase?: string; when?: string; action?: string }[]
  budget?: string
  steps?: string[]
  assets?: { type?: string; label?: string; note?: string }[]
}

const GOALS = ['registrations', 'viewings', 'sales', 'awareness'] as const

export default function RoadshowPage() {
  const t = useT()
  const { dir } = useI18n()

  const [events, setEvents] = useState<CalEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [answers, setAnswers] = useState({ audience: '', goal: 'registrations', budget: '', offer: '', keyMessage: '', durationDays: '10' })
  const [plan, setPlan] = useState<Plan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftLink, setDraftLink] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/freehold/calendar')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const all: CalEvent[] = Array.isArray(d?.events) ? d.events : []
        const now = Date.now()
        const eventLike = all
          .filter((e) => ['roadshow', 'team_meeting', 'training'].includes(e.kind) && !e.redacted && e.status !== 'cancelled')
          .filter((e) => new Date(e.endsAt).getTime() >= now - 86400000)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        setEvents(eventLike)
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false))
  }, [])

  const step = plan ? 3 : selected ? 2 : 1

  async function generate() {
    if (!selected) { toast.error(t('proad.err.pickEvent')); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/freehold/ads/roadshow-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { title: selected.title, startsAt: selected.startsAt, location: selected.location, externalParty: selected.externalParty, description: selected.description },
          answers,
        }),
      })
      const d = await res.json()
      if (d.plan) setPlan(d.plan as Plan)
      else toast.error(d.error || t('proad.err.gen'))
    } catch {
      toast.error(t('proad.err.gen'))
    } finally {
      setGenerating(false)
    }
  }

  async function createDraft() {
    if (!selected || !plan) return
    setDraftBusy(true)
    try {
      const res = await fetch('/api/freehold/ads/roadshow-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { title: selected.title, startsAt: selected.startsAt, location: selected.location, externalParty: selected.externalParty, description: selected.description },
          answers,
          plan,
        }),
      })
      const d = await res.json()
      if (d.ok && d.link) { setDraftLink(d.link as string); toast.success(t('proad.asset.draftReady')) }
      else toast.error(d.error || t('proad.err.launch'))
    } catch {
      toast.error(t('proad.err.launch'))
    } finally {
      setDraftBusy(false)
    }
  }

  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' } }

  const ASSET_META: Record<string, { Icon: typeof LayoutTemplate; href: string | null }> = useMemo(() => ({
    landing: { Icon: LayoutTemplate, href: '/freehold-intelligence/lead-machine/landings' },
    fb_event: { Icon: CalendarCheck, href: null },
    campaign: { Icon: Rocket, href: '/freehold-intelligence/lead-machine/campaigns/launch' },
  }), [])

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-7 sm:px-8" dir={dir}>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white"><Megaphone className="h-5 w-5 text-rose-400" />{t('proad.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('proad.subtitle')}</p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 text-xs">
        {[t('proad.step.event'), t('proad.step.brief'), t('proad.step.plan')].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${step > i ? 'bg-rose-400 text-black' : step === i + 1 ? 'bg-rose-400/20 text-rose-300 border border-rose-400/40' : 'bg-surface-2 text-slate-500'}`}>{i + 1}</span>
            <span className={step === i + 1 ? 'text-white' : 'text-slate-500'}>{label}</span>
            {i < 2 && <span className="mx-1 h-px w-6 bg-line" />}
          </div>
        ))}
      </div>

      {/* Step 1: pick event */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-300">{t('proad.pickEvent')}</div>
          {loadingEvents ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center">
              <p className="text-sm text-slate-400">{t('proad.noEvents')}</p>
              <Link href="/freehold-intelligence/calendar" className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-400/20">
                <CalendarPlus className="h-4 w-4" />{t('proad.noEventsCta')}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <button key={e.id} onClick={() => setSelected(e)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-start transition hover:border-rose-400/30">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-400/10"><Megaphone className="h-4 w-4 text-rose-400" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{e.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{fmtDate(e.startsAt)}</span>
                      {e.location && <><span>·</span><span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{e.location}</span></>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: brief */}
      {step === 2 && selected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{selected.title}</div>
              <div className="text-xs text-slate-500">{fmtDate(selected.startsAt)}{selected.location ? ` · ${selected.location}` : ''}</div>
            </div>
            <button onClick={() => setSelected(null)} className="shrink-0 text-xs text-slate-400 hover:text-white">{t('proad.change')}</button>
          </div>

          <Field label={t('proad.q.audience')}>
            <input value={answers.audience} onChange={(e) => setAnswers({ ...answers, audience: e.target.value })} placeholder={t('proad.q.audiencePh')} className="fld" />
          </Field>

          <Field label={t('proad.q.goal')}>
            <div className="flex flex-wrap gap-1.5">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setAnswers({ ...answers, goal: g })} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${answers.goal === g ? 'border-rose-400/40 bg-rose-400/10 text-rose-300' : 'border-line bg-surface text-slate-400 hover:text-slate-200'}`}>{t(`proad.goal.${g}`)}</button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('proad.q.budget')}><input value={answers.budget} onChange={(e) => setAnswers({ ...answers, budget: e.target.value })} inputMode="numeric" placeholder={t('proad.q.budgetPh')} className="fld" /></Field>
            <Field label={t('proad.q.duration')}><input value={answers.durationDays} onChange={(e) => setAnswers({ ...answers, durationDays: e.target.value })} inputMode="numeric" placeholder={t('proad.q.durationPh')} className="fld" /></Field>
          </div>

          <Field label={t('proad.q.offer')}><input value={answers.offer} onChange={(e) => setAnswers({ ...answers, offer: e.target.value })} placeholder={t('proad.q.offerPh')} className="fld" /></Field>
          <Field label={t('proad.q.message')}><textarea value={answers.keyMessage} onChange={(e) => setAnswers({ ...answers, keyMessage: e.target.value })} rows={2} placeholder={t('proad.q.messagePh')} className="fld resize-none" /></Field>

          <button onClick={generate} disabled={generating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-rose-300 disabled:opacity-60">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? t('proad.generating') : t('proad.generate')}
          </button>

          <style jsx>{`.fld{width:100%;border-radius:12px;border:1px solid var(--line,#26262b);background:var(--surface,#151518);padding:10px 12px;font-size:14px;color:#fff;outline:none}.fld::placeholder{color:#64748b}.fld:focus{border-color:rgba(251,113,133,.4)}`}</style>
        </div>
      )}

      {/* Step 3: plan */}
      {step === 3 && plan && (
        <div className="space-y-4">
          <button onClick={() => setPlan(null)} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />{t('proad.back')}</button>

          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <PlanRow icon={Target} label={t('proad.plan.why')} text={plan.objective} />
            <PlanRow icon={Target} label={t('proad.plan.who')} text={plan.audience} />
            <PlanRow icon={Megaphone} label={t('proad.plan.message')} text={plan.keyMessage} />
            <PlanRow icon={MapPin} label={t('proad.plan.where')} text={plan.where} />
            <PlanRow icon={CalendarCheck} label={t('proad.plan.budget')} text={plan.budget} />

            {Array.isArray(plan.timeline) && plan.timeline.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-300">{t('proad.plan.when')}</div>
                <div className="space-y-2">
                  {plan.timeline.map((ph, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface-2 p-2.5">
                      <span className="shrink-0 text-xs font-semibold text-rose-300">{ph.when}</span>
                      <span className="text-xs text-slate-300"><b className="text-white">{ph.phase}</b> — {ph.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(plan.steps) && plan.steps.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-300">{t('proad.plan.how')}</div>
                <ol className="space-y-1.5">
                  {plan.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300"><span className="text-rose-300">{i + 1}.</span>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Assets — feed Meta, don't replace it */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('proad.plan.assets')}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(plan.assets && plan.assets.length ? plan.assets : [{ type: 'landing' }, { type: 'fb_event' }, { type: 'campaign' }]).map((as, i) => {
                const meta = ASSET_META[as.type || ''] || { Icon: LayoutTemplate, href: null }
                const Icon = meta.Icon
                const isCampaign = as.type === 'campaign'
                return (
                  <div key={i} className="flex flex-col rounded-xl border border-line bg-surface p-3.5">
                    <Icon className="h-4 w-4 text-rose-400" />
                    <div className="mt-2 text-sm font-medium text-white">{as.label || t(`proad.asset.${as.type}`)}</div>
                    {as.note && <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{as.note}</div>}
                    {isCampaign ? (
                      draftLink ? (
                        <Link href={draftLink} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20">
                          {t('proad.asset.openDraft')} <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <button onClick={createDraft} disabled={draftBusy} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-400/20 disabled:opacity-60">
                          {draftBusy ? <><Loader2 className="h-3 w-3 animate-spin" />{t('proad.asset.building')}</> : <>{t('proad.asset.buildDraft')} <Rocket className="h-3 w-3" /></>}
                        </button>
                      )
                    ) : meta.href ? (
                      <Link href={meta.href} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-400/20">
                        {t('proad.asset.create')} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-slate-500"><Info className="h-3 w-3" />{t('proad.asset.fbNote')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function PlanRow({ icon: Icon, label, text }: { icon: typeof Target; label: string; text?: string }) {
  if (!text) return null
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-0.5 text-sm text-slate-200">{text}</div>
      </div>
    </div>
  )
}
