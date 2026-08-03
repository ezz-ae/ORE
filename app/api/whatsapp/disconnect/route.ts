export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { disconnectSession } from '@/lib/whatsapp/session'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'

// POST /api/whatsapp/disconnect  — logs out and deletes auth files.
// Destructive for the whole company channel → management only.
export async function POST() {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  await disconnectSession()
  return NextResponse.json({ ok: true })
}
