/**
 * THE DEVICE KEYS ON A PERSON'S WALLET.
 *
 * GET    — the keys they have, so a screen can say which device is which.
 * POST   — enrol this device. The first is trusted on the session; a second
 *          must be vouched for by a key already on file.
 * DELETE — revoke one. Authorised by the SESSION rather than by the key being
 *          revoked, because the case this exists for is a lost laptop and the
 *          key is exactly what is unavailable.
 *
 * A person may only ever touch their own keys: the user id comes from the
 * session and there is no parameter that could name somebody else. An endpoint
 * that let one person enrol a key against another's wallet would be a way to
 * sign as them, which is worse than having no signatures at all.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { personId } from '@/lib/freehold/bank-db'
import { activeKeys, registerKey, revokeKey } from '@/lib/freehold/wallet-signing-db'
import { keyFingerprint } from '@/lib/freehold/wallet-signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  try {
    const keys = await activeKeys(personId(auth.user))
    return NextResponse.json({
      keys: keys.map((k) => ({ ...k, fingerprint: keyFingerprint(k.publicKey) })),
      // The screen needs this to know whether to demand a signature, and it must
      // match what the server will enforce — so it is the server that says it.
      signingRequired: keys.length > 0,
    })
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const publicKey = String(body.publicKey ?? '')
  const label = String(body.label ?? 'This device')
  const proof = body.proof && typeof body.proof === 'object'
    ? {
        payload: String((body.proof as Record<string, unknown>).payload ?? ''),
        signature: String((body.proof as Record<string, unknown>).signature ?? ''),
      }
    : undefined

  const r = await registerKey({ userId: personId(auth.user), publicKey, label, proof })
  return r.ok
    ? NextResponse.json({ ok: true, first: r.first, fingerprint: keyFingerprint(publicKey) })
    : NextResponse.json({ error: r.refusal }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const publicKey = req.nextUrl.searchParams.get('publicKey') ?? ''
  const done = await revokeKey(personId(auth.user), publicKey)
  return done
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'noKey' }, { status: 404 })
}
