import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Only the top of the house can wipe operational data.
const RESET_ROLES = ['ceo', 'admin'] as const

// Lead lifecycle data — cleared by the default ("leads") scope so the team can
// start from a clean pipeline without touching the property catalog or accounts.
const LEAD_TABLES = [
  'freehold_site_lead_activity',
  'freehold_site_lp_analytics',
  'freehold_site_deals',
  'freehold_site_leads',
]

// Everything else that accumulates during demos/testing. Cleared only by the
// explicit "all-demo" scope. The property catalog (projects, areas, developers,
// landing pages, microsites, web content), team accounts and API keys are never
// touched here.
const DEMO_TABLES = [
  'freehold_site_contracts',
  'freehold_site_finance_entries',
  'freehold_site_tasks',
  'freehold_site_review_comments',
  'freehold_site_review_resolutions',
  'freehold_site_activity_log',
  'freehold_site_whatsapp_messages',
  'freehold_site_notebook_outputs',
  'freehold_site_ai_conversations',
  'freehold_site_ai_training_requests',
  'freehold_site_ai_project_updates',
  'freehold_site_ad_requests',
  'freehold_site_meta_campaigns',
  'freehold_site_google_campaigns',
  'freehold_site_google_entities',
]

async function purge(tables: string[]): Promise<Record<string, number | string>> {
  const result: Record<string, number | string> = {}
  for (const table of tables) {
    try {
      // Table names come from a fixed allow-list above — never user input.
      const rows = await query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`)
      const before = Number(rows[0]?.count ?? 0)
      await query(`DELETE FROM ${table}`)
      result[table] = before
    } catch {
      // Table may not exist on this database yet — skip silently.
      result[table] = 'skipped'
    }
  }
  return result
}

/**
 * Wipe operational/demo data so the platform is ready for live operation.
 *
 * POST body:
 *   { "confirm": "RESET", "scope": "leads" | "all-demo" }
 *
 * - scope "leads" (default): clears leads, deals, lead activity and landing
 *   analytics, and restarts the FH-#### lead numbering at 1.
 * - scope "all-demo": additionally clears tasks, finance entries, contracts,
 *   AI conversations, notebook outputs, ad requests and campaign mirrors.
 *
 * Never touches: projects/inventory, area & developer profiles, landing pages,
 * microsites, web content, team accounts or API keys.
 */
export async function POST(req: Request) {
  const auth = await requireSession(RESET_ROLES)
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as { confirm?: string; scope?: string }
  if (body.confirm !== 'RESET') {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirm": "RESET" } to proceed.' },
      { status: 400 },
    )
  }

  const scope = body.scope === 'all-demo' ? 'all-demo' : 'leads'
  const tables = scope === 'all-demo' ? [...DEMO_TABLES, ...LEAD_TABLES] : LEAD_TABLES

  try {
    const cleared = await purge(tables)
    // Restart lead numbering so the first new lead is FH-0001 again.
    try {
      await query(`ALTER SEQUENCE IF EXISTS freehold_site_lead_seq RESTART WITH 1`)
    } catch { /* sequence may not exist yet */ }

    return NextResponse.json({ ok: true, scope, cleared })
  } catch (err) {
    console.error('[admin/reset] purge failed', err)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
