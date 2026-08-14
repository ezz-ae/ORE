/**
 * RATING CLAIMS — opened when a broker judges a lead, settled when the judgement
 * has had time to be right or wrong.
 *
 * A claim is opened at the moment of the rating and carries what was TRUE THEN:
 * the rating, who gave it, and what the CRM already knew about the lead. That
 * snapshot is the whole integrity of the scheme — settle against today's row
 * and a broker who edits a rating after the outcome lands looks like somebody
 * who called it early.
 *
 * The judgement itself is pure and lives in lib/freehold/points.ts. This module
 * stores, reads and pays.
 *
 * PAYING GOES THROUGH THE EXISTING LEDGER, not a second one. credits-db already
 * has the idempotency spine — unique on (broker_id, type, reference) — so a
 * settlement run that fires twice cannot pay twice, and `rating:<leadId>` is
 * the reference precisely because there is one judgement per lead, ever.
 */
import { ensureOnce, query } from '@/lib/db'
import { refundCredits } from '@/lib/freehold/credits-db'
import {
  settleClaim, applyCeiling, ratingRefundReference, outcomeOf,
  DEFAULT_SEASON_DAYS,
  type RatingClaim, type ClaimVerdict, type LeadOutcome,
} from '@/lib/freehold/points'

async function ensure(): Promise<void> {
  await ensureOnce('freehold_rating_claims', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_rating_claims (
        lead_id            TEXT PRIMARY KEY,
        broker_id          TEXT NOT NULL,
        rating             INTEGER NOT NULL,
        rated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        outcome_at_rating  TEXT NOT NULL,
        settled_at         TIMESTAMPTZ,
        verdict            TEXT,
        points             INTEGER NOT NULL DEFAULT 0
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_rating_claims_open
                 ON freehold_rating_claims (settled_at) WHERE settled_at IS NULL`)
  })
}

/**
 * Open a claim for a rating that has just been given.
 *
 * ON CONFLICT DO NOTHING is the "only the first rating earns" rule, enforced by
 * the database rather than by a check somebody can forget: the primary key is
 * the LEAD, so the second rating on the same lead writes nothing and the first
 * one's snapshot survives untouched.
 *
 * Never throws. A rating must succeed even when the points scheme cannot record
 * it — the rating is the signal, and the point is only the thank-you.
 */
export async function openRatingClaim(params: {
  leadId: string
  brokerId: string
  rating: number
  outcomeAtRating: LeadOutcome
}): Promise<boolean> {
  try {
    await ensure()
    const rows = await query<{ lead_id: string }>(
      `INSERT INTO freehold_rating_claims (lead_id, broker_id, rating, outcome_at_rating)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lead_id) DO NOTHING
       RETURNING lead_id`,
      [params.leadId, params.brokerId, Math.round(params.rating), params.outcomeAtRating],
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export interface SettledClaim {
  leadId: string
  brokerId: string
  rating: number
  verdict: ClaimVerdict
  points: number
}

/**
 * Settle every claim that has come of age, for one broker or for all of them.
 *
 * The ceiling is applied PER BROKER, over their own cycle: a broker who has
 * bought nothing can earn nothing, and one who has already earned back half
 * their spend earns no more until they spend again.
 */
export async function settleDueClaims(opts: {
  brokerId?: string
  seasonDays?: number
  now?: Date
  limit?: number
} = {}): Promise<SettledClaim[]> {
  try {
    await ensure()
    const params: unknown[] = []
    let scope = ''
    if (opts.brokerId) { params.push(opts.brokerId); scope = ` AND c.broker_id = $${params.length}` }
    params.push(Math.min(500, Math.max(1, opts.limit ?? 200)))

    // Everything the pure rule needs, in one read. `worked` is the same
    // definition response-time and hour-truth use: an activity by a human that
    // is not the assignment, the creation record, a repeat enquiry or an
    // inbound message. RATING IS NOT WORK, and rating is not an activity type,
    // so it cannot accidentally satisfy its own condition.
    const rows = await query<{
      lead_id: string; broker_id: string; rating: number; rated_at: string
      outcome_at_rating: string; status: string | null
      blocked: boolean | null; phone: string | null; worked: boolean
    }>(
      `SELECT c.lead_id, c.broker_id, c.rating, c.rated_at::text AS rated_at,
              c.outcome_at_rating, l.status, l.blocked, l.phone,
              EXISTS (
                SELECT 1 FROM freehold_site_lead_activity a
                 WHERE a.lead_id = c.lead_id
                   AND a.created_by IS NOT NULL
                   AND a.activity_type <> ALL($${params.length + 1})
              ) AS worked
         FROM freehold_rating_claims c
         JOIN freehold_site_leads l ON l.id = c.lead_id
        WHERE c.settled_at IS NULL${scope}
        ORDER BY c.rated_at
        LIMIT $${params.length}`,
      [...params, ['assignment', 'created', 'repeat_inquiry', 'whatsapp_received']],
    )
    if (rows.length === 0) return []

    const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

    // Judge each on its own, then let the ceiling decide how many are paid.
    const judged = rows.map((r) => {
      const claim: RatingClaim = {
        leadId: r.lead_id,
        brokerId: r.broker_id,
        rating: r.rating,
        ratedAt: r.rated_at,
        // The database enforces one claim per lead, so a row that exists IS
        // the first rating. Stated rather than re-derived.
        isFirstRating: true,
        outcomeAtRating: (r.outcome_at_rating as LeadOutcome) ?? 'stalled',
        outcomeNow: outcomeOf({ status: r.status, blocked: r.blocked, badPhone: badPhone(r.phone) }),
        worked: r.worked === true,
      }
      return { row: r, settlement: settleClaim(claim, { seasonDays: opts.seasonDays ?? DEFAULT_SEASON_DAYS, now: opts.now }) }
    })

    // A claim that is simply not old enough yet stays OPEN — it is not a
    // verdict, it is a "come back later", and marking it settled would deny a
    // broker a point they had not yet earned or lost.
    const ready = judged.filter((j) => j.settlement.verdict !== 'tooEarly')
    const out: SettledClaim[] = []

    const byBroker = new Map<string, typeof ready>()
    for (const j of ready) {
      byBroker.set(j.row.broker_id, [...(byBroker.get(j.row.broker_id) ?? []), j])
    }

    for (const [brokerId, group] of byBroker) {
      // SPENT IN THIS CYCLE, not lifetime. getCreditBalance().total_spent sums
      // every 'spend' row ever written, and the refunds counted against it are
      // this cycle's — so the ceiling grew for ever against a figure that
      // resets monthly, and an old account could earn back half of everything
      // it had ever spent again every month. Both sides are now the cycle.
      const spent = await spentThisCycle(brokerId)
      const alreadyRefunded = await refundedThisCycle(brokerId)
      const capped = applyCeiling(group.map((g) => g.settlement), {
        spentThisCycle: spent,
        alreadyRefundedThisCycle: alreadyRefunded,
      })

      for (let i = 0; i < group.length; i++) {
        const g = group[i]
        const s = capped.settled[i]
        // A CAPPED CLAIM STAYS OPEN. It was judged right; there was simply no
        // room in the month. Marking it settled would close a point somebody
        // earned, for ever, and tell them it was "too soon to tell".
        if (s.verdict === 'cappedOut') {
          // The VERDICT is written so the broker can see "right, but the month
          // was full" instead of "too soon to tell" — but settled_at stays
          // NULL, so the claim comes back round next cycle and pays.
          await query(
            `UPDATE freehold_rating_claims SET verdict = $2
              WHERE lead_id = $1 AND settled_at IS NULL`,
            [g.row.lead_id, s.verdict],
          ).catch(() => undefined)
          out.push({
            leadId: g.row.lead_id, brokerId, rating: g.row.rating,
            verdict: s.verdict, points: 0,
          })
          continue
        }
        // PAY FIRST, MARK AFTER. The ledger write is idempotent on
        // `rating:<leadId>`, so a crash between the two costs at most a repeat
        // attempt that the unique index refuses. Marking first and crashing
        // would lose the point silently, which is the worse of the two.
        if (s.points > 0) {
          const paid = await refundCredits(
            brokerId, ratingRefundReference(g.row.lead_id), s.points,
            `Points back: you called lead ${g.row.lead_id} right`,
          ).catch(() => ({ ok: false as const }))
          if (!paid.ok) continue
        }
        await query(
          `UPDATE freehold_rating_claims
              SET settled_at = now(), verdict = $2, points = $3
            WHERE lead_id = $1 AND settled_at IS NULL`,
          [g.row.lead_id, s.verdict, s.points],
        ).catch(() => undefined)
        out.push({
          leadId: g.row.lead_id, brokerId, rating: g.row.rating,
          verdict: s.verdict, points: s.points,
        })
      }
    }

    return out
  } catch {
    return []
  }
}

/**
 * Credits this broker SPENT inside the current cycle.
 *
 * The ceiling is a share of it, and it has to be the same window as the
 * refunds counted against it — see refundCeiling.
 */
async function spentThisCycle(brokerId: string): Promise<number> {
  try {
    const rows = await query<{ n: string }>(
      `SELECT COALESCE(SUM(cl.amount), 0)::text AS n
         FROM credit_ledger cl
         JOIN broker_credit_accounts a ON a.broker_id = cl.broker_id
        WHERE cl.broker_id = $1
          AND cl.type = 'spend'
          AND cl.created_at >= a.cycle_start`,
      [brokerId],
    )
    return Number(rows[0]?.n ?? 0) || 0
  } catch {
    return 0
  }
}

/** Points already returned for ratings in this broker's current cycle. */
async function refundedThisCycle(brokerId: string): Promise<number> {
  try {
    const rows = await query<{ n: string }>(
      `SELECT COALESCE(SUM(cl.amount), 0)::text AS n
         FROM credit_ledger cl
         JOIN broker_credit_accounts a ON a.broker_id = cl.broker_id
        WHERE cl.broker_id = $1
          AND cl.type = 'refund'
          AND cl.reference LIKE 'rating:%'
          AND cl.created_at >= a.cycle_start`,
      [brokerId],
    )
    return Number(rows[0]?.n ?? 0) || 0
  } catch {
    return 0
  }
}

/** What this broker has earned back, and what is still waiting to be judged. */
export async function ratingEarnings(brokerId: string): Promise<{
  paid: number
  open: number
  settled: number
  byVerdict: Record<string, number>
}> {
  const empty = { paid: 0, open: 0, settled: 0, byVerdict: {} as Record<string, number> }
  try {
    await ensure()
    // Grouped by verdict AND by whether the claim is closed, because the two
    // are no longer the same question: a capped claim carries a verdict and is
    // still open, waiting for room next cycle.
    const rows = await query<{ verdict: string | null; is_open: boolean; n: string; pts: string }>(
      `SELECT verdict, (settled_at IS NULL) AS is_open,
              COUNT(*)::text AS n, COALESCE(SUM(points), 0)::text AS pts
         FROM freehold_rating_claims
        WHERE broker_id = $1
        GROUP BY verdict, (settled_at IS NULL)`,
      [brokerId],
    )
    const byVerdict: Record<string, number> = {}
    let paid = 0, open = 0, settled = 0
    for (const r of rows) {
      const n = Number(r.n) || 0
      // OPEN IS ABOUT settled_at, not about the verdict. Counting a capped
      // claim as unjudged would show the broker "too soon to tell" about a
      // call they got right and are owed for.
      if (r.is_open) open += n
      else settled += n
      if (r.verdict) byVerdict[r.verdict] = (byVerdict[r.verdict] ?? 0) + n
      paid += Number(r.pts) || 0
    }
    return { paid, open, settled, byVerdict }
  } catch {
    return empty
  }
}
