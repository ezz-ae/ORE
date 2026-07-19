import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { syncAllMetaLeads } from '@/lib/freehold/meta-lead-sync'
import {
  subscribePageToLeadgenWebhook,
  getLeadgenSubscriptionStatus,
  MetaApiError,
  MetaConfigError,
} from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Operator-triggered lead sync — the same sweep as the nightly cron, but
 * behind the platform session instead of CRON_SECRET, so lead ingestion
 * never depends solely on a correctly configured cron env var (the exact
 * failure that silently stopped all form leads reaching the CRM). Also
 * re-asserts the Page's leadgen webhook subscription while it's at it.
 */
export async function POST() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  try {
    const [result, resubscribed] = await Promise.all([
      syncAllMetaLeads(),
      subscribePageToLeadgenWebhook()
        .then(() => true)
        .catch((error) => {
          console.error('[meta-forms-sync] leadgen webhook re-subscribe failed', error)
          return false
        }),
    ])
    return NextResponse.json({ ok: true, resubscribed, ...result })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}

/**
 * Real-time sync health: is the Page's `leadgen` webhook field actually
 * subscribed for this app right now? Read live from Meta — never assumed.
 */
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  try {
    const status = await getLeadgenSubscriptionStatus()
    return NextResponse.json({ connected: true, ...status })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ connected: false, subscribed: false })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
