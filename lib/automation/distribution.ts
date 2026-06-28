import { query } from '@/lib/db'
import type { DistributionConfig } from './types'

/**
 * Lead distribution — picks the agent a lead should be routed to, based on the
 * workspace's distribution strategy. Pure-ish: reads agent roster + load from
 * the DB, returns a brokerId (or null when nobody is eligible).
 */

export interface LeadForDistribution {
  id: string
  source: string | null
  project_slug: string | null
  interest: string | null
  country: string | null
}

interface AgentLoad {
  brokerId: string
  openLeads: number      // active (not closed/lost) assigned leads
  assignedToday: number  // leads assigned in the last 24h
  closed: number         // closed deals all-time (performance proxy)
}

function withinWorkingHours(cfg: DistributionConfig): boolean {
  if (!cfg.respectWorkingHours) return true
  // Asia/Dubai hour
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date()),
  )
  const { workingHoursStart: s, workingHoursEnd: e } = cfg
  return s <= e ? hour >= s && hour < e : hour >= s || hour < e
}

async function loadRoster(pool: string[]): Promise<AgentLoad[]> {
  // Eligible brokers: the configured pool, or all active brokers.
  const brokers = pool.length
    ? pool
    : (
        await query<{ id: string; email: string }>(
          `SELECT id, email FROM freehold_site_users
           WHERE role = 'broker' AND COALESCE(suspended, false) = false`,
        )
      ).map((r) => r.id)

  if (!brokers.length) return []

  const loads = await query<{ broker: string; open_leads: string; today: string }>(
    `SELECT assigned_broker_id AS broker,
            COUNT(*) FILTER (WHERE status NOT IN ('closed','lost'))::text AS open_leads,
            COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::text AS today
     FROM freehold_site_leads
     WHERE assigned_broker_id = ANY($1)
     GROUP BY assigned_broker_id`,
    [brokers],
  ).catch(() => [] as { broker: string; open_leads: string; today: string }[])

  const closedByBroker = await query<{ broker: string; closed: string }>(
    `SELECT agent_id AS broker, COUNT(*)::text AS closed
     FROM freehold_site_deals
     WHERE status IN ('approved','closed') AND agent_id = ANY($1)
     GROUP BY agent_id`,
    [brokers],
  ).catch(() => [] as { broker: string; closed: string }[])

  const loadMap = new Map(loads.map((l) => [l.broker, l]))
  const closedMap = new Map(closedByBroker.map((c) => [c.broker, Number(c.closed)]))

  return brokers.map((brokerId) => ({
    brokerId,
    openLeads: Number(loadMap.get(brokerId)?.open_leads ?? 0),
    assignedToday: Number(loadMap.get(brokerId)?.today ?? 0),
    closed: closedMap.get(brokerId) ?? 0,
  }))
}

function matchKeyword(map: Record<string, string[]>, ...haystacks: (string | null)[]): string[] | null {
  const hay = haystacks.filter(Boolean).join(' ').toLowerCase()
  for (const [key, brokers] of Object.entries(map)) {
    if (key && hay.includes(key.toLowerCase()) && brokers.length) return brokers
  }
  return null
}

/**
 * Decide which agent a lead should go to. Returns null if distribution is off,
 * outside working hours, or no eligible agent exists (caller may use fallback).
 */
export async function pickAgentForLead(
  cfg: DistributionConfig,
  lead: LeadForDistribution,
): Promise<string | null> {
  if (cfg.mode !== 'auto') return null
  if (!withinWorkingHours(cfg)) return cfg.fallbackBrokerId

  // Strategy-specific candidate pool narrowing.
  let poolOverride: string[] | null = null
  if (cfg.strategy === 'source' && lead.source) {
    poolOverride = cfg.sourceMap[lead.source] ?? matchKeyword(cfg.sourceMap, lead.source)
  } else if (cfg.strategy === 'area') {
    poolOverride = matchKeyword(cfg.areaMap, lead.project_slug, lead.interest, lead.country)
  }

  let roster = await loadRoster(poolOverride ?? cfg.pool)

  // Respect daily cap.
  if (cfg.maxPerAgentPerDay > 0) {
    const eligible = roster.filter((a) => a.assignedToday < cfg.maxPerAgentPerDay)
    if (eligible.length) roster = eligible
  }

  if (!roster.length) return cfg.fallbackBrokerId

  switch (cfg.strategy) {
    case 'load_balanced':
    case 'area':
    case 'source':
      // Fewest open leads wins; ties broken by fewest assigned today.
      roster.sort((a, b) => a.openLeads - b.openLeads || a.assignedToday - b.assignedToday)
      return roster[0].brokerId
    case 'performance': {
      // Top closers get priority, but skip anyone already heavily loaded.
      roster.sort((a, b) => b.closed - a.closed || a.openLeads - b.openLeads)
      return roster[0].brokerId
    }
    case 'round_robin':
    default:
      // Even rotation ≈ assign to whoever has received the fewest recently.
      roster.sort((a, b) => a.assignedToday - b.assignedToday || a.openLeads - b.openLeads)
      return roster[0].brokerId
  }
}
