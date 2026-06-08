import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [spendRows, campaignRows] = await Promise.all([
      // Total ad spend from ad_spend_allocations
      query<{
        total_credits: string
        total_aed: string
        last_30d_credits: string
        last_30d_aed: string
        active_count: string
      }>(
        `SELECT
           COALESCE(SUM(credits_spent), 0)::text                                          AS total_credits,
           (COALESCE(SUM(credits_spent), 0) * 10)::text                                  AS total_aed,
           COALESCE(SUM(CASE WHEN created_at > now() - INTERVAL '30 days' THEN credits_spent ELSE 0 END), 0)::text AS last_30d_credits,
           (COALESCE(SUM(CASE WHEN created_at > now() - INTERVAL '30 days' THEN credits_spent ELSE 0 END), 0) * 10)::text AS last_30d_aed,
           COUNT(*) FILTER (WHERE status = 'active')::text                               AS active_count
         FROM ad_spend_allocations`,
        []
      ),
      // Recent campaigns
      query<{
        id: string
        broker_id: string
        campaign_id: string | null
        campaign_name: string | null
        credits_allocated: string
        credits_spent: string
        status: string
        created_at: string
      }>(
        `SELECT id, broker_id, campaign_id, campaign_name,
                credits_allocated::text, credits_spent::text, status, created_at::text
         FROM ad_spend_allocations
         ORDER BY created_at DESC
         LIMIT 50`,
        []
      ),
    ])

    const summary = spendRows[0] ?? {
      total_credits: '0', total_aed: '0',
      last_30d_credits: '0', last_30d_aed: '0', active_count: '0',
    }

    return NextResponse.json({
      totalSpendAED: parseInt(summary.total_aed, 10),
      last30dSpendAED: parseInt(summary.last_30d_aed, 10),
      activeCampaigns: parseInt(summary.active_count, 10),
      campaigns: campaignRows.map(r => ({
        id: r.id,
        brokerId: r.broker_id,
        campaignId: r.campaign_id,
        campaignName: r.campaign_name ?? 'Campaign',
        creditsAllocated: parseInt(r.credits_allocated, 10),
        creditsSpent: parseInt(r.credits_spent, 10),
        spendAED: parseInt(r.credits_spent, 10) * 10,
        status: r.status,
        createdAt: r.created_at,
      })),
      source: 'db',
    })
  } catch {
    return NextResponse.json({ error: 'DB unavailable', source: 'error' }, { status: 503 })
  }
}
