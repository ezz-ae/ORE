import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  getStoredMetaCreds,
  setStoredMetaCreds,
  clearStoredMetaCreds,
} from '@/lib/freehold/integration-credentials'
import { subscribeAllPagesToLeadgen } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Connecting the company ad account is a management+marketing capability.
const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const

const GRAPH = 'https://graph.facebook.com/v20.0'

/** Report connection state — never returns the token itself. */
export async function GET() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const envConfigured = !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID && process.env.META_PAGE_ID)
  if (envConfigured) {
    return NextResponse.json({
      configured: true,
      source: 'env',
      adAccountId: process.env.META_AD_ACCOUNT_ID,
      pageId: process.env.META_PAGE_ID,
    })
  }
  const stored = await getStoredMetaCreds()
  if (stored) {
    return NextResponse.json({
      configured: true,
      source: 'db',
      adAccountId: stored.adAccountId,
      pageId: stored.pageId,
    })
  }
  return NextResponse.json({ configured: false, source: null })
}

/** Save the connection made in the UI so server-side launches can use it. */
export async function POST(req: NextRequest) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as {
    accessToken?: string; adAccountId?: string; pageId?: string; pixelId?: string; crmDatasetId?: string
  }
  const accessToken = String(body.accessToken ?? '').trim()
  const adAccountId = String(body.adAccountId ?? '').trim()
  const pageId = String(body.pageId ?? '').trim()
  if (!accessToken || !adAccountId || !pageId) {
    return NextResponse.json({ error: 'accessToken, adAccountId and pageId are required' }, { status: 400 })
  }

  // Validate against Graph before storing: the token must be able to read the
  // chosen ad account — otherwise launches would fail later anyway.
  try {
    const acct = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
    const res = await fetch(`${GRAPH}/${acct}?fields=id,name,account_status&access_token=${encodeURIComponent(accessToken)}`)
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: `Meta rejected the token/account: ${data?.error?.message ?? res.status}` },
        { status: 400 },
      )
    }
    await setStoredMetaCreds(
      {
        accessToken, adAccountId: acct, pageId,
        pixelId: body.pixelId?.trim() || null,
        // The CRM dataset that lead OUTCOMES go to — distinct from the browser
        // pixel above, and the one Conversion Leads optimisation reads.
        crmDatasetId: body.crmDatasetId?.trim() || null,
      },
      auth.user.email,
    )
    // Subscribe the Page's leadgen webhook right at connect time — until now
    // this only ever happened inside the CRON_SECRET-gated nightly job, so a
    // misconfigured cron meant real-time lead push was never established at
    // all. Best-effort: a subscribe failure must not fail the connect.
    // Every accessible Page, not only the configured one: forms live on Pages,
    // and a Page that is never subscribed never pushes a lead.
    const subs = await subscribeAllPagesToLeadgen()
      .catch((error) => {
        console.warn('[meta-credentials] leadgen webhook subscribe failed (non-fatal)', error)
        return { subscribed: 0, failed: [] as { pageId: string; pageName: string | null; error: string }[] }
      })
    return NextResponse.json({
      ok: true, adAccountId: acct, accountName: data?.name ?? null,
      leadgenSubscribed: subs.subscribed > 0,
      pagesSubscribed: subs.subscribed,
    })
  } catch {
    return NextResponse.json({ error: 'Could not reach the Meta API to validate the token' }, { status: 502 })
  }
}

export async function DELETE() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res
  await clearStoredMetaCreds()
  return NextResponse.json({ ok: true })
}
