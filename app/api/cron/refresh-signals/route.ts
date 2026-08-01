import { NextRequest, NextResponse } from 'next/server'
import { refreshLiveTenantSignals } from '@/lib/entrestate/targeting-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Nightly refresh of the LIVE tenant's targeting signals (Vercel Cron).
 *
 * The targeting base is the network-intelligence layer every campaign plan
 * reads (ads_plan_campaign, the machine's planner, targeting-recommend). Its
 * seed aggregates are static imports, but the `-live` tenant slice — this
 * account's OWN lead outcomes folded into the signals — was refreshed only as
 * a side effect of a manual base import. Nobody imports the base twice, so in
 * practice the live slice froze at whatever the last manual action left there,
 * and every new day of real leads taught the planner nothing.
 *
 * Runs at 02:45, before the opportunity scorer (03:30) and the ads-machine
 * cycles (04:00), so both consume signals that include yesterday's outcomes.
 * Auth mirrors the sibling crons: CRON_SECRET bearer.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  try {
    await refreshLiveTenantSignals()
    return NextResponse.json({ ok: true, refreshed: 'live-tenant-signals' })
  } catch (err) {
    console.error('[cron/refresh-signals] failed', err)
    return NextResponse.json({ error: 'Signal refresh failed.' }, { status: 500 })
  }
}
