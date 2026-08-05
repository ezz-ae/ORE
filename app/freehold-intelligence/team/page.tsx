'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  UsersRound, UserPlus, Search, AlertTriangle, ArrowUp, ArrowDown,
  Activity, Flame, Clock, Wallet,
} from 'lucide-react'
import {
  PageHeader, StatCard, Panel, EmptyState, SegmentPill, Button, Modal,
  buttonClass, fieldClass,
} from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { fmtAed } from '@/lib/freehold/analytics-format'
import {
  load, dealRollup, conversionPct, lastActiveLabel, activeThisWeek,
  ROLE_CHIP, TEAM_ROLES, ASSIGNABLE_ROLES,
  type Member, type AgentMetric, type BrokerBalance, type TeamDeal,
} from './_lib'

// ─── Sorting ─────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'leads' | 'hot' | 'overdue' | 'closed' | 'revenue' | 'credits' | 'lastActive'

type Row = {
  m: Member
  /** gatherTeamMetrics row — only brokers have one. */
  metric: AgentMetric | null
  balance: BrokerBalance | null
  deals: { closed: number; revenueAed: number } | null
}

/** A sortable value, or null when this row genuinely has no value. Nulls always
 *  sort last, in both directions — a dash is not "the smallest number". */
function sortValue(r: Row, key: SortKey): number | string | null {
  switch (key) {
    case 'name':       return r.m.name.toLowerCase()
    case 'leads':      return r.metric?.totalLeads ?? null
    case 'hot':        return r.metric?.hotLeads ?? null
    case 'overdue':    return r.metric?.overdueFollowups ?? null
    case 'closed':     return r.deals?.closed ?? null
    case 'revenue':    return r.deals?.revenueAed ?? null
    case 'credits':    return r.balance?.balance ?? null
    case 'lastActive': return r.m.lastActive ? Date.parse(r.m.lastActive) : null
  }
}

// ─── Cells ───────────────────────────────────────────────────────────────────

/**
 * A number that refuses to lie: when its source failed or the row has no such
 * value, it renders a dash carrying the reason — never a confident 0.
 */
