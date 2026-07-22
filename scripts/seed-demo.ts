/**
 * Demo seed for the WHITE-LABEL deployment.
 *
 * Fills the app's real tables with a realistic dataset so every screen looks
 * alive the moment a prospect enters (CRM leads + pipeline, deals, finance,
 * inventory, tasks, calendar, team, activity, ad campaigns, credits).
 *
 * SAFETY: refuses to run unless NEXT_PUBLIC_WHITE_LABEL=1 (pass --allow-prod to
 * override deliberately). Idempotent: a one-time sentinel (the demo CEO user)
 * skips a re-run; `--reset` deletes the demo rows first, then re-seeds.
 *
 * It reuses the app's OWN create/ensure functions (createDeal, createFinanceEntry,
 * createTask, createEvent, ensure*Table) so schema + derived fields always match
 * the product — no duplicated DDL, no drift. Only the two campaign tables and the
 * activity log (trivial, stable schemas) are created + inserted directly.
 *
 * Run:  NEXT_PUBLIC_WHITE_LABEL=1 DATABASE_URL=… pnpm seed:demo
 *       …pnpm seed:demo --reset      (wipe demo rows, then seed)
 */
import { query } from '../lib/db.js'
import { ensureLeadsTable, ensureLeadActivityTable, ensureProjectsTable, ensureUsersTable } from '../lib/data.js'
import { ensureCreditsSchema } from '../lib/freehold/credits-db.js'
import { createDeal } from '../lib/deals.js'
import { createFinanceEntry } from '../lib/finance.js'
import { createTask, updateTaskStatus } from '../lib/tasks.js'
import { createEvent, type Viewer } from '../lib/calendar.js'
import type { TaskStatus } from '../lib/tasks.js'
import type { CalendarKind } from '../lib/calendar.js'
import type { FinanceCategory } from '../lib/finance-shared.js'

const args = new Set(process.argv.slice(2))
const RESET = args.has('--reset')
const ALLOW_PROD = args.has('--allow-prod')
const WL = process.env.NEXT_PUBLIC_WHITE_LABEL === '1'
const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL)

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}
if (!WL && !ALLOW_PROD) {
  die('Refusing to seed: NEXT_PUBLIC_WHITE_LABEL is not "1". This is for the white-label demo only.\n  Pass --allow-prod only if you REALLY mean to seed this database.')
}
if (!HAS_DB) die('No database configured (set DATABASE_URL or NEON_DATABASE_URL).')

// ── helpers ──────────────────────────────────────────────────────────────────
const now = Date.now()
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()
const daysAhead = (d: number) => new Date(now + d * 86_400_000).toISOString()
const pic = (seed: string) => `https://picsum.photos/seed/${seed}/1200/800`
const round = (n: number) => Math.round(n)
const rnd = (i: number, mod: number, add = 0) => ((i * 2654435761) % mod) + add

async function safe(label: string, fn: () => Promise<unknown>) {
  try { await fn() } catch (e) { console.error(`  ! ${label}:`, e instanceof Error ? e.message : e) }
}

// ── team ─────────────────────────────────────────────────────────────────────
const TEAM = [
  { key: 'ceo',    name: 'Omar Al Fardan', role: 'ceo',           title: 'Chief Executive',   comm: 0 },
  { key: 'mgr',    name: 'Layla Haddad',   role: 'sales_manager', title: 'Head of Sales',     comm: 15 },
  { key: 'dir',    name: 'Rashid Nasser',  role: 'director',      title: 'Managing Director', comm: 10 },
  { key: 'mkt',    name: 'Nadia Kassab',   role: 'marketing',     title: 'Marketing Lead',    comm: 0 },
  { key: 'sara',   name: 'Sara Mansour',   role: 'broker',        title: 'Senior Advisor',    comm: 50 },
  { key: 'khaled', name: 'Khaled Aziz',    role: 'broker',        title: 'Property Advisor',  comm: 50 },
  { key: 'yara',   name: 'Yara Suleiman',  role: 'broker',        title: 'Property Advisor',  comm: 45 },
  { key: 'tariq',  name: 'Tariq Habib',    role: 'broker',        title: 'Property Advisor',  comm: 45 },
]
const email = (key: string) => `${key}@demo.co`
const brokers = TEAM.filter((t) => t.role === 'broker')
const byKey = (k: string) => TEAM.find((t) => t.key === k)!

