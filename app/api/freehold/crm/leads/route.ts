import { dbLeadToCRM, type DbLead } from '@/lib/freehold/crm-row'
import { listCampaigns, isMetaConfigured } from '@/lib/meta/client'
import { getProjectSlugForCampaign } from '@/lib/meta/campaign-structure'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { NextResponse } from 'next/server'
// ONE READER for what an ad's leads were worth — the CRM forecast and the
// campaign advisor must not be able to disagree about the same ad.
import { adRatings as sourceHistoryByAd } from '@/lib/freehold/ad-ratings'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { ensureLeadsTable, ensureLeadActivityTable } from '@/lib/data'
import { notify } from '@/lib/freehold/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Page size for the CRM list. Generous enough that a normal account is
 *  never truncated; bounded so the query stays sane as the table grows. */
const LEAD_LIST_LIMIT = 1000

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']


/** Normalised phones (7+ digits) that appear on MORE than one non-archived
 *  lead — the duplicate clusters, computed over the whole table so the flag
 *  is correct even for rows beyond the list cap. Fail-soft to empty. */
async function duplicatePhoneSet(): Promise<{ unresolved: Set<string>; registrations: Map<string, number> }> {
  const empty = { unresolved: new Set<string>(), registrations: new Map<string, number>() }
  try {
    const rows = await query<{ p: string; total: string; open: string }>(
      // '\\D' in a JS string reaches Postgres as \D (non-digit). Written as
      // '\D' the JS layer cooks it to the bare letter "D", so the query would
      // strip only "D" and group by raw formatted phones — every duplicate/
      // wrong-number flag computed off it was wrong.
      //
      // TWO COUNTS, because a merged pair is not an unresolved duplicate but
      // IS still a person who registered twice. `total` is how many times they
      // came to us — the fact the operator asked to be able to see. `open` is
      // how many records are still separate, which is the only one that should
      // raise a risk flag; once merged, the second row carries merged_into and
      // stops counting toward it.
      `SELECT regexp_replace(phone, '\\D', '', 'g') AS p,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE merged_into IS NULL) AS open
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND phone IS NOT NULL
        GROUP BY 1
       HAVING length(regexp_replace(phone, '\\D', '', 'g')) >= 7 AND COUNT(*) > 1`,
    )
    const unresolved = new Set<string>()
    const registrations = new Map<string, number>()
    for (const r of rows) {
      registrations.set(r.p, Number(r.total))
      if (Number(r.open) > 1) unresolved.add(r.p)
    }
    return { unresolved, registrations }
  } catch { return empty }
}

// Persistent "not a duplicate" dismissals live on the lead row.
let dismissColEnsured: Promise<void> | null = null
const ensureDismissColumn = () => {
  if (!dismissColEnsured) {
    dismissColEnsured = query(
      `ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz`
    ).then(() => undefined).catch((e) => { dismissColEnsured = null; throw e })
  }
  return dismissColEnsured
}

/**
 * campaign id → its name, and campaign id → its project's name.
 *
 * Meta for the names (one list call, the same one every other screen makes)
 * and our own link table for the projects, which Meta has no concept of.
 * Returns empty maps rather than throwing: a CRM that cannot reach Meta is
 * still a working CRM, and a row that says less is not a row that lies.
 */
async function resolveCampaignLabels(): Promise<{
  campaignNames: Map<string, string>
  campaignProjects: Map<string, string>
}> {
  const campaignNames = new Map<string, string>()
  const campaignProjects = new Map<string, string>()
  try {
    if (!(await isMetaConfigured())) return { campaignNames, campaignProjects }
    const campaigns = await listCampaigns()
    for (const c of campaigns) {
      const id = String(c.id ?? '')
      if (!id) continue
      if (c.name) campaignNames.set(id, String(c.name))
      const slug = await getProjectSlugForCampaign(id).catch(() => null)
      if (slug) {
        const p = await getInventoryPropertyBySlug(slug).catch(() => null)
        if (p?.name) campaignProjects.set(id, p.name)
      }
    }
  } catch { /* a CRM that cannot reach Meta is still a working CRM */ }
  return { campaignNames, campaignProjects }
}

