'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, AlertTriangle, Users, Briefcase, Activity, Coins, ShieldCheck,
  UserCog, CheckCircle2, Lock, ExternalLink, Wallet, Megaphone,
} from 'lucide-react'
import {
  PageHeader, Panel, PanelHeader, Section, EmptyState, StatCard, Button,
  StatusPill, buttonClass, fieldClass,
} from '@/components/freehold/ui'
import { useI18n } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { fmtAed, prettySource } from '@/lib/freehold/analytics-format'
import {
  PERM_GROUPS, PERM_COUNT, permsWithDefaults, deriveTier, TIER_COLOR,
  type Permission,
} from '@/lib/freehold/broker-permissions-ui'
import {
  load, initialsOf, lastActiveLabel, fmtMinutes, ROLE_CHIP, ASSIGNABLE_ROLES,
  type Member, type AgentMetric, type BrokerBalance, type LedgerEntry, type AdAllocation,
} from '../_lib'
import { ProfileTab } from './_profile-tab'

// ─── Wire types ──────────────────────────────────────────────────────────────

type Profile = {
  agent: { id: string; name: string; email: string; phone: string | null; role: string; tenureDays: number | null }
  leadStats: { total: number; new: number; closed: number; hot: number; overdue: number; closingRate: number }
  leads: { id: string; name: string; status: string; priority: string; source: string; budgetAed: number; createdAt: string }[]
  activity: { type: string; description: string | null; leadName: string | null; createdAt: string }[]
  deals: { id: string; leadName: string; projectName: string; status: string; propertyValueAed: number; netCommissionAed: number; receivedAed: number; paymentStatus: string; coAgentName: string | null; createdAt: string }[]
  finance: { totalDeals: number; approvedDeals: number; closedDeals: number; pendingDeals: number; salesVolumeAed: number; commissionAed: number; receivedAed: number; outstandingAed: number }
  ads: { totalCredits: number; totalAed: number; activeCampaigns: number; campaigns: { name: string; creditsSpent: number; status: string; createdAt: string }[] }
}

type TabKey = 'profile' | 'performance' | 'pipeline' | 'credits' | 'permissions' | 'account'

const STAGE_SET = new Set(['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed'])
const PRI_SET = new Set(['priority', 'hot', 'warm', 'cold'])

