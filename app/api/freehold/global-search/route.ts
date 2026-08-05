/**
 * Global search — one query, results grouped by the section they live in.
 *
 * The ask this answers, verbatim: "they can write a phone number to see it
 * belongs to a lead of his, they can write emaar to get emaar arranged by area
 * — example: emaar in inventory, then in ads".
 *
 * So: ONE input, and the answer comes back filed under Inventory / Ads / CRM /
 * Drive / People, in that order of usefulness. Tool (navigation) matches are
 * resolved on the client from lib/freehold/tools.ts — they need no database and
 * must appear instantly as you type; this endpoint only does the DATA half.
 *
 * SCOPING IS THE WHOLE POINT of "a lead of HIS". Every section below is fenced
 * to what the caller is allowed to see:
 *   · leads      — brokers see only leads assigned to them (either ownership key)
 *   · campaigns  — brokers see only campaigns they created; hidden from nobody else
 *   · people     — management only
 *   · drive      — always the caller's own files/library rows
 * A section the caller may not read is not queried at all, so it can never leak
 * through a count or an error message.
 *
 * Failure is per-section and honest: if one query throws, that section reports
 * `error` and the rest still return. The UI shows the failure rather than an
 * empty list, because "no results" and "the lookup broke" are different answers.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { ensureLeadsTable, ensureProjectsTable, ensureUsersTable } from '@/lib/data'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Per-section cap. Enough to recognise the right row, small enough to stay fast. */
const PER_SECTION = 6
/** Below this length a text query matches too much to be useful. */
const MIN_TEXT_LEN = 2
/** A phone search needs enough digits to identify a person, not a year. */
const MIN_PHONE_DIGITS = 6

export interface SearchHit {
  id: string
  title: string
  /** Secondary line — area, status, owner, whatever identifies this row. */
  sub?: string
  href: string
}
export interface SearchSection {
  /** Section id — the client maps it to a translated heading + icon. */
  section: string
  hits: SearchHit[]
  /** Present only when the lookup itself failed. Never paired with hits. */
  error?: string
}

const FI = '/freehold-intelligence'
const digitsOf = (s: string) => s.replace(/\D/g, '')

/**
 * A table that has never been created means the feature has never been used
 * here — genuinely zero rows, not a failure. Postgres 42P01 (undefined_table)
 * is therefore the ONLY error swallowed. A missing COLUMN (42703) or anything
 * else is real schema drift and must surface, not read as "no results".
 */
async function emptyIfUnused<T>(run: Promise<T[]>): Promise<T[]> {
  try { return await run } catch (e) {
    if ((e as { code?: string })?.code === '42P01') return []
    throw e
  }
}

