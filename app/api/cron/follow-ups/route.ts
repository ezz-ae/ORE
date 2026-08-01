import { NextRequest, NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/site"
import { query } from "@/lib/db"
import { ensureLeadsTable, ensureUsersTable } from "@/lib/data"
import { notify } from "@/lib/freehold/notifications"
import { listCampaigns, getCampaignInsights } from "@/lib/meta/client"
import { metaLeadCount } from "@/lib/meta/lead-count"
import {
  getLeadershipLeadRecipients,
  sendSystemEmail,
  sendFollowUpDigestEmail,
  type FollowUpDigestLead,
} from "@/lib/transactional-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const baseUrl = getSiteUrl()

interface OverdueLeadRow {
  id: string
  name: string | null
  phone: string | null
  status: string | null
  source: string | null
  assigned_broker_id: string | null
  last_contact_at: string | null
  created_at: string
}

interface BrokerRow {
  id: string
  name: string | null
  email: string | null
}

const daysSince = (iso: string | null) => {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/**
 * Daily follow-up reminder (Vercel Cron). Finds open leads with no contact
 * for 48h+, emails each assigned broker their own overdue list, and sends
 * leadership a digest of unassigned overdue leads.
 */
/**
 * The system speaks to MANAGEMENT. Two smart checks, both fail-soft — the
 * broker digests this cron exists for must never be hostage to them.
 *
 *  1. A broker with overdue follow-ups who has not logged in today (Dubai
 *     day) is a revenue leak in progress: the leads exist, the owner is
 *     absent, and before this nothing said so until the weekly numbers
 *     looked off. Email + in-app, with the team page as the action.
 *  2. Active campaigns spending real money (AED 200+ / 30d) with fewer than
 *     3 leads. The Ads Machine watches its own trials; this covers EVERY
 *     campaign and lands in the inbox instead of behind a dashboard.
 */
async function runManagementAlerts(byBroker: Map<string, OverdueLeadRow[]>) {
  try {
    const leadership = await getLeadershipLeadRecipients()
    if (!leadership.emails.length) return

    const dubaiDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d)
    const today = dubaiDay(new Date())

    if (byBroker.size) {
      const brokerRows = await query<{ id: string; name: string | null; email: string | null; last_login_at: string | null }>(
        `SELECT id, name, email, last_login_at::text FROM freehold_site_users WHERE id = ANY($1::text[])`,
        [Array.from(byBroker.keys())],
      ).catch(() => [])
      const inactive: string[] = []
      for (const b of brokerRows) {
        const n = byBroker.get(b.id)?.length ?? 0
        const loginDay = b.last_login_at ? dubaiDay(new Date(b.last_login_at)) : null
        if (n > 0 && loginDay !== today) {
          inactive.push(`${b.name || b.email || b.id} has ${n} overdue follow-up(s) and hasn't logged in today${b.last_login_at ? ` (last login ${String(b.last_login_at).slice(0, 10)})` : " (never logged in)"}`)
        }
      }
      if (inactive.length) {
        await sendSystemEmail({
          to: leadership.emails,
          subject: `${inactive.length} broker(s) absent with follow-ups waiting`,
          headline: "Leads are waiting on brokers who are not here today.",
          lines: inactive.slice(0, 10),
          ctaLabel: "Take action",
          ctaUrl: `${baseUrl}/freehold-intelligence/management/team`,
        }).catch(() => {})
        for (const email of leadership.emails) {
          await notify("management_alert", { kind: "inactive_brokers", count: inactive.length, detail: inactive[0] }, { recipient: email, href: "/freehold-intelligence/management/team" }).catch(() => {})
        }
      }
    }

    try {
      const campaigns = (await listCampaigns()).filter((c) => c.status === "ACTIVE").slice(0, 10)
      const weak: string[] = []
      for (const c of campaigns) {
        const insights = await getCampaignInsights(c.id).catch(() => null)
        const spend = Number(insights?.spend) || 0
        const leads = metaLeadCount(insights?.actions)
        if (spend >= 200 && leads < 3) {
          weak.push(`"${c.name}": only ${leads} lead(s) on AED ${Math.round(spend)} spend (30d)${leads > 0 ? ` — CPL AED ${Math.round(spend / leads)}` : ""}`)
        }
      }
      if (weak.length) {
        await sendSystemEmail({
          to: leadership.emails,
          subject: `${weak.length} campaign(s) spending with almost no leads`,
          headline: "These campaigns are spending real money and barely producing.",
          lines: weak,
          ctaLabel: "Review and act",
          ctaUrl: `${baseUrl}/freehold-intelligence/lead-machine/campaigns/optimize`,
        }).catch(() => {})
        for (const email of leadership.emails) {
          await notify("management_alert", { kind: "weak_campaigns", count: weak.length, detail: weak[0] }, { recipient: email, href: "/freehold-intelligence/lead-machine/campaigns/optimize" }).catch(() => {})
        }
      }
    } catch { /* Meta not connected — nothing to report, not a failure */ }
  } catch (e) {
    console.error("[cron/follow-ups] management alerts failed", e)
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization") || ""
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    await ensureLeadsTable()
    await ensureUsersTable()

    const overdue = await query<OverdueLeadRow>(
      `SELECT id, name, phone, status, source, assigned_broker_id, last_contact_at, created_at
       FROM freehold_site_leads
       WHERE COALESCE(status, 'new') NOT IN ('closed', 'converted', 'lost')
         AND COALESCE(last_contact_at, created_at) < now() - interval '48 hours'
         AND (snooze_until IS NULL OR snooze_until < now())
       ORDER BY COALESCE(last_contact_at, created_at) ASC
       LIMIT 500`,
    )

    if (!overdue.length) {
      // No overdue follow-ups, but campaign health still deserves its check.
      await runManagementAlerts(new Map())
      return NextResponse.json({ ok: true, overdue: 0, notified: 0 })
    }

    const toDigestLead = (lead: OverdueLeadRow): FollowUpDigestLead => ({
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      daysOverdue: daysSince(lead.last_contact_at || lead.created_at),
      leadUrl: `${baseUrl}/freehold-intelligence/crm/leads/${lead.id}`,
    })

    const byBroker = new Map<string, OverdueLeadRow[]>()
    const unassigned: OverdueLeadRow[] = []
    for (const lead of overdue) {
      if (lead.assigned_broker_id) {
        const list = byBroker.get(lead.assigned_broker_id) ?? []
        list.push(lead)
        byBroker.set(lead.assigned_broker_id, list)
      } else {
        unassigned.push(lead)
      }
    }

    let notified = 0
    if (byBroker.size) {
      const brokerIds = Array.from(byBroker.keys())
      const brokers = await query<BrokerRow>(
        `SELECT id, name, email FROM freehold_site_users WHERE id = ANY($1::text[])`,
        [brokerIds],
      ).catch(() => [] as BrokerRow[])
      const brokerById = new Map(brokers.map((broker) => [broker.id, broker]))

      for (const [brokerId, leads] of byBroker) {
        const broker = brokerById.get(brokerId)
        if (!broker?.email) continue
        const result = await sendFollowUpDigestEmail({
          to: [broker.email],
          recipientName: broker.name,
          leads: leads.slice(0, 25).map(toDigestLead),
        }).catch((error) => {
          console.error("[cron/follow-ups] broker digest failed", error)
          return { sent: false as const }
        })
        if (result.sent) notified += 1
      }
    }

    if (unassigned.length) {
      const leadership = await getLeadershipLeadRecipients()
      if (leadership.emails.length) {
        const result = await sendFollowUpDigestEmail({
          to: leadership.emails,
          recipientName: null,
          leads: unassigned.slice(0, 25).map(toDigestLead),
        }).catch((error) => {
          console.error("[cron/follow-ups] leadership digest failed", error)
          return { sent: false as const }
        })
        if (result.sent) notified += 1
      }
    }

    await runManagementAlerts(byBroker)

    return NextResponse.json({
      ok: true,
      overdue: overdue.length,
      unassigned: unassigned.length,
      notified,
    })
  } catch (error) {
    console.error("[cron/follow-ups] error", error)
    return NextResponse.json({ error: "Follow-up check failed." }, { status: 500 })
  }
}
