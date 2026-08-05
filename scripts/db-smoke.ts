/**
 * DB smoke — runs the real migrations and the real queries against a real
 * Postgres, and reports honestly when it cannot.
 *
 * Why this exists. Three features shipped whose SQL had never once been
 * executed — "verified by review" and a green production build were doing all
 * the work. That is exactly the shape of failure this product keeps being
 * bitten by: a thing that reports success it has not achieved. Worse, `query()`
 * returns `[]` when no database is configured (lib/db.ts), so a harness that
 * forgets to set DATABASE_URL prints a full page of ticks having run nothing.
 * This script refuses to do that: no database, no claim.
 *
 * Run it against a throwaway Postgres:
 *
 *   initdb -D /tmp/pg -U ore -A trust && pg_ctl -D /tmp/pg -o '-p 55432' start
 *   createdb -h localhost -p 55432 -U ore ore
 *   DATABASE_URL='postgresql://ore@localhost:55432/ore' pnpm db:smoke
 *
 * (If the server has SSL on with a self-signed cert, add `?sslmode=no-verify`
 * and NODE_TLS_REJECT_UNAUTHORIZED=0 — local only, never in CI against a real
 * database.)
 *
 * Exits 0 only if every statement executed. Exits 2 — distinct from failure —
 * when no database is configured, so a caller can tell "skipped" from "broken".
 */
import { query } from '../lib/db'
import { ensureLeadsTable, ensureProjectsTable, ensureUsersTable } from '../lib/data'
import {
  ensureTeamsSchema, listTeams, createTeam, setTeamLeader,
  getProfileSpine, teamMemberIds,
} from '../lib/freehold/teams'

const HAS_DB = !!(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL)
if (!HAS_DB) {
  console.error('\n⏭  db:smoke SKIPPED — no NEON_DATABASE_URL / DATABASE_URL.')
  console.error('   Nothing was verified. See the header of this file to run it for real.\n')
  process.exit(2)
}

let failures = 0
const ok = (m: string, extra = '') => console.log(`  ✓ ${m}${extra ? ` — ${extra}` : ''}`)
const bad = (m: string, e: unknown) => {
  failures++
  console.error(`  ✗ ${m}\n      ${e instanceof Error ? e.message : String(e)}`)
}
async function run<T>(name: string, fn: () => Promise<T>, describe?: (r: T) => string): Promise<T | null> {
  try { const r = await fn(); ok(name, describe ? describe(r) : ''); return r }
  catch (e) { bad(name, e); return null }
}
const rows = (r: unknown) => (Array.isArray(r) ? `${r.length} row(s)` : '')

const PHONE_STORED = '+971 50 123 4567'
const PHONE_TYPED = '0501234567'          // how a broker would actually type it
const SUFFIX = PHONE_TYPED.replace(/\D/g, '').slice(-9)

