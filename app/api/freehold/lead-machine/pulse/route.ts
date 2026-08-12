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
import {
  ACTION_KINDS, INTENT_KINDS, intentIsFresh, pulseState,
} from '@/lib/freehold/machine-activity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/**
 * Things the machine DID — a choice it made and acted on. These are the
 * entries worth showing on a hub, because each one is the machine spending or
 * withholding money and saying why.
 */
/**
 * WHAT IT DID — see lib/freehold/machine-activity.ts.
 *
 * 'planned' and 'google_draft_prepared' used to be in this set, and the hub
 * showed a ten-day-old "Planned 3 Meta trials … nothing launches until the
 * machine is started" as though it were work the machine had done. A panel
 * that shows intent as achievement cannot be trusted about achievement, so the
 * entries that ARE real stopped being read.
 */
const DECISIONS: ReadonlySet<ActivityKind> = new Set<ActivityKind>(ACTION_KINDS)

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

    // A STANDING INTENTION, kept apart from the record of what happened.
    // Shown only while it is still actionable: "start the machine and this
    // happens" is a live to-do this morning and a fact about a decision nobody
    // took ten days later, and repeating it daily does not make it likelier.
    const pending = all
      .filter((a) => INTENT_KINDS.includes(a.kind) && intentIsFresh(a.createdAt))
      .slice(0, 3)

    // ONE PROBLEM IS ONE ALARM, however many cycles have re-reported it.
    //
    // The hub opened on "NEEDS YOU (8)" that was two unreadable campaigns
    // logged four times each, and the six duplicates pushed every other alarm
    // off the screen. Writing is deduped now, but the rows already written
    // stay — history is not rewritten to make a screen look better. So the
    // collapsing happens on the way out, newest kept, with a count of how many
    // times the same thing has been said.
    //
    // Grouped on kind + detail + machine, NOT on kind alone: two campaigns
    // failing the same way are two problems, and merging them would hide one.
    const alarmRows = all.filter((a) => ALARMS.has(a.kind))
    const grouped = new Map<string, Row & { repeats: number }>()
    for (const a of alarmRows) {
      // CAMPAIGN IS PART OF THE KEY. Trial labels repeat across projects — the
      // incident this grouping was written for was literally two campaigns
      // both called "Advantage Broad" — so keying on wording alone merged two
      // real problems into one and hid the second. The write-side dedup
      // already keys on campaign; this has to agree with it.
      const key = [a.machineName, a.kind, a.campaignId ?? '', a.detail].join(' | ')
      const seen = grouped.get(key)
      // `all` is newest-first, so the first of a key is the one to keep.
      if (seen) seen.repeats += 1
      else grouped.set(key, { ...a, repeats: 1 })
    }
    const distinct = Array.from(grouped.values())
    const alarms = distinct.slice(0, 8)
    // Duplicates folded away — NOT the display cap. Counting the slice as
    // "duplicates" told an account with 20 distinct alarms that 12 of them
    // were repeats, which is a much calmer claim than the truth.
    const alarmsSuppressed = alarmRows.length - distinct.length
    const alarmsNotShown = distinct.length - alarms.length

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
      /** Plans waiting on somebody pressing start. Never mixed into decisions:
       *  one is a record, the other is a to-do. */
      pending: pending.map((a) => ({
        id: a.id, kind: a.kind, detail: a.detail, at: a.createdAt, machine: a.machineName,
      })),
      /** The honest state of the whole layer — "1 running" was the switch, and
       *  it was being printed beside "0 live campaigns · AED 0". */
      state: pulseState({
        total: machines.length, running: running.length,
        liveCampaigns, committedAed: Math.round(committedAed),
      }),
      alarms: alarms.map((a) => ({
        id: a.id, kind: a.kind, detail: a.detail, at: a.createdAt, machine: a.machineName,
        /** How many times this same alarm has been logged. 1 means it has been
         *  said once; more means it is a standing condition nobody has cleared,
         *  which is worth showing as a number rather than as N rows. */
        repeats: a.repeats,
      })),
      /** Duplicate rows folded away, so the page can be honest that the list is
       *  shorter than the history rather than looking like alarms vanished. */
      alarmsSuppressed,
      /** DISTINCT problems that did not fit the list — a different fact from
       *  the one above, and the one that means something is being missed. */
      alarmsNotShown,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read the machines' },
      { status: 500 },
    )
  }
}