/** Run one section, converting a throw into a reported error instead of a 500. */
async function section(
  id: string,
  run: () => Promise<SearchHit[]>,
): Promise<SearchSection | null> {
  try {
    const hits = await run()
    return hits.length ? { section: id, hits } : null
  } catch (e) {
    return { section: id, hits: [], error: e instanceof Error ? e.message : 'Lookup failed' }
  }
}

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const raw = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (!raw) return NextResponse.json({ sections: [] })

  const digits = digitsOf(raw)
  // A query is a phone lookup when it is mostly digits and long enough to
  // identify someone — "0501234567", "+971 50 123 4567", "50 123 4567".
  const isPhone = digits.length >= MIN_PHONE_DIGITS && digits.length >= raw.replace(/\s/g, '').length - 4
  if (!isPhone && raw.length < MIN_TEXT_LEN) return NextResponse.json({ sections: [] })

  const like = `%${raw.toLowerCase()}%`
  const isBroker = user.role === 'broker'
  const isManagement = MANAGEMENT_ROLES.includes(user.role)
  const ownerKeys = brokerOwnerKeys({ brokerId: user.brokerId, email: user.email })

  // ── Leads ────────────────────────────────────────────────────────────────
  // Phone matching strips formatting on BOTH sides and matches on a suffix, so
  // "0501234567", "+971501234567" and "501234567" all find the same person —
  // the single most common way this box will be used.
  const leads = section('leads', async () => {
    // A broker with no ownership key cannot own anything; return nothing rather
    // than falling through to an unscoped query.
    if (isBroker && ownerKeys.length === 0) return []
    // Columns this search reads (interest, archived, updated_at) arrive via the
    // ensure migration — a workspace that has never opened the CRM would
    // otherwise report a column error instead of results.
    await ensureLeadsTable()
    const scope = isBroker ? `AND assigned_broker_id = ANY($2::text[])` : ''
    const params: unknown[] = isPhone ? [digits.slice(-9)] : [like]
    if (isBroker) params.push(ownerKeys)
    const where = isPhone
      ? `regexp_replace(COALESCE(phone,''), '\\D', '', 'g') LIKE '%' || $1`
      : `(lower(COALESCE(name,'')) LIKE $1 OR lower(COALESCE(email,'')) LIKE $1
          OR lower(COALESCE(interest,'')) LIKE $1 OR lower(COALESCE(project_slug,'')) LIKE $1)`
    const rows = await query<{
      id: string; name: string | null; phone: string | null; email: string | null
      status: string | null; project_slug: string | null
    }>(
      `SELECT id, name, phone, email, status, project_slug
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND ${where} ${scope}
        ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
        LIMIT ${PER_SECTION}`,
      params,
    )
    return rows.map((r) => ({
      id: r.id,
      title: r.name?.trim() || r.phone || r.email || 'Unnamed lead',
      sub: [r.phone, r.status, r.project_slug].filter(Boolean).join(' · ') || undefined,
      href: `${FI}/crm/leads/${encodeURIComponent(r.id)}`,
    }))
  })

  // ── Inventory ────────────────────────────────────────────────────────────
  // "emaar" lands here first: developer, project name, area and slug all match,
  // and the sub-line carries the AREA — the arrangement the request asked for.
  const inventory = isPhone ? Promise.resolve(null) : section('inventory', async () => {
    await ensureProjectsTable()
    const rows = await query<{
      id: string; slug: string; name: string | null; area: string | null
      developer_name: string | null; status: string | null
    }>(
      `SELECT id, slug, name, area, developer_name, status
         FROM freehold_site_projects
        WHERE lower(COALESCE(name,'')) LIKE $1
           OR lower(COALESCE(area,'')) LIKE $1
           OR lower(COALESCE(developer_name,'')) LIKE $1
           OR lower(COALESCE(slug,'')) LIKE $1
        ORDER BY COALESCE(featured, false) DESC, COALESCE(market_score, 0) DESC, name
        LIMIT ${PER_SECTION}`,
      [like],
    )
    return rows.map((r) => ({
      id: r.id,
      title: r.name?.trim() || r.slug,
      sub: [r.developer_name, r.area, r.status].filter(Boolean).join(' · ') || undefined,
      href: `${FI}/inventory/${encodeURIComponent(r.slug)}`,
    }))
  })

  // ── Landing pages ────────────────────────────────────────────────────────
  const landings = isPhone ? Promise.resolve(null) : section('landings', async () => {
    const rows = await emptyIfUnused(query<{
      id: string; slug: string | null; headline: string | null
      project_slug: string | null; status: string | null
    }>(
      `SELECT id, slug, headline, project_slug, status
         FROM freehold_site_project_landing_pages
        WHERE lower(COALESCE(slug,'')) LIKE $1
           OR lower(COALESCE(headline,'')) LIKE $1
           OR lower(COALESCE(project_slug,'')) LIKE $1
        ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
        LIMIT ${PER_SECTION}`,
      [like],
    ))
    return rows.map((r) => ({
      id: r.id,
      title: r.headline?.trim() || r.slug || 'Landing page',
      sub: [r.slug ? `/lp/${r.slug}` : null, r.status].filter(Boolean).join(' · ') || undefined,
      href: r.slug ? `${FI}/inventory/landings/${encodeURIComponent(r.slug)}/edit` : `${FI}/inventory/landings`,
    }))
  })

  // ── Campaigns (Meta + Google) ────────────────────────────────────────────
  // Campaign name lives inside the stored payload, so the match is on
  // data->>'name'. Brokers see only what they launched.
  const campaigns = isPhone ? Promise.resolve(null) : section('campaigns', async () => {
    const scope = isBroker ? `AND created_by = $2` : ''
    const params: unknown[] = isBroker ? [like, user.email] : [like]
    const [meta, google] = await Promise.all([
      emptyIfUnused(query<{ id: string; status: string; name: string | null }>(
        `SELECT id, status, data->>'name' AS name
           FROM freehold_site_meta_campaigns
          WHERE lower(COALESCE(data->>'name','')) LIKE $1 ${scope}
          ORDER BY created_at DESC LIMIT ${PER_SECTION}`,
        params,
      )),
      emptyIfUnused(query<{ id: string; status: string; name: string | null }>(
        `SELECT id, status, data->>'name' AS name
           FROM freehold_site_google_campaigns
          WHERE lower(COALESCE(data->>'name','')) LIKE $1 ${scope}
          ORDER BY created_at DESC LIMIT ${PER_SECTION}`,
        params,
      )),
    ])
    return [
      ...meta.map((r) => ({
        id: r.id,
        title: r.name?.trim() || r.id,
        sub: ['Meta', r.status].filter(Boolean).join(' · '),
        href: `${FI}/ads-live/meta/${encodeURIComponent(r.id)}`,
      })),
      ...google.map((r) => ({
        id: r.id,
        title: r.name?.trim() || r.id,
        sub: ['Google', r.status].filter(Boolean).join(' · '),
        href: `${FI}/lead-machine/google/campaigns/${encodeURIComponent(r.id)}`,
      })),
    ].slice(0, PER_SECTION)
  })

  // ── People ───────────────────────────────────────────────────────────────
  // Management only. A phone query searches staff numbers too, so "who is this
  // number" answers for colleagues as well as leads.
  const people = !isManagement ? Promise.resolve(null) : section('people', async () => {
    await ensureUsersTable()
    const where = isPhone
      ? `regexp_replace(COALESCE(phone,''), '\\D', '', 'g') LIKE '%' || $1`
      : `(lower(COALESCE(name,'')) LIKE $1 OR lower(COALESCE(email,'')) LIKE $1)`
    const rows = await query<{ id: string; name: string | null; email: string | null; role: string | null }>(
      `SELECT id, name, email, role FROM freehold_site_users
        WHERE ${where}
        ORDER BY name NULLS LAST LIMIT ${PER_SECTION}`,
      [isPhone ? digits.slice(-9) : like],
    )
    return rows.map((r) => ({
      id: r.id,
      title: r.name?.trim() || r.email || r.id,
      sub: [r.role, r.email].filter(Boolean).join(' · ') || undefined,
      href: `${FI}/team/${encodeURIComponent(r.id)}`,
    }))
  })

  // ── Drive ────────────────────────────────────────────────────────────────
  // Always the caller's own rows — these tables are per-user by design.
  const drive = isPhone ? Promise.resolve(null) : section('drive', async () => {
    const [library, files] = await Promise.all([
      emptyIfUnused(query<{ id: string; title: string; kind: string }>(
        `SELECT id, title, kind FROM freehold_site_library
          WHERE user_email = $2 AND lower(COALESCE(title,'')) LIKE $1
          ORDER BY created_at DESC LIMIT ${PER_SECTION}`,
        [like, user.email],
      )),
      emptyIfUnused(query<{ id: string; name: string; folder: string | null }>(
        `SELECT id, name, folder FROM freehold_cloud_files
          WHERE user_email = $2 AND lower(COALESCE(name,'')) LIKE $1
          ORDER BY created_at DESC LIMIT ${PER_SECTION}`,
        [like, user.email],
      )),
    ])
    return [
      ...library.map((r) => ({
        id: r.id, title: r.title, sub: r.kind,
        href: `${FI}/drive/library`,
      })),
      ...files.map((r) => ({
        id: r.id, title: r.name, sub: r.folder ?? undefined,
        href: `${FI}/drive/files`,
      })),
    ].slice(0, PER_SECTION)
  })

  const settled = await Promise.all([leads, inventory, landings, campaigns, people, drive])
  return NextResponse.json({
    sections: settled.filter((s): s is SearchSection => s !== null),
    phone: isPhone,
  })
}
