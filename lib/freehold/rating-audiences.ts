/**
 * THE TWO AUDIENCES THIS COMPANY'S OWN EVIDENCE BUILDS.
 *
 * Rating a lead well already sent Meta a QualifiedLead event. That teaches the
 * optimiser inside ONE campaign's conversion model, and it is genuinely
 * useful — but it is not "find me more people like this", and it does nothing
 * at all about the leads a broker judged worthless.
 *
 * Two audiences close that:
 *
 *   THE SEED    the people this account's own funnel proves are worth having,
 *               uploaded hashed and WEIGHTED, with a value-based LOOKALIKE
 *               built from it. This is the only mechanism by which "find me
 *               more people like my good leads" reaches Meta's delivery.
 *
 *   THE AVOID   the people it proves are not, uploaded hashed and attached as
 *               an EXCLUSION at launch.
 *
 * WHO IS IN THEM IS NOT A QUERY HERE. It is splitCohorts() in seed-cohort.ts,
 * fed by loadLeadEvidence() — the same judgment the deep-seed screen uses.
 * This file used to run its own `WHERE value_rating >= 6`, and that one line
 * cost more than any other in the loop:
 *
 *   · A lead who BOUGHT and whom nobody rated was in neither audience. The
 *     most valuable row in the account, invisible to the thing whose job is
 *     finding more like it.
 *   · A lead rated 9 on the first call and blocked a week later stayed in the
 *     seed, teaching Meta to find more of him.
 *   · Every member counted the same, so an AED 4m buyer and a lead who
 *     answered the phone were equally worth copying.
 *
 * OUTCOMES OUTRANK OPINIONS, and a weight says by how much. A rating is a
 * judgment made in ten seconds and it is real signal; a closed deal is the
 * thing being predicted. seed-cohort.ts scores them in that order, and this
 * file's only job is to carry the result to Meta honestly.
 *
 * WHY THE NEGATIVE SIDE IS SHAPED DIFFERENTLY. There is no "bad lead" event in
 * the Conversions API — Meta has no negative signal to receive. Sending a
 * Purchase of value zero would teach it this person CONVERTED, which is the
 * opposite of the truth. Exclusion is the only honest negative lever, and it
 * is why this side builds a list rather than sending an event.
 *
 * WHAT LEAVES THIS SERVER. Email and phone only, SHA-256 hashed by
 * addHashedBuyers / addWeightedBuyers before the request — the same path every
 * other audience in this product uses. On the seed a weight travels too: a
 * deal value in AED, or a scaled quality when there is no deal. No name, no
 * rating, no CRM note, no lead id, no status. Meta learns that some people
 * resemble each other and how much each one counts; it never learns what
 * anybody here wrote about them.
 *
 * REFRESH IS AN APPEND, not a rebuild — Meta custom audiences are additive.
 * That is the right shape: a lead judged junk in March should stay excluded in
 * April whether or not today's query happens to return it.
 */
import { getStoredCreds, setStoredCreds } from '@/lib/freehold/integration-credentials'
import {
  createCustomAudience, addHashedBuyers, addWeightedBuyers, createLookalikeAudience, isMetaConfigured,
} from '@/lib/meta/client'
import { LOOKALIKE_MIN_SEED } from '@/lib/freehold/rating-loop'
import { loadLeadEvidence } from '@/lib/freehold/lead-evidence'
import { query } from '@/lib/db'
import { ruleForRating } from '@/lib/freehold/rating-actions'
import {
  splitCohorts, seedUpload, cohortEvidence, type Cohorts, type CohortEvidence,
} from '@/lib/freehold/seed-cohort'

const SEED_PROVIDER = 'meta_rated_seed'
const AVOID_PROVIDER = 'meta_rated_avoid'

interface StoredAudience extends Record<string, unknown> {
  audienceId: string
  /** The lookalike built FROM it, when one has been. Seed only. */
  lookalikeId?: string
  refreshedAt: string
  /** What Meta reported it matched — never what we uploaded. */
  matched: number
  /**
   * Seed only: this audience was created with is_value_based, so the weights
   * are honoured. Meta CANNOT add that flag to an existing audience, which is
   * why an old unweighted seed is replaced rather than upgraded — see
   * syncRatingAudiences.
   */
  weighted?: boolean
}

/** The cohorts as they stand right now, with what fed them. No Meta call and
 *  no upload: the loop screen reads this on every render, and a screen that
 *  ships contact lists to Meta to draw a number would be indefensible. */