// ── projects / inventory ─────────────────────────────────────────────────────
const PROJECTS = [
  { slug: 'demo-marina-vista',       name: 'Marina Vista',        area: 'Dubai Marina',            dev: 'Emaar',   from: 1_650_000, to: 4_200_000,  yld: 6.4, gv: true,  feat: true },
  { slug: 'demo-creek-horizon',      name: 'Creek Horizon',       area: 'Dubai Creek Harbour',     dev: 'Emaar',   from: 1_320_000, to: 3_100_000,  yld: 6.1, gv: true,  feat: true },
  { slug: 'demo-palm-residences',    name: 'Palm Residences',     area: 'Palm Jumeirah',           dev: 'Nakheel', from: 3_400_000, to: 12_500_000, yld: 5.2, gv: true,  feat: true },
  { slug: 'demo-downtown-lofts',     name: 'Downtown Lofts',      area: 'Downtown Dubai',          dev: 'Emaar',   from: 1_900_000, to: 5_600_000,  yld: 5.8, gv: true,  feat: false },
  { slug: 'demo-jvc-gardens',        name: 'JVC Gardens',         area: 'Jumeirah Village Circle', dev: 'Nshama',  from: 720_000,   to: 1_450_000,  yld: 7.9, gv: false, feat: false },
  { slug: 'demo-business-bay-tower',  name: 'Business Bay Tower',  area: 'Business Bay',            dev: 'DAMAC',   from: 1_100_000, to: 3_800_000,  yld: 6.7, gv: true,  feat: false },
  { slug: 'demo-hills-estate',       name: 'The Hills Estate',    area: 'Dubai Hills',             dev: 'Emaar',   from: 2_600_000, to: 9_200_000,  yld: 5.5, gv: true,  feat: false },
  { slug: 'demo-maritime-city',      name: 'Maritime City Views', area: 'Dubai Maritime City',     dev: 'Sobha',   from: 1_480_000, to: 4_000_000,  yld: 6.3, gv: true,  feat: false },
]

// ── leads distribution ───────────────────────────────────────────────────────
const FIRST = ['Ahmed', 'Fatima', 'Mohammed', 'Aisha', 'Ali', 'Mariam', 'Hassan', 'Noor', 'Yousef', 'Salma', 'Ibrahim', 'Huda', 'Karim', 'Reem', 'Sami', 'Dana', 'Faisal', 'Lina', 'Tariq', 'Maya']
const LAST = ['Khan', 'Ahmadi', 'Saleh', 'Farouk', 'Bakr', 'Nasser', 'Rahman', 'Darwish', 'Qureshi', 'Hamdan']
const SOURCES = ['Meta Ads', 'Google Ads', 'Website', 'Referral', 'WhatsApp', 'Property Finder']
const COUNTRIES = ['United Arab Emirates', 'Saudi Arabia', 'India', 'United Kingdom', 'Egypt', 'Pakistan']
const PRIORITIES = ['hot', 'warm', 'cold']
const LEAD_COUNT = 54
function leadStatus(i: number): string {
  const b = i % 20
  if (b < 4) return 'new'; if (b < 8) return 'contacted'; if (b < 11) return 'qualified'
  if (b < 14) return 'viewing'; if (b < 16) return 'negotiation'; if (b < 18) return 'converted'
  if (b < 19) return 'closed'; return 'lost'
}

interface SeedLead { id: string; name: string; phone: string; status: string; broker: string; projectSlug: string; projectName: string; developer: string; value: number }

// ── reset ────────────────────────────────────────────────────────────────────
async function reset() {
  console.log('• Reset demo rows…')
  const stmts = [
    `DELETE FROM freehold_site_lead_activity WHERE id LIKE 'demo-%'`,
    `DELETE FROM freehold_site_calendar_events WHERE created_by LIKE '%@demo.co'`,
    `DELETE FROM freehold_site_deals WHERE lead_id LIKE 'demo-%' OR created_by LIKE '%@demo.co'`,
    `DELETE FROM freehold_site_finance_entries WHERE created_by LIKE '%@demo.co'`,
    `DELETE FROM freehold_site_tasks WHERE created_by LIKE '%@demo.co'`,
    `DELETE FROM freehold_site_activity_log WHERE id LIKE 'demo-%'`,
    `DELETE FROM freehold_site_meta_campaigns WHERE id LIKE 'demo-%'`,
    `DELETE FROM freehold_site_google_campaigns WHERE id LIKE 'demo-%'`,
    `DELETE FROM ad_spend_allocations WHERE id LIKE 'demo-%'`,
    `DELETE FROM credit_ledger WHERE id LIKE 'demo-%'`,
    `DELETE FROM broker_credit_accounts WHERE broker_id LIKE '%@demo.co'`,
    `DELETE FROM freehold_site_leads WHERE id LIKE 'demo-%'`,
    `DELETE FROM freehold_site_projects WHERE slug LIKE 'demo-%'`,
    `DELETE FROM freehold_site_users WHERE email LIKE '%@demo.co'`,
  ]
  for (const s of stmts) await safe('reset', () => query(s))
}

