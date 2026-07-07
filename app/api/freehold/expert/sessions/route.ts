import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listExpertSessions, deleteExpertSession } from '@/lib/freehold/expert-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The account's Expert conversations (summaries, newest first). */
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  return NextResponse.json({ sessions: await listExpertSessions(auth.user.email) })
}

/** Delete one conversation: DELETE /api/freehold/expert/sessions?id=… */
export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const ok = await deleteExpertSession(id, auth.user.email)
  return NextResponse.json({ ok })
}
