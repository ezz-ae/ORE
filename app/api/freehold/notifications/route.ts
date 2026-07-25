import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { listNotifications, markAllRead } from '@/lib/freehold/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → this user's feed + unread count. POST {markAllRead:true} → clear.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const keys = [user.id, user.email].filter(Boolean) as string[]
  const notifications = await listNotifications(keys)
  return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read).length })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (body?.markAllRead) {
    await markAllRead(user.id)
    if (user.email) await markAllRead(user.email)
  }
  return NextResponse.json({ ok: true })
}