// ── seed steps ───────────────────────────────────────────────────────────────
async function seedTeam() {
  console.log('• Team…')
  for (const [i, m] of TEAM.entries()) {
    await safe('user', () => query(
      `INSERT INTO freehold_site_users (id, name, email, role, org_title, phone, commission_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO NOTHING`,
      [`demo-user-${m.key}`, m.name, email(m.key), m.role, m.title, `+9715${rnd(i, 9000000, 1000000)}`, m.comm],
    ))
  }
}

async function seedProjects() {
  console.log('• Projects / inventory…')
  for (const [i, p] of PROJECTS.entries()) {
    const score = 72 + rnd(i, 23)
    const payload = {
      slug: p.slug, name: p.name, area: p.area, developer: p.dev, developerName: p.dev, status: 'available',
      priceFromAed: p.from, priceToAed: p.to, heroImage: pic(p.slug),
      images: [pic(`${p.slug}-1`), pic(`${p.slug}-2`), pic(`${p.slug}-3`)],
      description: `${p.name} by ${p.dev} — a signature address in ${p.area} with strong rental demand.`,
      amenities: ['Infinity pool', 'Smart home', 'Concierge', 'Gym', 'Kids play area', 'Retail podium'],
      rentalYield: p.yld, marketScore: score, handoverDate: `Q${(i % 4) + 1} ${2026 + (i % 3)}`,
      paymentPlan: '60/40 post-handover', goldenVisaEligible: p.gv, featured: p.feat, roi: p.yld,
    }
    await safe('project', () => query(
      `INSERT INTO freehold_site_projects
        (id, slug, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed,
         market_score, rental_yield, golden_visa_eligible, featured, payload)
       VALUES ($1,$2,$3,$4,'available',$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (slug) DO NOTHING`,
      [`demo-proj-${i}`, p.slug, p.name, p.area, p.dev, pic(p.slug), p.from, p.to, score, p.yld, p.gv, p.feat, JSON.stringify(payload)],
    ))
  }
}

