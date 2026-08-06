/**
 * The Lead Machine, in one read.
 *
 * The hub used to open with inventory readiness — how many projects have a
 * landing page, what their data-quality score is. Useful, and not the subject.
 * The subject is a machine making decisions with money, and none of that was
 * on the page: not whether it is running, not what it spent, not what it did
 * last night, not what it is waiting on.
 *
 * Everything here already existed. It was three clicks deep inside a machine
 * detail page, which is the same as not existing for anyone deciding whether
 * to trust it.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  listMachines, listActivity, listMachineCampaigns, activeSpendAed,
  type ActivityKind, type MachineActivity,
} from '@/lib/freehold/ads-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/**
 * Things the machine DID — a choice it made and acted on. These are the
 * entries worth showing on a hub, because each one is the machine spending or
 * withholding money and saying why.
 */
const DECISIONS: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'launched', 'budget_shift', 'trial_paused', 'trial_resumed', 'planned', 'google_draft_prepared',
])

/**
 * Things the machine CANNOT fix by itself. Separated from decisions because
 * they need a different response: a decision is read, an alarm is acted on.
 */
const ALARMS: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'permit_blocked', 'permit_warning', 'delivery_blocked', 'machine_stalled',
  'creative_fatigue', 'placement_drain', 'cap_enforced', 'error',
])

type Row = MachineActivity & { machineName: string }

export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  try {
    const machines = await listMachines()
    const running = machines.filter((m) => m.status === 'running')

    // Per machine: what it is spending against what it was allowed, and its
    // recent activity. Each machine is independent, so one failing to read
    // must not blank the whole page.
    const perMachine = await Promise.all(machines.map(async (m) => {
      const [campaigns, spend, activity] = await Promise.all([
        listMachineCampaigns(m.id).catch(() => []),
        activeSpendAed(m.id).catch(() => 0),
        listActivity(m.id, 40).catch(() => []),
      ])
      return { machine: m, campaigns, spend, activity }
    }))

    const liveCampaigns = perMachine.reduce(
      (n, x) => n + x.campaigns.filter((c) => c.status === 'active').length, 0)
    const committedAed = perMachine.reduce((n, x) => n + x.spend, 0)
    const capAed = machines.reduce((n, m) => n + m.dailyCapAed, 0)

    // One stream across every machine, newest first. An operator thinks about
    // "what happened", not "what happened in machine 3".
    const all: Row[] = perMachine
      .flatMap((x) => x.activity.map((a) => ({ ...a, machineName: x.machine.name })))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    const decisions = all.filter((a) => DECISIONS.has(a.kind)).slice(0, 12)
    const alarms = all.filter((a) => ALARMS.has(a.kind)).slice(0, 8)

    // The most recent cycle, whenever it was. "Never run" and "ran an hour
    // ago" are completely different states and the page has to tell them apart.
    const lastActivityAt = all[0]?.createdAt ?? null

    return NextResponse.json({
      machines: {
        total: machines.length,
        running: running.length,
        names: running.map((m) => m.name).slice(0, 4),
      },
      spend: { committedAed: Math.round(committedAed), capAed, liveCampaigns },
      lastActivityAt,
      decisions: decisions.map((a) => ({
        id: a.id, kind: a.kind, detail: a.detail, at: a.createdAt, machine: a.machineName,
      })),
      alarms: alarms.map((a) => ({
        id: a.id, kind: a.kind, detail: a.detail, at: a.createdAt, machine: a.machineName,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read the machines' },
      { status: 500 },
    )
  }
}
