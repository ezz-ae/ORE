import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { ensureLeadsTable, ensureUsersTable } from "@/lib/data"
import {
  getLeadershipLeadRecipients,
  sendFollowUpDigestEmail,
  type FollowUpDigestLead,
} from "@/lib/transactional-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://freeholdproperty.ae"

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
       WHERE COALESCE(status, 'new') NOT IN ('closed', 'lost')
         AND COALESCE(last_contact_at, created_at) < now() - interval '48 hours'
         AND (snooze_until IS NULL OR snooze_until < now())
       ORDER BY COALESCE(last_contact_at, created_at) ASC
       LIMIT 500`,
    )

    if (!overdue.length) {
      return NextResponse.json({ ok: true, overdue: 0, notified: 0 })
    }

    const toDigestLead = (lead: OverdueLeadRow): FollowUpDigestLead => ({
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      daysOverdue: daysSince(lead.last_contact_at || lead.created_at),
      leadUrl: `${baseUrl}/crm/leads/${lead.id}`,
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
