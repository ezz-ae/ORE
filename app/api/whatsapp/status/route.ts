export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getSessionState, startSession } from '@/lib/whatsapp/session'

// GET /api/whatsapp/status
// Returns current connection state. If disconnected, kicks off the connect flow.
export async function GET() {
  const state = getSessionState()

  // Auto-start if not connected and not already connecting
  if (state.status === 'disconnected') {
    startSession().catch(() => {}) // fire-and-forget
  }

  return NextResponse.json(state)
}
