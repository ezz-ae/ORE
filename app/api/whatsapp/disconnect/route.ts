export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { disconnectSession } from '@/lib/whatsapp/session'

// POST /api/whatsapp/disconnect  — logs out and deletes auth files
export async function POST() {
  await disconnectSession()
  return NextResponse.json({ ok: true })
}
