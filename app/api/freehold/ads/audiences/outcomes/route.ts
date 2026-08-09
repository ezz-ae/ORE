import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { audienceOutcomes } from '@/lib/freehold/audience-outcomes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * What each audience has actually brought back.
 *
 * The record of a name: campaigns run, leads, how many qualified, how many
 * closed — so the next audience is picked on evidence rather than on how well
 * it reads. Empty until something has been launched, and honestly empty: an
 * audience with no data is absent rather than shown as zeros it never earned.
 */
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  return NextResponse.json({ outcomes: await audienceOutcomes() })
}
