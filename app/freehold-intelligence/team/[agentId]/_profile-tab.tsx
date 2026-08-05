'use client'

/**
 * The person, not the account.
 *
 * "Everyone is a profile with all his belongs — take it from offer letter and
 * go deeper in every aspect including his sales his lead his everything."
 *
 * This tab is the top of that chain: the facts an offer letter actually carries
 * — start date, employment type, probation, licence number, title, commission,
 * the targets they're measured against, and who they report to. Every other tab
 * on this page (performance, pipeline, credits) is a number; without these,
 * none of those numbers mean anything. "12 deals" is only good or bad next to a
 * target, and a tenure of three weeks reads differently from three years.
 *
 * Empty is shown as empty. A profile with no BRN says "—", never a plausible
 * blank that reads as filled-in.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Save, Lock, ScrollText } from 'lucide-react'
import { Panel, PanelHeader, Button, fieldClass } from '@/components/freehold/ui'
import { useI18n } from '@/lib/i18n/provider'
import { load, type Member } from '../_lib'

interface Spine {
  teamId: string | null
  teamName: string | null
  reportsTo: string | null
  reportsToName: string | null
  startDate: string | null
  employmentType: string | null
  probationEnd: string | null
  reraBrn: string | null
  offerRef: string | null
  orgTitle: string | null
  commissionRate: number | null
  targetDealsMonthly: number | null
  targetRevenueMonthly: number | null
  notes: string | null
}

interface TeamRow { id: string; name: string; leaderUserId: string | null; leaderName: string | null; memberCount: number }

interface LogRow {
  id: string; actorEmail: string; actorRole: string; action: string
  decision: 'allowed' | 'denied'; reason: string; detail: string | null; createdAt: string
}

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'commission_only', 'contract'] as const

/** Wire field names, so the form and the API whitelist cannot drift. */
type Draft = {
  team_id: string
  reports_to: string
  start_date: string
  employment_type: string
  probation_end: string
  rera_brn: string
  offer_ref: string
  org_title: string
  commission_rate: string
  target_deals_monthly: string
  target_revenue_monthly: string
  notes: string
}

const emptyDraft: Draft = {
  team_id: '', reports_to: '', start_date: '', employment_type: '', probation_end: '',
  rera_brn: '', offer_ref: '', org_title: '', commission_rate: '',
  target_deals_monthly: '', target_revenue_monthly: '', notes: '',
}

const draftFrom = (s: Spine): Draft => ({
  team_id: s.teamId ?? '',
  reports_to: s.reportsTo ?? '',
  start_date: s.startDate ?? '',
  employment_type: s.employmentType ?? '',
  probation_end: s.probationEnd ?? '',
  rera_brn: s.reraBrn ?? '',
  offer_ref: s.offerRef ?? '',
  org_title: s.orgTitle ?? '',
  commission_rate: s.commissionRate == null ? '' : String(s.commissionRate),
  target_deals_monthly: s.targetDealsMonthly == null ? '' : String(s.targetDealsMonthly),
  target_revenue_monthly: s.targetRevenueMonthly == null ? '' : String(s.targetRevenueMonthly),
  notes: s.notes ?? '',
})