/**
 * `freehold_site_leads.project_slug` is written by whatever ingestion path
 * created the lead — a webhook, an import, a landing page — and nothing has
 * ever checked that the string sitting in it names a REAL project. A row
 * showed it anyway, bold and unqualified, as "the project" — which is how an
 * ad set's name (or any other stray string that ended up in that column)
 * could sit in a lead row wearing the same weight as a verified fact.
 *
 * One batched query validates every distinct slug on the page against
 * `freehold_site_projects` and returns only the ones that are real. A slug
 * with no match contributes nothing — the row falls through to the campaign
 * name or says nothing, per the same rule the rest of this file follows.
 */
async function resolveProjectSlugNames(slugs: Array<string | null>): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(slugs.map((s) => (s ?? '').trim().toLowerCase()).filter(Boolean))]
  if (!unique.length) return map
  try {
    const rows = await query<{ slug: string; name: string }>(
      `SELECT slug, name FROM freehold_site_projects WHERE lower(slug) = ANY($1)`,
      [unique],
    )
    for (const r of rows) if (r.name) map.set(r.slug.toLowerCase(), r.name)
  } catch { /* a CRM that cannot validate a slug still works — it just says less */ }
  return map
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureLeadsTable()
    await ensureDismissColumn()
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    // Written by meta-lead-sync, but a workspace whose first read beats its
    // first sync would 500 on a missing column and show no leads at all.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_form_name text`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_ad_name text`).catch(() => undefined)
    // Written by the landing-session scorer. The forecast reads it, so a
    // workspace that has never run one must not 500 the whole CRM.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS behaviour_score int`).catch(() => undefined)
    const isBroker = user.role === 'broker'
    const ownerKeys = brokerOwnerKeys(user)

    const params: unknown[] = []
    let sql = `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
                      status, priority, created_at::text, last_contact_at::text, country,
                      merged_into,
                      budget_aed, interest, message, landing_slug, updated_at::text,
                      snooze_until::text, lead_code, duplicate_dismissed_at::text,
                      utm_id, utm_campaign, value_rating, behaviour_score, meta_ad_id,
                      meta_form_name, meta_ad_name, archived, blocked
               FROM freehold_site_leads`

    if (isBroker && ownerKeys.length) {
      sql += ` WHERE assigned_broker_id = ANY($1)`
      params.push(ownerKeys)
    }
    // The list was capped at 200 with nothing saying so, while the dashboard
    // counter counts every row — so an account with 443 leads showed "443" next
    // to a list that simply stopped at 200. Indistinguishable, from the outside,
    // from leads having gone missing.
    //
    // The cap itself is worth keeping (an unbounded SELECT on a growing table
    // is how a page dies later), but it has to be BOTH generous enough that
    // ordinary accounts are never truncated, and honest when it does bite.
    sql += ` ORDER BY created_at DESC LIMIT ${LEAD_LIST_LIMIT}`

    const rows = await query<DbLead>(sql, params)

    // WHAT THE ROW ALREADY KNEW AND NEVER SAID. Every synced Meta lead carries
    // the campaign id in utm_id; meta_campaign_projects maps that campaign to
    // its project. Two cheap reads answer for the whole page, so "General
    // enquiry" becomes the campaign or the project that actually brought them.
    // Both fail soft: a lead with an unresolvable campaign simply says less,
    // never something untrue. projectSlugNames validates the raw project_slug
    // column the same way, so an unverified string never wears the project
    // line's confidence.
    const [dupPhones, { campaignNames, campaignProjects }, projectSlugNames] = await Promise.all([
      duplicatePhoneSet(),
      resolveCampaignLabels(),
      resolveProjectSlugNames(rows.map((r) => r.project_slug)),
    ])

    // The true count under the SAME filter the list used, so a broker's total
    // matches a broker's list rather than the whole company's.
    let total = rows.length
    try {
      const countSql = `SELECT COUNT(*)::text AS n FROM freehold_site_leads${
        isBroker && ownerKeys.length ? ' WHERE assigned_broker_id = ANY($1)' : ''
      }`
      const [c] = await query<{ n: string }>(countSql, isBroker && ownerKeys.length ? [ownerKeys] : [])
      total = Number(c?.n) || rows.length
    } catch { /* fall back to the page size — never break the list over a count */ }

    // UNOWNED LEADS. Auto-distribution only runs when the workspace is in
    // 'auto' mode; otherwise a lead that arrives from a Meta form or a landing
    // page keeps assigned_broker_id = NULL. Brokers are filtered to their own
    // leads, so an unowned lead is invisible to every broker and merely
    // unremarkable to management — it looks like a normal row while in fact
    // nobody is working it. That is indistinguishable, from the floor, from
    // "the lead never arrived". Managers get the count so it can be acted on.
    // The carry from the last campaign into this one — resolved once for the
    // whole page rather than per row. See sourceHistoryByAd.
    const adHistory = await sourceHistoryByAd()

    let unassigned = 0
    if (!isBroker) {
      const [c] = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM freehold_site_leads
          WHERE assigned_broker_id IS NULL AND status = 'new'`,
      ).catch(() => [{ n: '0' }])
      unassigned = Number(c?.n) || 0
    }
    return NextResponse.json({
      leads: rows.map((r) => dbLeadToCRM(r, dupPhones, campaignNames, campaignProjects, projectSlugNames, adHistory)),
      source: 'db',
      unassigned,
      total,
      /** True when the list is a window onto a larger set — the UI must say so. */
      truncated: total > rows.length,
    })
  } catch (err) {
    console.error('[crm/leads] query failed', err)
    return NextResponse.json({ leads: [], source: 'error' }, { status: 500 })
  }
}

// Create a lead. Brokers may add their OWN direct leads (auto-assigned to
// themselves); management may add a lead and assign it to any broker.
export async function POST(req: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isManagement = MANAGEMENT.includes(user.role)
  if (!isManagement && user.role !== 'broker') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string; phone?: string; email?: string; source?: string
    interest?: string; budgetAed?: number | string; message?: string; assignedBrokerId?: string
  }
  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // A broker can only create a lead for themselves; management chooses the owner.
  const assignedBrokerId = isManagement
    ? (body.assignedBrokerId || null)
    : (user.brokerId ?? user.email)

  const budget = body.budgetAed != null && String(body.budgetAed).trim() !== ''
    ? Number(String(body.budgetAed).replace(/[^0-9.]/g, '')) || null
    : null

  try {
    await ensureLeadsTable()
    const id = randomUUID()
    await query(
      `INSERT INTO freehold_site_leads
         (id, name, phone, email, source, status, priority, assigned_broker_id, interest, budget_aed, message)
       VALUES ($1, $2, $3, $4, $5, 'new', 'warm', $6, $7, $8, $9)`,
      [
        id, name, body.phone || null, body.email || null,
        (body.source || 'Direct').trim(), assignedBrokerId,
        (body.interest || '').trim() || null, budget, (body.message || '').trim() || null,
      ],
    )
    // Real notification: new lead waiting (broadcast to management).
    notify('lead_new', { name }, { href: '/freehold-intelligence/crm/inbox' }).catch(() => {})
    // Log creation on the lead's real activity timeline (best-effort).
    try {
      await ensureLeadActivityTable()
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, 'created', $3, $4)`,
        [
          randomUUID(), id,
          `Lead created via ${(body.source || 'Direct').trim()}${assignedBrokerId ? ` · assigned to ${assignedBrokerId}` : ''}`,
          user.email,
        ],
      )
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (err) {
    console.error('[crm/leads] create failed', err)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