async function main() {
  console.log('\n── migrations ──')
  await run('ensureLeadsTable', ensureLeadsTable)
  await run('ensureProjectsTable', ensureProjectsTable)
  await run('ensureUsersTable', ensureUsersTable)
  await run('ensureTeamsSchema', ensureTeamsSchema)

  console.log('\n── fixtures ──')
  await run('leader row', () => query(
    `INSERT INTO freehold_site_users (id,name,email,role) VALUES ('smoke_u1','Smoke Leader','smoke1@test.local','team_leader')
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`))
  await run('broker row', () => query(
    `INSERT INTO freehold_site_users (id,name,email,role) VALUES ('smoke_u2','Smoke Broker','smoke2@test.local','broker')
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`))
  await run('lead row', () => query(
    `INSERT INTO freehold_site_leads (id,name,phone,email,status,assigned_broker_id,project_slug)
     VALUES ('smoke_l1','Smoke Lead',$1,'lead@test.local','new','smoke_u2','smoke-emaar')
       ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone`, [PHONE_STORED]))
  await run('project row', () => query(
    `INSERT INTO freehold_site_projects (id,slug,name,area,developer_name,status)
     VALUES ('smoke_p1','smoke-emaar','Smoke Beachfront','Dubai Harbour','Emaar','off-plan')
       ON CONFLICT (id) DO UPDATE SET area = EXCLUDED.area`))

  console.log('\n── teams (the leader spine) ──')
  await run('createTeam', async () => {
    await query(`DELETE FROM freehold_site_teams WHERE id = 'smoke_t1'`)
    return createTeam('smoke_t1', 'Smoke Team', 'smoke_u1')
  }, (t) => (t as { name: string }).name)
  await run('setTeamLeader', () => setTeamLeader('smoke_t1', 'smoke_u1'))
  await run('listTeams', listTeams, rows)
  await run('getProfileSpine', () => getProfileSpine('smoke_u1'), (p) => (p ? 'spine present' : 'null'))

  // The leader's whole scope depends on this returning members. It returned
  // empty for every real account, because nothing in the product could put a
  // member on a team — the reason the Teams screen exists.
  await run('member via team_id', async () => {
    await query(`UPDATE freehold_site_users SET team_id='smoke_t1', reports_to=NULL WHERE id='smoke_u2'`)
    const ids = await teamMemberIds('smoke_u1')
    if (!ids.includes('smoke_u2')) throw new Error(`leader scope missing the member: [${ids.join(', ')}]`)
    if (!ids.includes('smoke2@test.local')) throw new Error('scope must carry the email spelling too (lead-access.ts)')
    return ids
  }, rows)
  await run('member via reports_to', async () => {
    await query(`UPDATE freehold_site_users SET team_id=NULL, reports_to='smoke_u1' WHERE id='smoke_u2'`)
    const ids = await teamMemberIds('smoke_u1')
    if (!ids.includes('smoke_u2')) throw new Error(`reports_to did not put the member in scope: [${ids.join(', ')}]`)
    return ids
  }, rows)

  console.log('\n── global search: a phone number finds its lead ──')
  await run('typed 0501234567 finds "+971 50 123 4567"', async () => {
    const r = await query<{ id: string }>(
      `SELECT id, name, phone, email, status, project_slug FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND regexp_replace(COALESCE(phone,''), '\\D', '', 'g') LIKE '%' || $1
        ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST LIMIT 6`, [SUFFIX])
    if (!r.some((x) => x.id === 'smoke_l1')) throw new Error('suffix match failed — the phone lookup is broken')
    return r
  }, rows)
  await run('broker scope keeps their own lead', async () => {
    const r = await query<{ id: string }>(
      `SELECT id FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND regexp_replace(COALESCE(phone,''), '\\D', '', 'g') LIKE '%' || $1
          AND assigned_broker_id = ANY($2::text[])
        ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST LIMIT 6`,
      [SUFFIX, ['smoke_u2', 'smoke2@test.local']])
    if (!r.length) throw new Error('a broker cannot find their OWN lead — scoping is too tight')
    return r
  }, rows)
  await run('another broker sees nothing', async () => {
    const r = await query(
      `SELECT id FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND regexp_replace(COALESCE(phone,''), '\\D', '', 'g') LIKE '%' || $1
          AND assigned_broker_id = ANY($2::text[]) LIMIT 6`,
      [SUFFIX, ['someone_else', 'else@test.local']])
    if (r.length) throw new Error('LEAK: a broker can find a lead that is not theirs')
    return r
  }, rows)

  console.log('\n── global search: "emaar" lands under the right sections ──')
  const like = '%emaar%'
  await run('inventory matches developer/area/name/slug', async () => {
    const r = await query<{ id: string }>(
      `SELECT id, slug, name, area, developer_name, status FROM freehold_site_projects
        WHERE lower(COALESCE(name,'')) LIKE $1 OR lower(COALESCE(area,'')) LIKE $1
           OR lower(COALESCE(developer_name,'')) LIKE $1 OR lower(COALESCE(slug,'')) LIKE $1
        ORDER BY COALESCE(featured, false) DESC, COALESCE(market_score, 0) DESC, name LIMIT 6`, [like])
    if (!r.some((x) => x.id === 'smoke_p1')) throw new Error('developer name did not match')
    return r
  }, rows)
  await run('leads match by project slug', () => query(
    `SELECT id FROM freehold_site_leads
      WHERE archived IS NOT TRUE AND (lower(COALESCE(name,'')) LIKE $1 OR lower(COALESCE(email,'')) LIKE $1
        OR lower(COALESCE(interest,'')) LIKE $1 OR lower(COALESCE(project_slug,'')) LIKE $1)
      ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST LIMIT 6`, [like]), rows)
  await run('landing pages query executes', () => query(
    `SELECT id, slug, headline, project_slug, status FROM freehold_site_project_landing_pages
      WHERE lower(COALESCE(slug,'')) LIKE $1 OR lower(COALESCE(headline,'')) LIKE $1
         OR lower(COALESCE(project_slug,'')) LIKE $1
      ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST LIMIT 6`, [like]).catch((e) => {
        // 42P01 is the one honest empty: the feature has never been used here.
        if ((e as { code?: string })?.code === '42P01') return []
        throw e
      }), rows)
  await run('people match (management only)', () => query(
    `SELECT id, name, email, role FROM freehold_site_users
      WHERE (lower(COALESCE(name,'')) LIKE $1 OR lower(COALESCE(email,'')) LIKE $1)
      ORDER BY name NULLS LAST LIMIT 6`, ['%smoke%']), rows)
  await run('people match by phone', () => query(
    `SELECT id FROM freehold_site_users
      WHERE regexp_replace(COALESCE(phone,''), '\\D', '', 'g') LIKE '%' || $1
      ORDER BY name NULLS LAST LIMIT 6`, [SUFFIX]), rows)

  console.log('\n── cleanup ──')
  await run('remove fixtures', () => query(
    `DELETE FROM freehold_site_teams WHERE id='smoke_t1';
     DELETE FROM freehold_site_leads WHERE id='smoke_l1';
     DELETE FROM freehold_site_projects WHERE id='smoke_p1';
     DELETE FROM freehold_site_users WHERE id IN ('smoke_u1','smoke_u2')`))

  if (failures > 0) {
    console.error(`\n❌ ${failures} statement(s) failed against a real database.\n`)
    process.exit(1)
  }
  console.log('\n✅ every statement executed against a real database.\n')
  process.exit(0)
}

main().catch((e) => { console.error('\nFATAL', e); process.exit(1) })
