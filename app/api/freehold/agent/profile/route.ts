import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import QRCode from 'qrcode'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getProfileByBroker, upsertProfile, type AgentProfileInput } from '@/lib/freehold/agent-profiles'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const brokerKey = (u: { brokerId?: string; email: string }) => u.brokerId || u.email

async function withLink(handle: string | null) {
  if (!handle) return { publicUrl: null, qrDataUrl: null }
  const publicUrl = `${getSiteUrl().replace(/\/$/, '')}/a/${handle}`
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 320, color: { dark: '#0f172a', light: '#ffffff' } })
  } catch { qrDataUrl = null }
  return { publicUrl, qrDataUrl }
}

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfileByBroker(brokerKey(user))
  const link = await withLink(profile?.handle ?? null)
  return NextResponse.json({ profile, ...link })
}

export async function PUT(req: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as AgentProfileInput
  const input: AgentProfileInput = {
    displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    projectSlugs: Array.isArray(body.projectSlugs) ? body.projectSlugs.map(String) : undefined,
  }

  try {
    const profile = await upsertProfile(brokerKey(user), input, user.name)
    const link = await withLink(profile.handle)
    return NextResponse.json({ profile, ...link })
  } catch {
    return NextResponse.json({ error: 'Could not save your bio link.' }, { status: 500 })
  }
}
