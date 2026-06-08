import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface DbLead {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  source: string | null
  project_slug: string | null
  assigned_broker_id: string | null
  status: string | null
  priority: string | null
  created_at: string
  last_contact_at: string | null
  country: string | null
  budget_aed: number | null
  interest: string | null
  message: string | null
  landing_slug: string | null
  updated_at: string | null
}

function dbLeadToCRM(row: DbLead) {
  const stage = (row.status as string | null) ?? 'new'
  const stageMap: Record<string, string> = {
    new: 'new', contacted: 'contacted', qualified: 'qualified',
    viewing: 'viewing', negotiation: 'negotiation', closed: 'closed', lost: 'lost',
  }
  const temperature = row.priority === 'hot' ? 'hot'
    : row.priority === 'cold' ? 'cold'
    : row.priority === 'priority' ? 'priority'
    : 'warm'
  return {
    id: row.id,
    hubspotLeadId: '',
    name: row.name ?? 'Unknown',
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.source ?? 'direct',
    landingId: row.landing_slug ?? '',
    campaignId: '',
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    pipelineStage: stageMap[stage] ?? 'new',
    temperature,
    budgetAED: row.budget_aed ? `AED ${row.budget_aed.toLocaleString()}` : 'Unknown',
    projectInterest: row.interest ?? row.project_slug ?? 'General enquiry',
    intentScore: temperature === 'priority' ? 90 : temperature === 'hot' ? 75 : temperature === 'warm' ? 55 : 30,
    urgency: temperature === 'priority' ? 'critical' : temperature === 'hot' ? 'high' : 'medium',
    duplicateRisk: false,
    wrongNumberRisk: false,
    assignedAgent: row.assigned_broker_id ?? '',
    lastContactAt: row.last_contact_at ?? row.created_at,
    nextBestAction: stage === 'new' ? 'Reach out and qualify' : 'Follow up',
    suggestedMessage: '',
    aiSummary: row.message ?? '',
    hasViewingScheduled: stage === 'viewing',
    viewingDate: null,
    viewingProperty: null,
    notes: [],
    taggedProjects: row.project_slug ? [row.project_slug] : [],
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)

  try {
    const isBroker = user?.role === 'broker'
    const brokerId = user?.brokerId ?? user?.email

    const params: unknown[] = []
    let sql = `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
                      status, priority, created_at::text, last_contact_at::text, country,
                      budget_aed, interest, message, landing_slug, updated_at::text
               FROM freehold_site_leads`

    if (isBroker && brokerId) {
      sql += ` WHERE assigned_broker_id = $1`
      params.push(brokerId)
    }
    sql += ` ORDER BY created_at DESC LIMIT 200`

    const rows = await query<DbLead>(sql, params)
    return NextResponse.json({ leads: rows.map(dbLeadToCRM), source: 'db' })
  } catch (err) {
    console.error('[crm/leads] query failed', err)
    return NextResponse.json({ leads: [], source: 'error' }, { status: 500 })
  }
}
