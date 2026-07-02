import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { getProfileByHandle } from '@/lib/freehold/agent-profiles'
import { checkRateLimit } from '@/lib/freehold/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public lead capture from an agent's bio page. Creates a CRM lead assigned to
// that agent (source "Bio Link"). Unauthenticated, so it's rate-limited by IP
// and the payload is strictly validated — no fields the caller can use to pick
// an arbitrary broker; assignment comes only from the resolved profile.

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params

  const rl = await checkRateLimit(`bio-lead:${clientIp(req)}`, { limit: 8, windowSec: 300 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many submissions — please try again shortly.', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const profile = await getProfileByHandle(handle)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    name?: string; phone?: string; email?: string; message?: string; interest?: string
  }
  const name = String(body.name ?? '').trim().slice(0, 120)
  const phone = String(body.phone ?? '').trim().slice(0, 40)
  const email = String(body.email ?? '').trim().slice(0, 160)
  if (!name || (!phone && !email)) {
    return NextResponse.json({ error: 'Name and a phone or email are required.' }, { status: 400 })
  }

  try {
    await query(
      `INSERT INTO freehold_site_leads
         (id, name, phone, email, source, status, priority, assigned_broker_id, interest, message)
       VALUES ($1, $2, $3, $4, 'Bio Link', 'new', 'warm', $5, $6, $7)`,
      [
        randomUUID(), name, phone || null, email || null, profile.brokerId,
        String(body.interest ?? '').trim().slice(0, 160) || null,
        String(body.message ?? '').trim().slice(0, 1000) || null,
      ],
    )
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not submit right now.' }, { status: 500 })
  }
}
