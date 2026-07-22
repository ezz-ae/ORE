/**
 * Vendor endpoint to mint and list white-label access keys.
 *
 * Gated by WL_ADMIN_SECRET (the vendor's secret), NOT a platform session —
 * this is how the owner issues keys out-of-band. Fails closed when the secret
 * is unset or the flag is off.
 */
import { NextRequest, NextResponse } from 'next/server'
import { WHITE_LABEL, wlAdminSecret } from '@/lib/whitelabel/config'
import { mintKeys, listKeys } from '@/lib/whitelabel/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorize(req: NextRequest): boolean {
  if (!WHITE_LABEL) return false
  const secret = wlAdminSecret()
  if (!secret) return false
  const provided = req.headers.get('x-wl-admin')?.trim() || ''
  return provided.length > 0 && provided === secret
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const keys = await listKeys().catch(() => [])
  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { count?: number; label?: string; expiresAt?: string | null }
  const count = Number(body.count ?? 1)
  const label = String(body.label ?? '').trim()
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null
  const keys = await mintKeys(count, label, expiresAt)
  return NextResponse.json({ keys })
}
