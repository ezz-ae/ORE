/**
 * Shared wire types + read helpers for the Team app.
 *
 * Every number on these screens comes from an EXISTING role-gated API — this
 * file only names their shapes and gives one honest way to read them:
 * `load()` never collapses "the read failed" into "the value is zero", which is
 * how a broken query used to render as a confident 0 on a performance screen.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export async function load<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body?.error) msg = body.error
      } catch { /* non-JSON error body — the status is the message */ }
      return { ok: false, error: msg }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

/** GET /api/freehold/team → members */
export type Member = {
  id: string
  name: string
  email: string
  role: string
  dbRole: string
  status: 'active' | 'suspended' | 'banned'
  suspended: boolean
  banned: boolean
  phone: string | null
  joinedAt: string
  lastActive: string | null
  initials: string
}

/** GET /api/freehold/analytics/team → agents (gatherTeamMetrics) */
export type AgentMetric = {
  id: string
  name: string
  tenureDays: number | null
  totalLeads: number
  hotLeads: number
  wins30d: number
  overdueFollowups: number
  activity30d: number
  calls: number
  messages: number
  notes: number
  medianResponseMinutes: number | null
  respondedLeads: number
  viewingsHeld: number
  viewingsScheduled: number
  offersMade: number
  dataQualityScore: number | null
  dataQualityMarks: number
}

/** GET /api/freehold/credits/admin/balances → balances (listBrokerBalances) */
export type BrokerBalance = {
  id: string
  name: string
  email: string
  tier: string
  allocated: number
  total_spent: number
  balance: number
  earned: number
  cycle_end: string | null
}

/** GET /api/freehold/credits/admin/ledger?brokerId= (getBrokerCreditDetail) */
export type LedgerEntry = {
  id: string
  type: 'allocation' | 'spend' | 'refund' | 'adjustment' | 'earn'
  amount: number
  note: string | null
  created_by: string | null
  created_at: string
}
export type AdAllocation = {
  id: string
  campaign_name: string | null
  credits_allocated: number
  credits_spent: number
  status: string
  created_at: string
}

/** GET /api/freehold/deals → deals (listDeals) — only the fields Team reads. */
export type TeamDeal = {
  id: string
  agentId: string
  agentName: string
  coAgentId: string
  coAgentName: string
  status: string
  netCommissionAed: number
  propertyValueAed: number
}

/** Deals count as money once they are approved — the same rule the agent
 *  analytics endpoint applies, so the two screens can never disagree. */
const EARNED_STATUSES = new Set(['approved', 'closed'])

/** A member's deal rollup, matched across every identity a deal may be booked
 *  under (user id or login email, as agent or co-agent). */
export function dealRollup(deals: TeamDeal[], m: { id: string; email: string; name: string }) {
  const keys = new Set([m.id, m.email].filter(Boolean))
  let closed = 0
  let revenueAed = 0
  for (const d of deals) {
    const mine =
      keys.has(d.agentId) || keys.has(d.coAgentId) ||
      (!!m.name && (d.agentName === m.name || d.coAgentName === m.name))
    if (!mine) continue
    if (EARNED_STATUSES.has(String(d.status))) {
      closed++
      revenueAed += Number(d.netCommissionAed) || 0
    }
  }
  return { closed, revenueAed }
}

/** Conversion — wins in the last 30 days over leads assigned (the formula the
 *  Analytics team comparison already uses). Null when there are no leads, so
 *  the cell shows a dash instead of a meaningless 0%. */
export function conversionPct(a: AgentMetric): number | null {
  return a.totalLeads > 0 ? Math.round((a.wins30d / a.totalLeads) * 100) : null
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** Relative "last active", honest about never having signed in. */
export function lastActiveLabel(iso: string | null, t: TFn): string {
  if (!iso) return t('team.never')
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return t('team.never')
  const hours = (Date.now() - ms) / 3_600_000
  if (hours < 1) return t('team.rel.min', { n: Math.max(1, Math.round(hours * 60)) })
  if (hours < 24) return t('team.rel.hour', { n: Math.round(hours) })
  return t('team.rel.day', { n: Math.max(1, Math.round(hours / 24)) })
}

/** Signed in within the last 7 days. */
export function activeThisWeek(iso: string | null): boolean {
  if (!iso) return false
  const ms = Date.parse(iso)
  return !Number.isNaN(ms) && Date.now() - ms <= 7 * 86_400_000
}

/** Role chip colours — one treatment per DB role, reused on both screens. */
export const ROLE_CHIP: Record<string, string> = {
  ceo:           'border-gold/30 bg-gold/10 text-gold',
  director:      'border-gold/25 bg-gold/[0.07] text-gold/90',
  admin:         'border-violet-400/30 bg-violet-400/10 text-violet-300',
  sales_manager: 'border-teal-400/30 bg-teal-400/10 text-teal-300',
  team_leader:   'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  marketing:     'border-pink-400/30 bg-pink-400/10 text-pink-300',
  broker:        'border-line-strong bg-surface-2 text-slate-300',
}

/** Every DB role, in the order the roster filter and the invite form show them. */
export const TEAM_ROLES = ['ceo', 'director', 'admin', 'sales_manager', 'team_leader', 'marketing', 'broker'] as const
/** CEO is the protected owner role — never assignable from a form. */
export const ASSIGNABLE_ROLES = ['director', 'admin', 'sales_manager', 'team_leader', 'marketing', 'broker'] as const

/** Minutes → compact human form (measured values only; callers dash nulls). */
export const fmtMinutes = (n: number) => (n < 60 ? `${n}m` : `${Math.floor(n / 60)}h ${n % 60}m`)