async function seedLeads(): Promise<SeedLead[]> {
  console.log('• Leads + activity…')
  const out: SeedLead[] = []
  for (let i = 0; i < LEAD_COUNT; i++) {
    const id = `demo-lead-${String(i + 1).padStart(4, '0')}`
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`
    const status = leadStatus(i)
    const broker = brokers[i % brokers.length]
    const proj = PROJECTS[i % PROJECTS.length]
    const created = daysAgo(rnd(i, 55, 1))
    const value = proj.from + rnd(i, Math.max(1, proj.to - proj.from))
    const phone = `+9715${rnd(i, 9000000, 1000000)}`
    await safe('lead', () => query(
      `INSERT INTO freehold_site_leads
        (id, name, phone, email, source, status, priority, assigned_broker_id, interest,
         budget_aed, message, project_slug, country, created_at, last_contact_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING`,
      [id, name, phone, `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`, SOURCES[i % SOURCES.length],
       status, PRIORITIES[i % 3], email(broker.key), proj.name, round(value),
       `Interested in ${proj.name} (${proj.area}).`, proj.slug, COUNTRIES[i % COUNTRIES.length], created, created],
    ))
    const acts = ['created', 'contacted', status === 'viewing' || status === 'negotiation' ? 'viewing_scheduled' : 'note']
    for (let a = 0; a <= i % 3; a++) {
      await safe('activity', () => query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [`demo-act-${id}-${a}`, id, acts[a], `${acts[a]} — ${name}`, email(broker.key), daysAgo(rnd(i + a, 50, 1))],
      ))
    }
    out.push({ id, name, phone, status, broker: broker.key, projectSlug: proj.slug, projectName: proj.name, developer: proj.dev, value })
  }
  return out
}

async function seedDeals(leads: SeedLead[]) {
  console.log('• Deals…')
  const won = leads.filter((l) => l.status === 'converted' || l.status === 'closed')
  const pending = leads.filter((l) => l.status === 'negotiation').slice(0, 3)
  let count = 0
  const mk = async (l: SeedLead, mgmt: boolean, paid: boolean) => {
    const broker = byKey(l.broker)
    await safe('deal', async () => {
      const deal = await createDeal(
        {
          leadId: l.id, leadName: l.name, clientPhone: l.phone,
          projectSlug: l.projectSlug, projectName: l.projectName, developerName: l.developer,
          agentId: email(broker.key), agentName: broker.name, agentSharePct: broker.comm,
          propertyValueAed: l.value, agencyCommissionPct: 2, referralCommissionPct: 0.2, cashbackPct: 0.1,
          notes: `${l.projectName} — demo deal`,
        },
        { id: email(mgmt ? 'ceo' : broker.key), name: broker.name, role: mgmt ? 'ceo' : 'broker' },
      )
      if (paid) {
        await query(
          `UPDATE freehold_site_deals SET payment_status='paid', commission_received_aed=net_commission_aed, updated_at=now() WHERE id=$1`,
          [deal.id],
        )
      }
      count++
    })
  }
  for (const [i, l] of won.entries()) await mk(l, true, i % 2 === 0)
  for (const l of pending) await mk(l, false, false)
  return count
}

async function seedFinance() {
  console.log('• Finance…')
  const rows: [FinanceCategory, string, number, string, 'paid' | 'pending', number][] = [
    ['ad_spend', 'Meta Ads — Marina Vista launch', 42_000, 'Meta Platforms', 'paid', 8],
    ['ad_spend', 'Google Ads — brand + search', 28_500, 'Google Ads', 'paid', 8],
    ['ad_spend', 'Meta Ads — Creek Horizon retarget', 18_200, 'Meta Platforms', 'pending', 2],
    ['salary', 'Team payroll — this cycle', 186_000, 'Payroll', 'paid', 5],
    ['commission', 'Broker commissions payout', 94_500, 'Brokers', 'paid', 6],
    ['expense', 'Office rent — Business Bay', 55_000, 'JLL', 'paid', 10],
    ['expense', 'CRM + software subscriptions', 7_800, 'Vendors', 'paid', 12],
    ['transportation', 'Client viewings — fleet & fuel', 4_300, 'Fleet', 'pending', 1],
    ['referral', 'Referral payout — Palm Residences', 12_000, 'Partner', 'pending', 3],
    ['other', 'Roadshow — DIFC event', 22_000, 'Events', 'paid', 15],
    ['ad_spend', 'Property Finder — featured listings', 9_600, 'Property Finder', 'paid', 9],
    ['expense', 'Marketing collateral & print', 3_400, 'Print House', 'paid', 11],
  ]
  for (const [category, description, amountAed, payee, status, day] of rows) {
    await safe('finance', () => createFinanceEntry(
      { category, description, amountAed, payee, status, entryDate: daysAgo(day).slice(0, 10) },
      { id: email('dir') },
    ))
  }
}

async function seedTasks() {
  console.log('• Tasks…')
  const rows: [string, string, string, TaskStatus, number][] = [
    ['Follow up with Palm Residences hot leads', 'sara', 'critical', 'in_progress', 1],
    ['Prepare Marina Vista launch deck', 'mkt', 'high', 'in_progress', 2],
    ['Reconcile ad spend vs credits', 'dir', 'high', 'open', 3],
    ['Approve pending broker deals', 'mgr', 'high', 'open', 0],
    ['Schedule Creek Horizon viewings', 'khaled', 'medium', 'open', 4],
    ['Renew Property Finder featured slots', 'mkt', 'medium', 'blocked', 5],
    ['Onboard new advisor — paperwork', 'dir', 'low', 'open', 7],
    ['Close JVC Gardens negotiation', 'yara', 'critical', 'in_progress', 1],
    ['QBR deck for management', 'mgr', 'medium', 'done', -2],
    ['Update CRM pipeline hygiene', 'tariq', 'low', 'done', -1],
  ]
  for (const [title, who, priority, status, off] of rows) {
    await safe('task', async () => {
      const task = await createTask(
        { title, description: `${title} — demo task.`, assignee: email(who), priority: priority as never, dueDate: (off >= 0 ? daysAhead(off) : daysAgo(-off)).slice(0, 10) },
        { id: email('mgr') },
      )
      if (status !== 'open') await updateTaskStatus(task.id, status)
    })
  }
}

async function seedCalendar(leads: SeedLead[]) {
  console.log('• Calendar…')
  const rows: [string, CalendarKind, number, number][] = [
    ['Viewing — Marina Vista penthouse', 'viewing', 1, 1],
    ['Viewing — Palm Residences villa', 'viewing', 2, 1],
    ['Team sales stand-up', 'team_meeting', 0, 1],
    ['Client meeting — Creek Horizon', 'meeting', 3, 1],
    ['DIFC investor roadshow', 'roadshow', 6, 5],
    ['New advisor onboarding training', 'training', 4, 3],
    ['Viewing — Downtown Lofts', 'viewing', 2, 1],
    ['Management QBR', 'meeting', 5, 2],
    ['Viewing — Business Bay Tower', 'viewing', -1, 1],
    ['Weekly marketing review', 'team_meeting', 7, 1],
  ]
  for (const [i, [title, kind, off, dur]] of rows.entries()) {
    const startsAt = off >= 0 ? daysAhead(off) : daysAgo(-off)
    const endsAt = new Date(new Date(startsAt).getTime() + dur * 3_600_000).toISOString()
    const broker = brokers[i % brokers.length]
    const lead = leads[i % leads.length]
    const viewer: Viewer = { key: email(broker.key), email: email(broker.key), name: broker.name, role: 'broker', brokerKey: email(broker.key) }
    await safe('event', () => createEvent(
      { title, description: `${title} — demo event.`, kind, startsAt, endsAt, location: 'Dubai', leadId: lead.id, brokerId: email(broker.key), projectSlug: lead.projectSlug },
      viewer,
    ))
  }
}

async function seedActivityLog() {
  console.log('• Activity log…')
  await safe('ddl', () => query(
    `CREATE TABLE IF NOT EXISTS freehold_site_activity_log (
       id text PRIMARY KEY, user_id text, action text, metadata jsonb, created_at timestamptz DEFAULT now())`,
  ))
  const actions = ['login', 'lead_created', 'deal_created', 'deal_approved', 'campaign_launched', 'finance_entry_added', 'task_completed', 'viewing_scheduled']
  for (let i = 0; i < 18; i++) {
    const who = TEAM[i % TEAM.length]
    await safe('log', () => query(
      `INSERT INTO freehold_site_activity_log (id, user_id, action, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [`demo-log-${String(i + 1).padStart(2, '0')}`, email(who.key), actions[i % actions.length], JSON.stringify({ by: who.name }), daysAgo(rnd(i, 14))],
    ))
  }
}