function Num({
  value, title, className = '', format,
}: {
  value: number | null
  title: string
  className?: string
  format?: (n: number) => string
}) {
  if (value === null) return <span className="text-slate-600" title={title}>—</span>
  return (
    <span className={`tabular-nums ${className}`} title={title}>
      {format ? format(value) : value.toLocaleString('en-US')}
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamRosterPage() {
  const t = useT()

  const [members, setMembers] = useState<Member[]>([])
  const [metrics, setMetrics] = useState<AgentMetric[]>([])
  const [balances, setBalances] = useState<BrokerBalance[]>([])
  const [deals, setDeals] = useState<TeamDeal[]>([])
  const [openPipeline, setOpenPipeline] = useState<number | null>(null)
  const [errors, setErrors] = useState<Partial<Record<'roster' | 'metrics' | 'credits' | 'deals' | 'pipeline', string>>>({})
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [role, setRole] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('leads')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('broker')
  const [inviteBusy, setInviteBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [roster, teamMetrics, credits, dealList, leadStages] = await Promise.all([
      load<{ members: Member[] }>('/api/freehold/team'),
      load<{ agents: AgentMetric[] }>('/api/freehold/analytics/team'),
      load<{ balances: BrokerBalance[] }>('/api/freehold/credits/admin/balances'),
      load<{ deals: TeamDeal[] }>('/api/freehold/deals'),
      load<{ stages: { stage: string; count: number }[] }>('/api/freehold/analytics/leads'),
    ])

    const errs: typeof errors = {}
    if (roster.ok) setMembers(roster.data.members ?? []); else errs.roster = roster.error
    if (teamMetrics.ok) setMetrics(teamMetrics.data.agents ?? []); else errs.metrics = teamMetrics.error
    if (credits.ok) setBalances(credits.data.balances ?? []); else errs.credits = credits.error
    if (dealList.ok) setDeals(dealList.data.deals ?? []); else errs.deals = dealList.error
    if (leadStages.ok) {
      const closedish = new Set(['closed', 'converted', 'lost'])
      setOpenPipeline(
        (leadStages.data.stages ?? []).filter((s) => !closedish.has(s.stage)).reduce((n, s) => n + s.count, 0),
      )
    } else {
      errs.pipeline = leadStages.error
      setOpenPipeline(null)
    }
    setErrors(errs)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // ── Build one row per team member ──
  const rows: Row[] = useMemo(() => {
    const metricById = new Map(metrics.map((a) => [a.id, a]))
    const balanceById = new Map(balances.map((b) => [b.id, b]))
    return members.map((m) => ({
      m,
      metric: metricById.get(m.id) ?? null,
      balance: balanceById.get(m.id) ?? null,
      deals: errors.deals ? null : dealRollup(deals, m),
    }))
  }, [members, metrics, balances, deals, errors.deals])

  const rolesPresent = useMemo(
    () => TEAM_ROLES.filter((r) => members.some((m) => m.dbRole === r)),
    [members],
  )

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (role !== 'all' && r.m.dbRole !== role) return false
      if (!needle) return true
      return r.m.name.toLowerCase().includes(needle) || r.m.email.toLowerCase().includes(needle)
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av === null && bv === null) return 0
      if (av === null) return 1          // missing values always last
      if (bv === null) return -1
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * dir
      }
      return (av - bv) * dir
    })
  }, [rows, q, role, sortKey, sortDir])

  // ── Status strip (every figure derived from a real read) ──
  const brokerCount = members.filter((m) => m.dbRole === 'broker').length
  const activeCount = members.filter((m) => activeThisWeek(m.lastActive)).length
  const overdueTotal = errors.metrics ? null : metrics.reduce((n, a) => n + a.overdueFollowups, 0)

  const failed = ([
    ['roster', 'team.err.roster'], ['metrics', 'team.err.metrics'],
    ['credits', 'team.err.credits'], ['deals', 'team.err.deals'],
    ['pipeline', 'team.err.pipeline'],
  ] as const).filter(([k]) => errors[k])

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  // Invite goes through the EXISTING management-only POST — no new write path.
  async function invite() {
    const name = inviteName.trim()
    const email = inviteEmail.trim()
    if (!name || !email) { toast.error(t('team.invite.needFields')); return }
    setInviteBusy(true)
    const res = await fetch('/api/freehold/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role: inviteRole }),
    }).catch(() => null)
    setInviteBusy(false)
    const body = res ? await res.json().catch(() => null) : null
    if (res?.ok) {
      toast.success(t('team.invite.ok', { email }))
      setInviteOpen(false); setInviteName(''); setInviteEmail(''); setInviteRole('broker')
      void refresh()
    } else {
      toast.error(body?.error || t('team.invite.failed'))
    }
  }

  const SortHead = ({ label, k, align = 'end' }: { label: string; k: SortKey; align?: 'start' | 'end' }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
        sortKey === k ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300'
      } ${align === 'end' ? 'justify-end' : 'justify-start'}`}
    >
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  )

  const COLS = 'grid-cols-[minmax(200px,2.2fr)_minmax(150px,1fr)_minmax(170px,1.1fr)_100px_110px]'

  return (
    <div className="space-y-6 p-5 sm:p-6 lg:p-8">

      <PageHeader
        Icon={UsersRound}
        eyebrow={t('team.eyebrow')}
        title={t('team.title')}
        subtitle={t('team.subtitle')}
        actions={
          <Button variant="primary" size="sm" Icon={UserPlus} onClick={() => setInviteOpen(true)}>
            {t('team.invite')}
          </Button>
        }
      />

      {/* Honest failure notice — names the sources that did not answer. */}
      {failed.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">{t('team.err.title')}</div>
            <div>{t('team.err.body', { sources: failed.map(([, k]) => t(k)).join(', ') })}</div>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-200/80">
              {failed.map(([k, labelKey]) => (
                <li key={k}>{t(labelKey)}: {errors[k]}</li>
              ))}
            </ul>
            <button type="button" onClick={() => void refresh()} className="mt-2 text-xs font-semibold underline underline-offset-2">
              {t('team.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Status strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label={t('team.stat.members')}
          value={errors.roster ? '—' : members.length.toLocaleString('en-US')}
          hint={errors.roster ? errors.roster : t('team.stat.membersHint', { n: brokerCount })}
          Icon={UsersRound}
        />
        <StatCard
          label={t('team.stat.active')}
          value={errors.roster ? '—' : activeCount.toLocaleString('en-US')}
          hint={errors.roster ? errors.roster : t('team.stat.activeHint')}
          Icon={Activity}
        />
        <StatCard
          label={t('team.stat.pipeline')}
          value={openPipeline === null ? '—' : openPipeline.toLocaleString('en-US')}
          hint={openPipeline === null ? (errors.pipeline ?? t('team.noValue')) : t('team.stat.pipelineHint')}
          Icon={Flame}
        />
        <StatCard
          label={t('team.stat.overdue')}
          value={overdueTotal === null ? '—' : overdueTotal.toLocaleString('en-US')}
          hint={overdueTotal === null ? (errors.metrics ?? t('team.noValue')) : t('team.stat.overdueHint')}
          Icon={Clock}
          className={overdueTotal !== null && overdueTotal > 0 ? 'border-amber-400/25' : ''}
        />
      </div>

      {/* Search + role filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('team.search')}
            className={fieldClass('md', 'ps-9')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SegmentPill selected={role === 'all'} onClick={() => setRole('all')}>{t('team.filter.allRoles')}</SegmentPill>
          {rolesPresent.map((r) => (
            <SegmentPill key={r} selected={role === r} onClick={() => setRole(r)}>{t(`role.${r}`)}</SegmentPill>
          ))}
        </div>
        <span className="text-xs text-slate-500">{t('team.count', { shown: visible.length, total: rows.length })}</span>
      </div>

      {/* Roster */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">{t('team.loading')}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          Icon={UsersRound}
          title={t('team.emptyRoster.title')}
          description={t('team.emptyRoster.desc')}
          action={<Button variant="primary" size="sm" Icon={UserPlus} onClick={() => setInviteOpen(true)}>{t('team.invite')}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState Icon={Search} title={t('team.empty.title')} description={t('team.empty.desc')} />
      ) : (
        <Panel>
          {/* Header (desktop) */}
          <div className={`hidden md:grid ${COLS} items-center gap-3 border-b border-line px-5 py-2.5`}>
            <SortHead label={t('team.col.agent')} k="name" align="start" />
            <SortHead label={t('team.col.pipeline')} k="leads" />
            <SortHead label={t('team.col.performance')} k="revenue" />
            <SortHead label={t('team.col.credits')} k="credits" />
            <SortHead label={t('team.col.lastActive')} k="lastActive" />
          </div>

          <div className="divide-y divide-line">
            {visible.map((r) => {
              const { m, metric, balance } = r
              const conv = metric ? conversionPct(metric) : null
              const metricTitle = errors.metrics ? errors.metrics : m.dbRole === 'broker' ? t('team.noValue') : t('team.na')
              const creditTitle = errors.credits ? errors.credits : m.dbRole === 'broker' ? t('team.noValue') : t('team.na')
              const dealTitle = errors.deals ? errors.deals : t('team.noValue')
              const overdue = metric?.overdueFollowups ?? null

              return (
                <Link
                  key={m.id}
                  href={`/freehold-intelligence/team/${m.id}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  {/* Desktop row */}
                  <div className={`hidden md:grid ${COLS} items-center gap-3`}>
                    {/* Agent */}
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-slate-300">
                        {m.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-100">{m.name}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_CHIP[m.dbRole] ?? ROLE_CHIP.broker}`}>
                            {t(`role.${m.dbRole}`)}
                          </span>
                          {m.status !== 'active' && (
                            <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                              {t(`team.status.${m.status}`)}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-500">{m.email}</div>
                      </div>
                    </div>

                    {/* Pipeline: leads · hot · overdue */}
                    <div className="flex items-center justify-end gap-3 text-sm">
                      <Num value={metric?.totalLeads ?? null} title={metric ? t('team.cell.leadsHint', { n: metric.totalLeads }) : metricTitle} className="text-slate-200" />
                      <span className="text-slate-700">·</span>
                      <Num value={metric?.hotLeads ?? null} title={metric ? t('team.cell.hotHint', { n: metric.hotLeads }) : metricTitle} className="text-red-300" />
                      <span className="text-slate-700">·</span>
                      <Num
                        value={overdue}
                        title={metric ? t('team.cell.overdueHint', { n: metric.overdueFollowups }) : metricTitle}
                        className={overdue && overdue > 0 ? (overdue >= 5 ? 'font-semibold text-red-400' : 'font-semibold text-amber-400') : 'text-slate-400'}
                      />
                    </div>

                    {/* Performance: closed · revenue · conversion */}
                    <div className="flex items-center justify-end gap-3 text-sm">
                      <Num value={r.deals?.closed ?? null} title={r.deals ? t('team.cell.closedHint', { n: r.deals.closed }) : dealTitle} className="text-emerald-300" />
                      <span className="text-slate-700">·</span>
                      <Num value={r.deals?.revenueAed ?? null} title={t('team.cell.revenueHint')} className="text-slate-200" format={fmtAed} />
                      <span className="text-slate-700">·</span>
                      <Num value={conv} title={metric ? t('team.cell.convHint') : metricTitle} className={conv !== null && conv >= 30 ? 'text-emerald-300' : 'text-slate-400'} format={(n) => `${n}%`} />
                    </div>

                    {/* Credits */}
                    <div className="text-end text-sm">
                      <Num
                        value={balance?.balance ?? null}
                        title={balance ? t('team.cell.creditsHint', { tier: balance.tier, allocated: balance.allocated, spent: balance.total_spent }) : creditTitle}
                        className="text-slate-200"
                      />
                    </div>

                    {/* Last active */}
                    <div className="text-end text-xs text-slate-500">{lastActiveLabel(m.lastActive, t)}</div>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-slate-300">
                        {m.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-100">{m.name}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_CHIP[m.dbRole] ?? ROLE_CHIP.broker}`}>
                            {t(`role.${m.dbRole}`)}
                          </span>
                          <span className="text-xs text-slate-500">{lastActiveLabel(m.lastActive, t)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: t('team.col.leads'),   node: <Num value={metric?.totalLeads ?? null} title={metricTitle} className="text-slate-200" /> },
                        { label: t('team.col.overdue'), node: <Num value={overdue} title={metricTitle} className={overdue && overdue > 0 ? 'text-amber-400' : 'text-slate-300'} /> },
                        { label: t('team.col.closed'),  node: <Num value={r.deals?.closed ?? null} title={dealTitle} className="text-emerald-300" /> },
                        { label: t('team.col.credits'), node: <Num value={balance?.balance ?? null} title={creditTitle} className="text-slate-200" /> },
                      ].map((c) => (
                        <div key={c.label} className="rounded-lg bg-surface-2 py-2">
                          <div className="text-sm font-semibold">{c.node}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Invite — the existing management-only POST /api/freehold/team */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t('team.invite.title')}
        subtitle={t('team.invite.subtitle')}
        maxWidth="max-w-lg"
        footer={
          <>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setInviteOpen(false)}>
              {t('team.invite.cancel')}
            </button>
            <Button variant="primary" size="sm" Icon={UserPlus} onClick={() => void invite()} disabled={inviteBusy}>
              {t('team.invite.send')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('team.invite.name')}</span>
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder={t('team.invite.namePh')} className={fieldClass()} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('team.invite.email')}</span>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t('team.invite.emailPh')} className={fieldClass()} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('team.invite.role')}</span>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={fieldClass()}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{t(`role.${r}`)}</option>
              ))}
            </select>
          </label>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
            {t('team.credits.manage')}
          </p>
        </div>
      </Modal>
    </div>
  )
}
