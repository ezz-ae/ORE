import { NextRequest, NextResponse } from 'next/server'
import { listMachines } from '@/lib/freehold/ads-machine'
import { runMachineCycle } from '@/lib/freehold/ads-machine-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily Ads Machine heartbeat (Vercel Cron). Every RUNNING machine gets one
 * cycle: launch planned trials (under the hard cap), evaluate real results,
 * create broker feedback questions, and rotate condemned trials. Failures are
 * isolated per machine — one broken machine never stops the others.
 * Auth mirrors app/api/cron/sync-meta-leads: CRON_SECRET bearer token.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let machines
  try {
    machines = await listMachines()
  } catch {
    // DB unreachable — nothing can cycle; honest empty run, not a fake success.
    return NextResponse.json({ ok: false, error: 'Machine store unavailable' }, { status: 500 })
  }

  const running = machines.filter((m) => m.status === 'running')
  const results: Array<{ machineId: string; ok: boolean; error?: string; summary?: unknown }> = []
  for (const machine of running) {
    try {
      const cycle = await runMachineCycle(machine.id)
      results.push({
        machineId: machine.id,
        ok: true,
        summary: {
          launched: cycle.launched.length,
          capSkipped: cycle.capSkipped.length,
          observed: cycle.observed,
          verdictRequestsCreated: cycle.verdictRequestsCreated,
          paused: cycle.paused.length,
          budgetShifts: cycle.budgetShifts.length,
          errors: cycle.errors,
        },
      })
    } catch (err) {
      results.push({
        machineId: machine.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ ok: true, machinesCycled: running.length, results })
}
