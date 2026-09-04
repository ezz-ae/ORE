/**
 * THE JUDGMENT THAT NEVER LEFT THE BUILDING.
 *
 * Measured on the live account, 4 Sep 2026:
 *
 *     878 leads · 292 rated · 124 rated 6 or better
 *     0 with any reported stage
 *     pixel "test" (27629979209987056), last_fired_time NULL
 *
 * The write-back has never once succeeded. Meanwhile every ad set in the
 * account runs on the "Conversion leads" performance goal — Meta's QUALITY
 * goal, which learns from exactly the qualified events we were not sending.
 * Meta's own report for the window counts THREE qualified leads against ~AED
 * 48,000 of spend.
 *
 * So the optimiser was not aiming at the wrong target. It was aiming at the
 * right one and being fed almost nothing, and it fell back to the only signal
 * it could see: who fills in forms. That is the whole explanation for the
 * junk, and it is ours, not Meta's.
 *
 * ── WHY FIXING THE SENDER IS NOT ENOUGH ──────────────────────────────────
 *
 * reportLeadToMeta fires on UPDATE. Once the credentials work, the next
 * rating goes out — and the 124 already sitting there never do, because
 * nobody is going to re-rate five weeks of leads to trigger a side effect.
 * The backlog has to be swept.
 *
 * ── WHAT MAKES A BACKFILL SAFE HERE ──────────────────────────────────────
 *
 * `event_time` is NOW, not the moment of rating, and that is correct rather
 * than convenient: the event being reported is "the CRM has determined this
 * lead is qualified", and that determination is what Meta is being told
 * about. It also means an old lead is not rejected for staleness.
 *
 * The event id is deterministic (`fh-<stage>-<leadId>`), so a lead swept
 * twice is deduplicated by Meta and by our own unique index. A duplicate
 * outcome event is worse than a missing one — it teaches the optimiser to buy
 * more of a customer who existed once — so the id, not the sweep, is what
 * guarantees this.
 *
 * ── AND IT GOES OUT SLOWLY ───────────────────────────────────────────────
 *
 * Not for rate limits. Meta's lead-quality optimisation reads the RATE of
 * qualified events, and 124 arriving in one minute after five weeks of
 * silence is a spike at a moment none of those people converted. Spread over
 * days it reads as what it is. `SWEEP_BATCH` is the daily cap.
 *
 * Pure — the rows and the clock are passed in. Runs in `pnpm guards`.
 */

/**
 * How many backlog events one sweep sends.
 *
 * Chosen against this account: 124 outstanding clears in about a week at 20 a
 * day, which is close to the rate the account actually produces qualified
 * leads. A backfill that arrives faster than the business could have produced
 * it is a shape Meta has never seen from this advertiser.
 */
export const SWEEP_BATCH = 20

export interface BacklogLead {
  id: string
  /** 0–10 human rating. */
  valueRating: number | null
  status: string | null
  /** Meta's id for the originating form submission — the key that lets Meta
   *  attribute the outcome to the AD rather than merely to a person. */
  metaLeadId: string | null
  email: string | null
  phone: string | null
  /** Stages already reported for this lead. */
  reported: string[]
  /** When the lead arrived, epoch ms — the sweep order. */
  createdAtMs: number
}

export interface BacklogItem {
  leadId: string
  stage: 'qualified' | 'won'
  /** True when Meta can tie this to the originating ad. */
  attributes: boolean
}

/**
 * Which leads are owed an event, newest first, capped.
 *
 * NEWEST FIRST is the deliberate order. Meta's optimisation weights recent
 * signal, and a lead rated last week describes an ad that is still running;
 * one from July describes a campaign that has ended. Sweeping oldest-first
 * would spend the batch teaching Meta about ads nobody can buy any more.
 *
 * A lead with NO match key is excluded rather than attempted: it cannot be
 * attached to anybody, so sending it would consume a slot in the batch and
 * teach nothing.
 */
export function backlogPlan(
  leads: readonly BacklogLead[],
  opts: { valuableRating: number; wonStatuses: ReadonlySet<string>; qualifiedStatuses: ReadonlySet<string>; cap?: number },
): BacklogItem[] {
  const cap = Math.max(0, opts.cap ?? SWEEP_BATCH)
  const out: BacklogItem[] = []

  for (const l of [...leads].sort((a, b) => b.createdAtMs - a.createdAtMs)) {
    const sent = new Set(l.reported ?? [])
    const status = String(l.status ?? '').toLowerCase()
    const rating = typeof l.valueRating === 'number' ? l.valueRating : null

    // The same ladder writeBackFor uses — won outranks qualified, and a lead
    // that closed is qualified by definition. Duplicated as a CALL, not as a
    // copy of the rule: two answers to "is this lead qualified" is how the
    // CRM and the ad machine start disagreeing about the same person.
    let stage: 'qualified' | 'won' | null = null
    if (opts.wonStatuses.has(status) && !sent.has('won')) stage = 'won'
    else if (opts.qualifiedStatuses.has(status) && !sent.has('qualified')) stage = 'qualified'
    else if (rating !== null && rating >= opts.valuableRating && !sent.has('qualified')) stage = 'qualified'
    if (!stage) continue

    // Meta needs SOMETHING to attach this to. lead_id is the strong one;
    // a contact is enough to match a person even without it.
    const hasContact = !!String(l.email ?? '').trim() || !!String(l.phone ?? '').trim()
    const attributes = !!String(l.metaLeadId ?? '').trim()
    if (!attributes && !hasContact) continue

    out.push({ leadId: l.id, stage, attributes })
    if (out.length >= cap) break
  }
  return out
}

export interface SweepSummary {
  owed: number
  sent: number
  failed: number
  /** Of what was sent, how many Meta can tie to an ad. */
  attributing: number
  /** Still owed after this sweep — the number that should fall every day. */
  remaining: number
}

/** What the sweep did, in the shape a notification reads from. `remaining` is
 *  the one worth watching: a backlog that stops falling means the sends are
 *  failing, not that the work is done. */
export function summarise(owed: number, results: readonly { ok: boolean; attributes: boolean }[]): SweepSummary {
  const sent = results.filter((r) => r.ok).length
  return {
    owed,
    sent,
    failed: results.length - sent,
    attributing: results.filter((r) => r.ok && r.attributes).length,
    remaining: Math.max(0, owed - sent),
  }
}
