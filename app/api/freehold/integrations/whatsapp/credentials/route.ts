import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getStoredCreds, setStoredCreds, clearStoredCreds, type WhatsAppStoredCreds } from '@/lib/freehold/integration-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const
const GRAPH = 'https://graph.facebook.com/v18.0'

export async function GET() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json({ configured: true, source: 'env', phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID })
  }
  const stored = await getStoredCreds<WhatsAppStoredCreds>('whatsapp')
  return stored
    ? NextResponse.json({ configured: true, source: 'db', phoneNumberId: stored.phoneNumberId })
    : NextResponse.json({ configured: false, source: null })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as { accessToken?: string; phoneNumberId?: string }
  const accessToken = String(body.accessToken ?? '').trim()
  const phoneNumberId = String(body.phoneNumberId ?? '').trim()
  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: 'accessToken and phoneNumberId are required' }, { status: 400 })
  }

  // Validate: the token must read the phone number node before we store it.
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(accessToken)}`)
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: `Meta rejected the token/number: ${data?.error?.message ?? res.status}` }, { status: 400 })
    }
    await setStoredCreds('whatsapp', { accessToken, phoneNumberId } satisfies WhatsAppStoredCreds, auth.user.email)
    return NextResponse.json({ ok: true, phoneNumberId, displayNumber: data?.display_phone_number ?? null, name: data?.verified_name ?? null })
  } catch {
    return NextResponse.json({ error: 'Could not reach the WhatsApp Cloud API to validate the token' }, { status: 502 })
  }
}

export async function DELETE() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res
  await clearStoredCreds('whatsapp')
  return NextResponse.json({ ok: true })
}