export async function currentCohorts(): Promise<{ cohorts: Cohorts; evidence: CohortEvidence }> {
  const cohorts = splitCohorts(await loadLeadEvidence())
  return { cohorts, evidence: cohortEvidence(cohorts) }
}

/**
 * Build or refresh both audiences, and create the lookalike once the seed is
 * genuinely big enough.
 *
 * THE LOOKALIKE IS NOT BUILT EARLY. Below Meta's working floor it accepts the
 * request and produces something so broad it is indistinguishable from open
 * targeting — a precise-sounding audience that behaves like none. Waiting is
 * the honest state and the loop screen says so.
 */
export async function syncRatingAudiences(): Promise<{
  seed: StoredAudience | null
  avoid: StoredAudience | null
  lookalikeCreated: boolean
  evidence: CohortEvidence
} | null> {
  if (!(await isMetaConfigured())) return null

  const { cohorts, evidence } = await currentCohorts()

  // ── THE SEED ────────────────────────────────────────────────────────────
  let seed: StoredAudience | null = null
  const rows = seedUpload(cohorts.seed)
  if (rows.length > 0) {
    const stored = await getStoredCreds<StoredAudience>(SEED_PROVIDER).catch(() => null)
    // An audience created before weighting existed cannot be given the flag —
    // Meta only accepts is_value_based at creation. Replacing it is the only
    // route, and the old lookalike goes with it because it was modelled on the
    // unweighted source and would otherwise silently outlive its origin.
    const reuse = stored?.audienceId && stored.weighted === true ? stored : null
    let audienceId = reuse?.audienceId ?? ''
    if (!audienceId) {
      const made = await createCustomAudience(
        'Worth having — weighted seed',
        'People this company\'s own funnel proves were worth having: closed, qualified, or judged valuable by its brokers. Weighted by what each was actually worth. Identifiers hashed before leaving the server.',
        { valueBased: true },
      )
      audienceId = made.id
    }
    // MATCHED, not uploaded. The uploader returns what Meta accepted; a
    // hundred contacts commonly match sixty, and reporting the upload would be
    // reporting our own intention as a result.
    const matched = await addWeightedBuyers(audienceId, rows)
    seed = {
      audienceId,
      lookalikeId: reuse?.lookalikeId,
      refreshedAt: new Date().toISOString(),
      matched,
      weighted: true,
    }
    await setStoredCreds(SEED_PROVIDER, seed, 'system').catch(() => undefined)
  }

  // ── THE AVOID LIST ──────────────────────────────────────────────────────
  // Unweighted on purpose: there is no "how bad" to express. Exclusion is
  // binary, and a weight column on it would be a number with no meaning.
  let avoid: StoredAudience | null = null
  if (cohorts.exclude.length > 0) {
    const stored = await getStoredCreds<StoredAudience>(AVOID_PROVIDER).catch(() => null)
    let audienceId = stored?.audienceId ?? ''
    if (!audienceId) {
      const made = await createCustomAudience(
        'Proven not worth buying — do not target',
        'People this company blocked, could not reach, or judged worthless. Excluded from campaigns; there is no negative event to send instead.',
      )
      audienceId = made.id
    }
    const matched = await addHashedBuyers(
      audienceId,
      cohorts.exclude.map((l) => ({ email: l.email, phone: l.phone })),
    )
    avoid = { audienceId, refreshedAt: new Date().toISOString(), matched }
    await setStoredCreds(AVOID_PROVIDER, avoid, 'system').catch(() => undefined)
  }

  let lookalikeCreated = false
  if (seed && !seed.lookalikeId && seed.matched >= LOOKALIKE_MIN_SEED) {
    try {
      const lal = await createLookalikeAudience({
        sourceAudienceId: seed.audienceId,
        name: 'People like our best leads',
        country: 'AE',
        ratio: 0.01,
      })
      await setStoredCreds(SEED_PROVIDER, { ...seed, lookalikeId: lal.id }, 'system').catch(() => undefined)
      seed.lookalikeId = lal.id
      lookalikeCreated = true
    } catch { /* the seed still exists; the lookalike is retried next sync */ }
  }

  return { seed, avoid, lookalikeCreated, evidence }
}

/** What has been built, read-only and cheap. The launch path and the loop
 *  screen both read this; neither may upload a contact list while somebody
 *  waits. */
export async function ratingAudienceState(): Promise<{
  seed: StoredAudience | null
  avoid: StoredAudience | null
}> {
  const [seed, avoid] = await Promise.all([
    getStoredCreds<StoredAudience>(SEED_PROVIDER).catch(() => null),
    getStoredCreds<StoredAudience>(AVOID_PROVIDER).catch(() => null),
  ])
  return { seed: seed ?? null, avoid: avoid ?? null }
}

