import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Per-ACCOUNT preferences (theme, language, …) — the account remembers the
// user's settings across devices and sessions. Self-scoped: a user can only
// read/write their own prefs.

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_user_prefs (
      user_email text PRIMARY KEY,
      prefs      jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

// Only known keys are stored, so the table can't be used as arbitrary storage.
// Each key has a validator + size cap. `null` clears a key (e.g. a finished
// campaign draft). Everything a user does on the platform that should follow
// their ACCOUNT — not the browser — lives here.
const isSmallObject = (v: unknown, cap: number) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && JSON.stringify(v).length <= cap

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
  theme:  (v) => typeof v === 'string' && v.length <= 32,
  locale: (v) => typeof v === 'string' && v.length <= 32,
  // Highest changelog version the account has seen — "What's new" shows once
  // per account, not once per device.
  whatsNewSeen: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000,
  // Map of completed coach tours ({ [seenKey]: 1 }) — tours don't restart on
  // a new device once the account has done them.
  coachSeen: (v) => isSmallObject(v, 4096),
  // In-progress campaign wizard draft — resumes on any device; null clears it.
  campaignDraft: (v) => v === null || isSmallObject(v, 16384),
  // Expert side-panel layout.
  expertOpen:  (v) => typeof v === 'boolean',
  expertWidth: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 200 && v <= 2000,
  // Marked-as-connected catalog integrations on the Integrations hub.
  connectedIntegrations: (v) =>
    Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === 'string' && x.length <= 64),
  // Preferred payment method on Finance → Payments.
  defaultCard: (v) => typeof v === 'string' && v.length <= 64,
}

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await ensureOnce()
    const rows = await query<{ prefs: Record<string, unknown> }>(
      `SELECT prefs FROM freehold_site_user_prefs WHERE user_email = $1 LIMIT 1`, [user.email])
    return NextResponse.json({ prefs: rows[0]?.prefs ?? {} })
  } catch {
    return NextResponse.json({ prefs: {} })
  }
}

export async function PUT(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (VALIDATORS[k]?.(v)) patch[k] = v
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  try {
    await ensureOnce()
    await query(
      `INSERT INTO freehold_site_user_prefs (user_email, prefs, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_email) DO UPDATE
         SET prefs = freehold_site_user_prefs.prefs || $2::jsonb, updated_at = now()`,
      [user.email, JSON.stringify(patch)],
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not save preferences' }, { status: 500 })
  }
}