export function ProfileTab({
  agentId, roster, canEdit,
}: { agentId: string; roster: Member[]; canEdit: boolean }) {
  const { t, locale } = useI18n()
  const localeTag = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [spine, setSpine] = useState<Spine | null>(null)
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [log, setLog] = useState<LogRow[]>([])
  const [errs, setErrs] = useState<Partial<Record<'profile' | 'teams' | 'log', string>>>({})
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const [prof, teamList, logRes] = await Promise.all([
      load<{ profile: Spine | null }>(`/api/freehold/team/${encodeURIComponent(agentId)}`),
      load<{ teams: TeamRow[] }>('/api/freehold/team/teams'),
      load<{ entries: LogRow[] }>(`/api/freehold/authority-log?targetType=member&targetId=${encodeURIComponent(agentId)}&limit=25`),
    ])
    const e: typeof errs = {}
    if (prof.ok) {
      const s = prof.data.profile
      setSpine(s)
      if (s) setDraft(draftFrom(s))
    } else e.profile = prof.error
    if (teamList.ok) setTeams(teamList.data.teams ?? []); else e.teams = teamList.error
    if (logRes.ok) setLog(logRes.data.entries ?? []); else e.log = logRes.error
    setErrs(e)
    setLoaded(true)
  }, [agentId])

  useEffect(() => { void refresh() }, [refresh])

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  async function save() {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/team/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        // Say what the server said. "Couldn't save, try again" is the reflex
        // that made this system feel broken in the first place.
        toast.error(body?.error ?? `${t('team.profile.saveFailed')} (${res.status})`)
        return
      }
      toast.success(t('team.profile.saved'))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('team.profile.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(localeTag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }) : '—'

  if (!loaded) return <div className="py-12 text-center text-sm text-slate-500">{t('team.loading')}</div>

  if (errs.profile) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-red-200">{t('team.profile.loadFailed')}</div>
          <div className="text-xs text-red-300/80">{errs.profile}</div>
          <button onClick={() => void refresh()} className="mt-2 text-xs font-medium text-red-200 underline">{t('team.retry')}</button>
        </div>
      </div>
    )
  }

  // Managers and leaders alike see the tenure line; only managers can edit.
  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</label>
      {node}
      {hint && <p className="mt-1 text-[11px] text-slate-600">{hint}</p>}
    </div>
  )

  const ro = (v: string | number | null | undefined) => (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm text-slate-300">
      {v === null || v === undefined || v === '' ? <span className="text-slate-600">—</span> : v}
    </div>
  )

  return (
    <div className="space-y-5">

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          {t('team.profile.readOnly')}
        </div>
      )}

      {/* ── The offer letter ── */}
      <Panel>
        <PanelHeader title={<span className="flex flex-col gap-0.5"><span>{t('team.profile.offerTitle')}</span><span className="text-[11px] font-normal text-slate-500">{t('team.profile.offerSub')}</span></span>} />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {field(t('team.profile.startDate'),
            canEdit
              ? <input type="date" value={draft.start_date} onChange={(e) => set('start_date', e.target.value)} className={fieldClass()} />
              : ro(fmtDate(spine?.startDate)),
            t('team.profile.startDateHint'))}

          {field(t('team.profile.employmentType'),
            canEdit ? (
              <select value={draft.employment_type} onChange={(e) => set('employment_type', e.target.value)} className={fieldClass()}>
                <option value="">{t('team.profile.notSet')}</option>
                {EMPLOYMENT_TYPES.map((v) => <option key={v} value={v}>{t(`team.profile.employment.${v}`)}</option>)}
              </select>
            ) : ro(spine?.employmentType ? t(`team.profile.employment.${spine.employmentType}`) : null))}

          {field(t('team.profile.probationEnd'),
            canEdit
              ? <input type="date" value={draft.probation_end} onChange={(e) => set('probation_end', e.target.value)} className={fieldClass()} />
              : ro(fmtDate(spine?.probationEnd)))}

          {field(t('team.profile.orgTitle'),
            canEdit
              ? <input value={draft.org_title} onChange={(e) => set('org_title', e.target.value)} placeholder={t('team.profile.orgTitlePh')} className={fieldClass()} />
              : ro(spine?.orgTitle))}

          {field(t('team.profile.reraBrn'),
            canEdit
              ? <input value={draft.rera_brn} onChange={(e) => set('rera_brn', e.target.value)} placeholder={t('team.profile.reraBrnPh')} className={fieldClass()} />
              : ro(spine?.reraBrn),
            t('team.profile.reraBrnHint'))}

          {field(t('team.profile.offerRef'),
            canEdit
              ? <input value={draft.offer_ref} onChange={(e) => set('offer_ref', e.target.value)} placeholder={t('team.profile.offerRefPh')} className={fieldClass()} />
              : ro(spine?.offerRef))}
        </div>
      </Panel>

      {/* ── Reporting line ── */}
      <Panel>
        <PanelHeader title={<span className="flex flex-col gap-0.5"><span>{t('team.profile.lineTitle')}</span><span className="text-[11px] font-normal text-slate-500">{t('team.profile.lineSub')}</span></span>} />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {field(t('team.profile.team'),
            canEdit ? (
              <select value={draft.team_id} onChange={(e) => set('team_id', e.target.value)} className={fieldClass()}>
                <option value="">{t('team.profile.noTeam')}</option>
                {teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            ) : ro(spine?.teamName),
            errs.teams ? `${t('team.profile.teamsFailed')} — ${errs.teams}` : undefined)}

          {field(t('team.profile.reportsTo'),
            canEdit ? (
              <select value={draft.reports_to} onChange={(e) => set('reports_to', e.target.value)} className={fieldClass()}>
                <option value="">{t('team.profile.noManager')}</option>
                {roster.filter((m) => m.id !== agentId).map((m) => (
                  <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
                ))}
              </select>
            ) : ro(spine?.reportsToName),
            t('team.profile.reportsToHint'))}
        </div>
      </Panel>

      {/* ── What they're measured against ── */}
      <Panel>
        <PanelHeader title={<span className="flex flex-col gap-0.5"><span>{t('team.profile.targetsTitle')}</span><span className="text-[11px] font-normal text-slate-500">{t('team.profile.targetsSub')}</span></span>} />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          {field(t('team.profile.commission'),
            canEdit
              ? <input type="number" min={0} max={100} step="0.5" value={draft.commission_rate} onChange={(e) => set('commission_rate', e.target.value)} className={fieldClass()} />
              : ro(spine?.commissionRate == null ? null : `${spine.commissionRate}%`))}

          {field(t('team.profile.targetDeals'),
            canEdit
              ? <input type="number" min={0} step="1" value={draft.target_deals_monthly} onChange={(e) => set('target_deals_monthly', e.target.value)} className={fieldClass()} />
              : ro(spine?.targetDealsMonthly))}

          {field(t('team.profile.targetRevenue'),
            canEdit
              ? <input type="number" min={0} step="1000" value={draft.target_revenue_monthly} onChange={(e) => set('target_revenue_monthly', e.target.value)} className={fieldClass()} />
              : ro(spine?.targetRevenueMonthly == null ? null : spine.targetRevenueMonthly.toLocaleString(localeTag)))}
        </div>
        <div className="px-4 pb-4">
          {field(t('team.profile.notes'),
            canEdit
              ? <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('team.profile.notesPh')} className={fieldClass()} />
              : ro(spine?.notes))}
        </div>
        {canEdit && (
          <div className="flex justify-end border-t border-line px-4 py-3">
            <Button onClick={() => void save()} disabled={busy}>
              <Save className="h-4 w-4" /> {busy ? t('team.profile.saving') : t('team.profile.save')}
            </Button>
          </div>
        )}
      </Panel>

      {/* ── What has been done to this account, and by whom ── */}
      <Panel>
        <PanelHeader title={<span className="flex flex-col gap-0.5"><span>{t('team.profile.logTitle')}</span><span className="text-[11px] font-normal text-slate-500">{t('team.profile.logSub')}</span></span>} />
        {errs.log ? (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-amber-200/90">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {errs.log}
          </div>
        ) : log.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
            <ScrollText className="h-4 w-4" /> {t('team.profile.logEmpty')}
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {log.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${row.decision === 'allowed' ? 'bg-emerald-400' : 'bg-red-400'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-slate-200">
                    {t(`team.log.action.${row.action}`)}
                    {row.detail && <span className="text-slate-400"> · {row.detail}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {row.actorEmail} · {t(`team.log.reason.${row.reason}`)} · {fmtDate(row.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