/** The id to EXCLUDE from new campaigns, when one has been built. Alongside
 *  the "already in your CRM" exclusion, not instead of it: one stops paying
 *  twice for a person you have, this stops paying at all for people who look
 *  like the ones this company already proved were not worth buying. */
export async function avoidAudienceId(): Promise<string | null> {
  const stored = await getStoredCreds<StoredAudience>(AVOID_PROVIDER).catch(() => null)
  return stored?.audienceId || null
}


/**
 * ONE RATED LEAD, INTO ITS AUDIENCE, THE MOMENT IT IS RATED.
 *
 * "sending the feedback has to be once rate done with no need for ACTION."
 *
 * Half of that was already true. Rating a lead fires the Meta conversion
 * event immediately — `updateLead` calls reportLeadToMeta, which is why the
 * outcome reaches the originating ad while the ad set is still learning.
 *
 * The audience half was not. Seed and exclusion membership only moved when
 * somebody opened a screen and pressed a button, so a lead rated 10 on Monday
 * sat outside the seed until a person remembered on Thursday. The signal
 * existed and was simply parked.
 *
 * This is the missing write: one person, one upload, on the rating itself.
 *
 * ── WHY IT APPENDS RATHER THAN REBUILDS ─────────────────────────────────
 *
 * `syncRatingAudiences` recomputes both cohorts from every lead in the CRM and
 * re-uploads them — right for a periodic refresh, far too heavy to run on
 * every tap of a rating button. Meta custom audiences are additive, so adding
 * one person is a genuine one-row call and the periodic sync stays the thing
 * that reconciles.
 *
 * ── AND IT WILL NOT CREATE AN AUDIENCE IT WAS NOT ASKED FOR ─────────────
 *
 * If the audiences do not exist yet, this does nothing and says so. Creating a
 * custom audience is a deliberate act with the operator's own name on it; the
 * first rating of a fresh account is not the moment to make one silently, and
 * the sync on the Rating page exists precisely to do it on purpose.
 *
 * Never throws. A rating must never fail because Meta was slow — the audience
 * is reconciled by the next sync, the rating is the thing that must land.
 */
export async function pushRatedLeadToAudience(leadId: string): Promise<
  { pushed: 'seed' | 'avoid' | null; reason?: string }
> {
  try {
    if (!(await isMetaConfigured())) return { pushed: null, reason: 'meta_not_connected' }

    const rows = await query<{
      email: string | null; phone: string | null; value_rating: number | null
      blocked: boolean | null; archived: boolean | null
    }>(
      `SELECT email, phone, value_rating, blocked, archived
         FROM freehold_site_leads WHERE id = $1 LIMIT 1`,
      [leadId],
    )
    const lead = rows[0]
    if (!lead || lead.archived) return { pushed: null, reason: 'no_lead' }

    // The operator's table decides, exactly as it does for the periodic sync:
    // 0–3 exclude, 4–5 feed neither, 6+ seed with a weight.
    const rating = lead.value_rating
    const rule = ruleForRating(rating)
    if (!rule || rule.action === 'crmExecution') return { pushed: null, reason: 'no_action' }

    // A blocked person never seeds, whatever the rating says — a blocked
    // contact in a seed teaches Meta to find more people like them.
    const toAvoid = rule.action === 'exclude' || lead.blocked === true
    const contact = { email: lead.email, phone: lead.phone }
    // Meta can match neither, so there is nothing to send.
    if (!contact.email && !contact.phone) return { pushed: null, reason: 'unmatchable' }

    const provider = toAvoid ? AVOID_PROVIDER : SEED_PROVIDER
    const stored = await getStoredCreds<StoredAudience>(provider).catch(() => null)
    if (!stored?.audienceId) return { pushed: null, reason: 'audience_not_built' }

    if (toAvoid) {
      await addHashedBuyers(stored.audienceId, [contact])
      return { pushed: 'avoid' }
    }
    // The weight is the operator's own scale — a 10 pulls three times as hard
    // as a 6 — and it is only honoured on an audience created value-based.
    if (stored.weighted === true) {
      await addWeightedBuyers(stored.audienceId, [{ ...contact, value: rule.weight * 1000 }])
    } else {
      await addHashedBuyers(stored.audienceId, [contact])
    }
    return { pushed: 'seed' }
  } catch (err) {
    console.error('[rating-audiences] live push failed', leadId, err)
    return { pushed: null, reason: 'error' }
  }
}