async function seedCampaigns() {
  console.log('• Ad campaigns…')
  for (const t of ['freehold_site_meta_campaigns', 'freehold_site_google_campaigns']) {
    await safe('ddl', () => query(
      `CREATE TABLE IF NOT EXISTS ${t} (
         id text PRIMARY KEY, status text NOT NULL, data jsonb NOT NULL, created_by text, created_at timestamptz NOT NULL DEFAULT now())`,
    ))
  }
  const meta = [
    { name: 'Marina Vista — Lead Gen', obj: 'OUTCOME_LEADS', status: 'ACTIVE', budget: 1500, impr: 184_320, spend: 42_000, leads: 96 },
    { name: 'Creek Horizon — Retarget', obj: 'OUTCOME_LEADS', status: 'ACTIVE', budget: 900, impr: 98_110, spend: 18_200, leads: 41 },
    { name: 'Palm Residences — Awareness', obj: 'OUTCOME_AWARENESS', status: 'PAUSED', budget: 700, impr: 61_540, spend: 9_800, leads: 12 },
  ]
  for (const [i, c] of meta.entries()) {
    const data = { id: `demo-meta-${i}`, name: c.name, status: c.status, objective: c.obj, daily_budget: String(c.budget * 100), created_time: daysAgo(20), start_time: daysAgo(20), insights: { impressions: c.impr, spend: String(c.spend), clicks: round(c.impr * 0.021), leads_count: c.leads, cpl: round(c.spend / Math.max(1, c.leads)) } }
    await safe('meta', () => query(
      `INSERT INTO freehold_site_meta_campaigns (id, status, data, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [`demo-meta-${i}`, c.status, JSON.stringify(data), email('mkt')],
    ))
  }
  const M = 1_000_000
  const google = [
    { name: 'Dubai Off-Plan — Search', type: 'SEARCH', status: 'ENABLED', budget: 1200, impr: 74_200, clicks: 3_120, cost: 26_800, conv: 58 },
    { name: 'Brand — Freehold', type: 'SEARCH', status: 'ENABLED', budget: 400, impr: 22_900, clicks: 1_840, cost: 6_400, conv: 39 },
  ]
  for (const [i, c] of google.entries()) {
    const data = { id: `demo-goog-${i}`, resourceName: `customers/demo/campaigns/demo-goog-${i}`, name: c.name, status: c.status, type: c.type, biddingStrategyType: 'MAXIMIZE_CONVERSIONS', dailyBudgetMicros: c.budget * M, startDate: daysAgo(25).slice(0, 10), metrics: { impressions: c.impr, clicks: c.clicks, costMicros: c.cost * M, conversions: c.conv, conversionsValue: c.conv * 1200, ctr: c.clicks / c.impr, averageCpcMicros: round((c.cost * M) / c.clicks) } }
    await safe('google', () => query(
      `INSERT INTO freehold_site_google_campaigns (id, status, data, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [`demo-goog-${i}`, c.status, JSON.stringify(data), email('mkt')],
    ))
  }
}

async function seedCredits() {
  console.log('• Credits & ad-spend…')
  await safe('credits-ddl', () => ensureCreditsSchema())
  for (const [i, b] of brokers.entries()) {
    const bid = email(b.key)
    const allocated = 5000 + rnd(i, 5000)
    const spent = round(allocated * 0.4)
    await safe('credit-acct', () => query(
      `INSERT INTO broker_credit_accounts (broker_id, user_id, tier, allocated, cycle_start, cycle_end, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now(), now()) ON CONFLICT (broker_id) DO NOTHING`,
      [bid, bid, i === 0 ? 'Pro' : 'Starter', allocated, daysAgo(20), daysAhead(10)],
    ))
    await safe('ledger', () => query(
      `INSERT INTO credit_ledger (id, broker_id, type, amount, note, created_by, created_at)
       VALUES ($1,$2,'allocation',$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [`demo-cl-${b.key}-a`, bid, allocated, 'Monthly allocation', email('dir'), daysAgo(20)],
    ))
    await safe('ledger', () => query(
      `INSERT INTO credit_ledger (id, broker_id, type, amount, note, created_by, created_at)
       VALUES ($1,$2,'spend',$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [`demo-cl-${b.key}-s`, bid, -spent, 'Ad spend', bid, daysAgo(rnd(i, 15, 1))],
    ))
    await safe('alloc', () => query(
      `INSERT INTO ad_spend_allocations (id, broker_id, campaign_id, campaign_name, credits_allocated, credits_spent, daily_cap, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [`demo-alloc-${b.key}`, bid, `demo-meta-${i % 3}`, PROJECTS[i % PROJECTS.length].name, allocated, spent, 500],
    ))
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🌱 Seeding demo dataset${RESET ? ' (--reset)' : ''}…\n`)

  // Make sure the tables we raw-insert into exist (the create-function tables
  // self-ensure). ensure* are the app's own, so no schema drift.
  await safe('ensure', () => Promise.all([
    ensureUsersTable(), ensureProjectsTable(), ensureLeadsTable(), ensureLeadActivityTable(),
  ]))

  if (RESET) await reset()

  // Idempotency sentinel: skip if already seeded (unless --reset just cleared it).
  const seeded = await query<{ one: number }>(`SELECT 1 AS one FROM freehold_site_users WHERE email = $1 LIMIT 1`, [email('ceo')]).catch(() => [])
  if (seeded.length && !RESET) {
    console.log('• Already seeded — pass --reset to wipe and re-seed. Nothing to do.\n')
    process.exit(0)
  }

  await seedTeam()
  await seedProjects()
  const leads = await seedLeads()
  const dealCount = await seedDeals(leads)
  await seedFinance()
  await seedTasks()
  await seedCalendar(leads)
  await seedActivityLog()
  await seedCampaigns()
  await seedCredits()

  console.log(`\n✓ Done — ${TEAM.length} team · ${PROJECTS.length} projects · ${leads.length} leads · ${dealCount} deals · finance/tasks/calendar/campaigns/credits.\n`)
  process.exit(0)
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)))
