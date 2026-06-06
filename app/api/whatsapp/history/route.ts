export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getMessages } from '@/lib/whatsapp/session'

// GET /api/whatsapp/history?phone=971501234567
export async function GET(req: Request) {
  const url = new URL(req.url)
  const phone = url.searchParams.get('phone') ?? ''
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })
  const messages = getMessages(phone)
  return NextResponse.json({ messages })
}
