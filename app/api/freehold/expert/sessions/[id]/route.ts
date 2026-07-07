import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getExpertSession } from '@/lib/freehold/expert-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** One Expert conversation with its full history — owner-scoped. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const session = await getExpertSession(id, auth.user.email)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ session })
}