function statusTone(s: string) {
  if (s === 'closed' || s === 'approved') return 'text-emerald-400 border-emerald-400/25 bg-emerald-400/10'
  if (s === 'lost' || s === 'rejected') return 'text-red-400 border-red-400/25 bg-red-400/10'
  if (s.startsWith('pending')) return 'text-amber-400 border-amber-400/25 bg-amber-400/10'
  return 'text-slate-300 border-line-strong bg-surface-2'
}
function priorityTone(p: string) {
  if (p === 'hot' || p === 'priority') return 'text-red-400'
  if (p === 'warm') return 'text-amber-400'
  return 'text-slate-400'
}
function dqColor(score: number) {
  if (score >= 80) return 'text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.08]'
  if (score >= 50) return 'text-amber-300 border-amber-400/25 bg-amber-400/[0.08]'
  return 'text-red-300 border-red-400/25 bg-red-400/[0.08]'
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {head.map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 ${i === 0 ? 'text-start' : 'text-end'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </Panel>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ? 'text-gold' : 'text-slate-100'}`}>{value}</div>
    </div>
  )
}

function Fail({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamMemberPage() {
  const { t, locale } = useI18n()
  const localeTag = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'
  const params = useParams()
  const agentId = String(params.agentId || '')
  const { user: actor } = useSession()

  const [tab, setTab] = useState<TabKey>('profile')
  const [loaded, setLoaded] = useState(false)

  const [member, setMember] = useState<Member | null>(null)
  // The whole roster, kept for the profile tab's "reports to" picker.
  const [roster, setRoster] = useState<Member[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [metric, setMetric] = useState<AgentMetric | null>(null)
  const [balance, setBalance] = useState<BrokerBalance | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [allocations, setAllocations] = useState<AdAllocation[]>([])
  const [perms, setPerms] = useState<Record<Permission, boolean> | null>(null)
  const [permBusy, setPermBusy] = useState(false)
  const [acctBusy, setAcctBusy] = useState(false)

  const [errs, setErrs] = useState<Partial<Record<'member' | 'profile' | 'metric' | 'credits' | 'ledger' | 'perms', string>>>({})

  const refresh = useCallback(async () => {
    if (!agentId) return
    const [roster, prof, metrics, balances, led, permMap] = await Promise.all([
      load<{ members: Member[] }>('/api/freehold/team'),
      load<Profile>(`/api/freehold/analytics/agent/${agentId}`),
      load<{ agents: AgentMetric[] }>('/api/freehold/analytics/team'),
      load<{ balances: BrokerBalance[] }>('/api/freehold/credits/admin/balances'),
      load<{ ledger: LedgerEntry[]; allocations: AdAllocation[] }>(`/api/freehold/credits/admin/ledger?brokerId=${encodeURIComponent(agentId)}`),
      load<{ perms: Record<string, Record<string, boolean>> }>('/api/freehold/lead-machine/permissions'),
    ])

    const e: typeof errs = {}
    if (roster.ok) {
      const members = roster.data.members ?? []
      setRoster(members)
      setMember(members.find((m) => m.id === agentId) ?? null)
    } else e.member = roster.error
    if (prof.ok) setProfile(prof.data.agent ? prof.data : null); else e.profile = prof.error
    if (metrics.ok) setMetric((metrics.data.agents ?? []).find((a) => a.id === agentId) ?? null); else e.metric = metrics.error
    if (balances.ok) setBalance((balances.data.balances ?? []).find((b) => b.id === agentId) ?? null); else e.credits = balances.error
    if (led.ok) { setLedger(led.data.ledger ?? []); setAllocations(led.data.allocations ?? []) } else e.ledger = led.error
    if (permMap.ok) setPerms(permsWithDefaults(permMap.data.perms?.[agentId])); else e.perms = permMap.error

    setErrs(e)
    setLoaded(true)
  }, [agentId])

  useEffect(() => { void refresh() }, [refresh])

  const fmtDate = useCallback(
    (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(localeTag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }) : '—'),
    [localeTag],
  )

  const name = member?.name ?? profile?.agent.name ?? ''
  const email = member?.email ?? profile?.agent.email ?? ''
  const dbRole = member?.dbRole ?? profile?.agent.role ?? ''
  const isBroker = dbRole === 'broker'

  // ── Account permissions, mirrored from the API's own rules ──
  const actorRole = String(actor?.role ?? '')
  const isSelf = !!actor && !!email && actor.email.toLowerCase() === email.toLowerCase()
  const roleLockReason =
    !['ceo', 'admin'].includes(actorRole) ? t('team.acct.roleLockedActor')
    : isSelf ? t('team.acct.roleLockedSelf')
    : dbRole === 'ceo' && actorRole !== 'ceo' ? t('team.acct.roleLockedCeo')
    : null

  const permCount = useMemo(() => (perms ? Object.values(perms).filter(Boolean).length : 0), [perms])

  // ── Mutations — every one goes through an EXISTING role-gated API ──
  async function savePerms() {
    if (!perms) return
    setPermBusy(true)
    const res = await fetch('/api/freehold/lead-machine/permissions', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerId: agentId, perms }),
    }).catch(() => null)
    setPermBusy(false)
    const body = res ? await res.json().catch(() => null) : null
    if (res?.ok) toast.success(t('team.perm.saved'))
    else toast.error(body?.error || t('team.perm.failed'))
  }

  async function patchMember(patch: Record<string, unknown>, okKey: string, failKey: string) {
    setAcctBusy(true)
    const res = await fetch(`/api/freehold/team/${agentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => null)
    setAcctBusy(false)
    const body = res ? await res.json().catch(() => null) : null
    if (res?.ok) { toast.success(t(okKey)); void refresh() }
    else toast.error(body?.error || t(failKey))
  }

  if (!loaded) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">{t('team.loading')}</div>
  }

  if (!member && !profile) {
    return (
      <div className="space-y-4 p-5 sm:p-6 lg:p-8">
        <Link href="/freehold-intelligence/team" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('team.detail.back')}
        </Link>
        {(errs.member || errs.profile) && <Fail message={errs.member ?? errs.profile ?? ''} />}
        <p className="py-16 text-center text-sm text-slate-500">{t('team.detail.notFound')}</p>
      </div>
    )
  }

  const TABS: Array<[TabKey, string]> = [
    // Profile first: it is the offer-letter spine every other tab hangs off.
    ['profile', 'team.tab.profile'],
    ['performance', 'team.tab.performance'],
    ['pipeline', 'team.tab.pipeline'],
    ['credits', 'team.tab.credits'],
    ['permissions', 'team.tab.permissions'],
    ['account', 'team.tab.account'],
  ]

  return (
    <div className="space-y-6 p-5 sm:p-6 lg:p-8">

      <Link href="/freehold-intelligence/team" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('team.detail.back')}
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-slate-200">
              {member?.initials ?? initialsOf(name)}
            </span>
            {name}
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_CHIP[dbRole] ?? ROLE_CHIP.broker}`}>
              {t(`role.${dbRole}`)}
            </span>
            {member && member.status !== 'active' && (
              <StatusPill tone="red">{t(`team.status.${member.status}`)}</StatusPill>
            )}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{email}</span>
            {profile?.agent.phone && <span>· {profile.agent.phone}</span>}
            {profile?.agent.tenureDays != null && <span>· {t('team.detail.tenure', { n: profile.agent.tenureDays })}</span>}
            <span>· {t('team.acct.lastActive')}: {lastActiveLabel(member?.lastActive ?? null, t)}</span>
          </span>
        }
      />

      {/* Tabs — the segmented-pill idiom used on the Pixel page */}
      <div className="flex flex-wrap gap-1 rounded-[14px] border border-line bg-surface-2/60 p-1">
        {TABS.map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === key ? 'bg-gold/15 text-gold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── Profile — the offer-letter spine ─────────────────────────────── */}
      {tab === 'profile' && (
        <ProfileTab
          agentId={agentId}
          roster={roster}
          // Editing employment terms is management's call. A team leader sees
          // the person they lead in full, and changes none of it — the same
          // split the rest of this system uses: run the work, don't run the
          // contract.
          canEdit={['ceo', 'admin', 'director', 'sales_manager'].includes(actorRole)}
        />
      )}

      {/* ── Performance ──────────────────────────────────────────────────── */}
      {tab === 'performance' && (
        <div className="space-y-6">
          {errs.profile && <Fail message={errs.profile} />}

          {profile && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi label={t('team.perf.kpi.leads')} value={profile.leadStats.total.toLocaleString('en-US')} />
              <Kpi label={t('team.perf.kpi.closing')} value={`${profile.leadStats.closingRate}%`} />
              <Kpi label={t('team.perf.kpi.overdue')} value={profile.leadStats.overdue.toLocaleString('en-US')} />
              <Kpi label={t('team.perf.kpi.deals')} value={`${profile.finance.approvedDeals}/${profile.finance.totalDeals}`} />
              <Kpi label={t('team.perf.kpi.salesVolume')} value={fmtAed(profile.finance.salesVolumeAed)} />
              <Kpi label={t('team.perf.kpi.commission')} value={fmtAed(profile.finance.commissionAed)} accent />
              <Kpi label={t('team.perf.kpi.outstanding')} value={fmtAed(profile.finance.outstandingAed)} />
              <Kpi label={t('team.perf.kpi.adSpend')} value={fmtAed(profile.ads.totalAed)} />
            </div>
          )}

          {/* Effort + response clock — gatherTeamMetrics */}
          <Section title={t('team.perf.sec.effort')}>
            {errs.metric ? <Fail message={errs.metric} /> : metric ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label={t('team.perf.effort.calls')} value={metric.calls.toLocaleString('en-US')} />
                <StatCard label={t('team.perf.effort.messages')} value={metric.messages.toLocaleString('en-US')} />
                <StatCard label={t('team.perf.effort.notes')} value={metric.notes.toLocaleString('en-US')} />
                <StatCard
                  label={t('team.perf.effort.total')}
                  value={metric.activity30d.toLocaleString('en-US')}
                  hint={metric.tenureDays != null ? `${t('team.perf.tenure')}: ${t('team.perf.tenureDays', { n: metric.tenureDays })}` : undefined}
                />
              </div>
            ) : (
              <EmptyState Icon={Activity} title={t('team.perf.noMetrics')} />
            )}
          </Section>

          {metric && (
            <Section title={t('team.perf.sec.quality')}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {/* Every cell is shown only when its evidence exists — a dash
                    means "not tracked yet", never a defaulted zero. */}
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('team.perf.medianResponse')}</div>
                  {metric.medianResponseMinutes !== null ? (
                    <>
                      <div className="mt-2 text-xl font-semibold tabular-nums text-slate-100">{fmtMinutes(metric.medianResponseMinutes)}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{t('team.perf.responseEvidence', { responded: metric.respondedLeads, leads: metric.totalLeads })}</div>
                    </>
                  ) : (
                    <div className="mt-2 text-xl text-slate-600" title={t('team.perf.noResponses')}>—</div>
                  )}
                </div>
                {([
                  ['team.perf.viewingRate', metric.viewingsHeld, 'team.perf.viewingEvidence', 'team.perf.noViewings', 'held'],
                  ['team.perf.offerRate', metric.offersMade, 'team.perf.offerEvidence', 'team.perf.noOffers', 'offers'],
                ] as const).map(([labelKey, count, evidenceKey, noneKey, varName]) => {
                  const rate = count > 0 && metric.totalLeads > 0 ? Math.round((count / metric.totalLeads) * 100) : null
                  return (
                    <div key={labelKey} className="rounded-xl border border-line bg-surface p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t(labelKey)}</div>
                      {rate !== null ? (
                        <>
                          <div className="mt-2 text-xl font-semibold tabular-nums text-slate-100">{rate}%</div>
                          <div className="mt-1 text-[11px] text-slate-500">{t(evidenceKey, { [varName]: count, leads: metric.totalLeads })}</div>
                        </>
                      ) : (
                        <div className="mt-2 text-xl text-slate-600" title={t(noneKey)}>—</div>
                      )}
                    </div>
                  )
                })}
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('team.perf.dataQuality')}</div>
                  {metric.dataQualityScore !== null ? (
                    <>
                      <div className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums ${dqColor(metric.dataQualityScore)}`}>
                        {metric.dataQualityScore}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{t('team.perf.dqEvidence', { marks: metric.dataQualityMarks })}</div>
                    </>
                  ) : (
                    <div className="mt-2 text-xl text-slate-600" title={t('team.perf.noDq')}>—</div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Deals & commission */}
          <Section title={t('team.perf.sec.deals')}>
            {profile && profile.deals.length > 0 ? (
              <Table head={[t('team.perf.col.client'), t('team.perf.col.project'), t('team.perf.col.value'), t('team.perf.col.commission'), t('common.status')]}>
                {profile.deals.map((d) => (
                  <tr key={d.id} className="transition hover:bg-surface-2">
                    <td className="px-4 py-2.5 font-medium text-slate-200">
                      {d.leadName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-end text-slate-400">{d.projectName || '—'}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-slate-300">{fmtAed(d.propertyValueAed)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-gold">{fmtAed(d.netCommissionAed)}</td>
                    <td className="px-4 py-2.5 text-end">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs capitalize ${statusTone(String(d.status))}`}>
                        {String(d.status).replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState Icon={Briefcase} title={t('team.perf.noDeals')} />
            )}
          </Section>

          {/* Recent activity */}
          <Section title={t('team.perf.sec.activity')}>
            {profile && profile.activity.length > 0 ? (
              <Panel>
                <ul className="divide-y divide-line">
                  {profile.activity.slice(0, 20).map((a, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-200">
                          <span className="font-medium capitalize">{String(a.type || '').replace(/_/g, ' ')}</span>
                          {a.leadName && <span className="text-slate-400"> · {a.leadName}</span>}
                        </div>
                        {a.description && <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{a.description}</div>}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : (
              <EmptyState Icon={Activity} title={t('team.perf.noActivity')} />
            )}
          </Section>
        </div>
      )}

      {/* ── Pipeline ─────────────────────────────────────────────────────── */}
      {tab === 'pipeline' && (
        <div className="space-y-6">
          {errs.profile && <Fail message={errs.profile} />}
          {profile && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard label={t('team.pipe.total')} value={profile.leadStats.total.toLocaleString('en-US')} Icon={Users} />
                <StatCard label={t('team.pipe.new')} value={profile.leadStats.new.toLocaleString('en-US')} />
                <StatCard label={t('team.pipe.hot')} value={profile.leadStats.hot.toLocaleString('en-US')} />
                <StatCard
                  label={t('team.pipe.overdue')}
                  value={profile.leadStats.overdue.toLocaleString('en-US')}
                  className={profile.leadStats.overdue > 0 ? 'border-amber-400/25' : ''}
                />
                <StatCard label={t('team.pipe.closed')} value={profile.leadStats.closed.toLocaleString('en-US')} />
              </div>

              <Section
                title={t('team.pipe.recent')}
                action={
                  <Link href="/freehold-intelligence/crm/leads" className={buttonClass('secondary', 'sm')}>
                    <ExternalLink className="h-3.5 w-3.5" /> {t('team.pipe.allLeads')}
                  </Link>
                }
              >
                {profile.leads.length > 0 ? (
                  <Table head={[t('team.pipe.col.lead'), t('common.status'), t('team.pipe.col.priority'), t('team.pipe.col.source'), t('team.pipe.col.budget'), t('team.pipe.col.created')]}>
                    {profile.leads.map((l) => (
                      <tr key={l.id} className="transition hover:bg-surface-2">
                        <td className="px-4 py-2.5">
                          <Link href={`/freehold-intelligence/crm/leads/${l.id}`} className="font-medium text-slate-200 transition-colors hover:text-gold">
                            {l.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs capitalize ${statusTone(l.status)}`}>
                            {STAGE_SET.has(l.status) ? t(`analytics.stage.${l.status}`) : l.status}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-end capitalize ${priorityTone(l.priority)}`}>
                          {PRI_SET.has(l.priority) ? t(`analytics.agent.pri.${l.priority}`) : l.priority}
                        </td>
                        <td className="px-4 py-2.5 text-end text-slate-400">{prettySource(l.source)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-slate-300">{l.budgetAed > 0 ? fmtAed(l.budgetAed) : '—'}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-slate-500">{fmtDate(l.createdAt)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <EmptyState Icon={Users} title={t('team.pipe.none')} />
                )}
              </Section>
            </>
          )}
        </div>
      )}

      {/* ── Credits ──────────────────────────────────────────────────────── */}
      {tab === 'credits' && (
        <div className="space-y-6">
          {errs.credits && <Fail message={t('team.credits.err')} />}
          {errs.ledger && <Fail message={errs.ledger} />}

          {!isBroker && !balance ? (
            <EmptyState Icon={Coins} title={t('team.credits.notBroker')} />
          ) : (
            <>
              {balance ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <StatCard label={t('team.credits.balance')} value={balance.balance.toLocaleString('en-US')} Icon={Wallet} />
                  <StatCard label={t('team.credits.allocated')} value={balance.allocated.toLocaleString('en-US')} />
                  <StatCard label={t('team.credits.spent')} value={balance.total_spent.toLocaleString('en-US')} />
                  <StatCard label={t('team.credits.earned')} value={balance.earned.toLocaleString('en-US')} />
                  <StatCard
                    label={t('team.credits.tier')}
                    value={balance.tier}
                    hint={balance.cycle_end ? t('team.credits.cycleEnd', { date: fmtDate(balance.cycle_end) }) : undefined}
                  />
                </div>
              ) : !errs.credits ? (
                <EmptyState Icon={Coins} title={t('team.credits.none')} />
              ) : null}

              {/* Mutations live in Finance → Credits. This is a link, not a copy. */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3">
                <span className="flex items-start gap-2 text-xs text-slate-300">
                  <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  {t('team.credits.manage')}
                </span>
                <Link href="/freehold-intelligence/finance/credits" className={buttonClass('gold-soft', 'sm')}>
                  {t('team.credits.manageLink')} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <Section title={t('team.credits.ledger')}>
                {ledger.length > 0 ? (
                  <Table head={[t('team.credits.col.type'), t('team.credits.col.amount'), t('team.credits.col.note'), t('team.credits.col.when')]}>
                    {ledger.slice(0, 50).map((e) => (
                      <tr key={e.id} className="transition hover:bg-surface-2">
                        <td className="px-4 py-2.5 text-slate-200">{t(`team.credits.type.${e.type}`)}</td>
                        <td className={`px-4 py-2.5 text-end tabular-nums ${e.type === 'spend' ? 'text-red-300' : 'text-emerald-300'}`}>
                          {e.type === 'spend' ? '−' : '+'}{e.amount.toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-2.5 text-end text-xs text-slate-400">{e.note || '—'}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-xs text-slate-500">{fmtDate(e.created_at)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <EmptyState Icon={Coins} title={t('team.credits.noLedger')} />
                )}
              </Section>

              {allocations.length > 0 && (
                <Section title={t('team.credits.campaigns')}>
                  <Table head={[t('team.credits.col.campaign'), t('team.credits.col.amount'), t('common.status'), t('team.credits.col.when')]}>
                    {allocations.slice(0, 30).map((a) => (
                      <tr key={a.id} className="transition hover:bg-surface-2">
                        <td className="px-4 py-2.5 font-medium text-slate-200">{a.campaign_name || '—'}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-slate-300">{a.credits_spent.toLocaleString('en-US')}</td>
                        <td className="px-4 py-2.5 text-end capitalize text-slate-400">{a.status}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-xs text-slate-500">{fmtDate(a.created_at)}</td>
                      </tr>
                    ))}
                  </Table>
                </Section>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Permissions ──────────────────────────────────────────────────── */}
      {tab === 'permissions' && (
        <div className="space-y-4">
          {errs.perms && <Fail message={t('team.perm.err')} />}
          {!isBroker ? (
            <EmptyState Icon={ShieldCheck} title={t('team.perm.notBroker')} />
          ) : perms ? (
            <Panel>
              <PanelHeader
                title={t('team.perm.title')}
                icon={<Megaphone className="h-4 w-4 text-slate-400" />}
                action={
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TIER_COLOR[deriveTier(permCount)]}`}>
                      {deriveTier(permCount)}
                    </span>
                    <span className="text-xs text-slate-500">{t('team.perm.count', { n: permCount, total: PERM_COUNT })}</span>
                  </span>
                }
              />
              <div className="space-y-5 px-5 py-4">
                <p className="text-xs text-slate-500">{t('team.perm.desc')}</p>
                {PERM_GROUPS.map((group) => (
                  <div key={group.groupKey}>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t(group.groupKey)}</div>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const on = perms[item.id]
                        return (
                          <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 transition hover:border-white/10">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setPerms((p) => (p ? { ...p, [item.id]: !p[item.id] } : p))}
                              className="sr-only"
                            />
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${on ? 'border-gold/60 bg-gold/20' : 'border-white/[0.10]'}`}>
                              {on ? <CheckCircle2 className="h-3.5 w-3.5 text-gold" /> : <Lock className="h-3 w-3 text-slate-600" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm font-medium ${on ? 'text-white' : 'text-slate-500'}`}>{t(item.labelKey)}</span>
                              <span className="block text-xs text-slate-600">{t(item.descKey)}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <Button variant="primary" size="sm" Icon={ShieldCheck} onClick={() => void savePerms()} disabled={permBusy}>
                  {t('team.perm.save')}
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>
      )}

      {/* ── Account ──────────────────────────────────────────────────────── */}
      {tab === 'account' && (
        <div className="space-y-4">
          {errs.member && <Fail message={errs.member} />}
          {member && (
            <Panel>
              <PanelHeader title={t('team.acct.title')} icon={<UserCog className="h-4 w-4 text-slate-400" />} />
              <div className="space-y-5 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: t('team.acct.email'), value: member.email },
                    { label: t('team.acct.phone'), value: member.phone || '—' },
                    { label: t('team.acct.joined'), value: member.joinedAt ? fmtDate(member.joinedAt) : '—' },
                    { label: t('team.acct.lastActive'), value: lastActiveLabel(member.lastActive, t) },
                  ].map((f) => (
                    <div key={f.label} className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{f.label}</div>
                      <div className="mt-1 truncate text-sm text-slate-200">{f.value}</div>
                    </div>
                  ))}
                </div>

                {/* Role — PATCH /api/freehold/team/[id], which enforces
                    CEO/Admin-only and refuses self-escalation server-side. The
                    UI mirrors those rules so the reason is visible up front. */}
                <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('team.acct.role')}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <select
                      value={member.dbRole}
                      disabled={!!roleLockReason || acctBusy}
                      onChange={(e) => void patchMember({ role: e.target.value }, 'team.acct.roleSaved', 'team.acct.roleFailed')}
                      className={fieldClass('md', 'max-w-[220px] disabled:opacity-50')}
                      aria-label={t('team.acct.changeRole')}
                    >
                      {(member.dbRole === 'ceo' ? ['ceo', ...ASSIGNABLE_ROLES] : [...ASSIGNABLE_ROLES]).map((r) => (
                        <option key={r} value={r}>{t(`role.${r}`)}</option>
                      ))}
                    </select>
                    {roleLockReason && <span className="text-xs text-slate-500">{roleLockReason}</span>}
                  </div>
                </div>

                {/* Status — the same PATCH, suspended flag */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('team.acct.status')}</div>
                    <div className="mt-1">
                      <StatusPill tone={member.status === 'active' ? 'green' : 'red'} dot>
                        {t(`team.status.${member.status}`)}
                      </StatusPill>
                    </div>
                  </div>
                  {!isSelf && (
                    <Button
                      variant={member.suspended ? 'secondary' : 'danger'}
                      size="sm"
                      disabled={acctBusy}
                      onClick={() => void patchMember({ suspended: !member.suspended }, 'team.acct.statusSaved', 'team.acct.statusFailed')}
                    >
                      {member.suspended ? t('team.acct.reactivate') : t('team.acct.suspend')}
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}
