import { NextResponse } from 'next/server'
import { sendText } from '@/lib/whatsapp/client'

export async function POST(req: Request) {
  try {
    const { to, body } = await req.json() as { to: string; body: string }
    if (!to || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const result = await sendText({ to, body })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
