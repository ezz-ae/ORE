/**
 * THE TWO AUDIENCES A BROKER'S RATINGS BUILD.
 *
 * Rating a lead well already sent Meta a QualifiedLead event. That teaches the
 * optimiser inside ONE campaign's conversion model, and it is genuinely
 * useful — but it is not "find me more people like this", and it does nothing
 * at all about the leads a broker judged worthless.
 *
 * Two audiences close that:
 *
 *   THE SEED    everyone rated >= VALUABLE_RATING, uploaded hashed, and a
 *               value-based LOOKALIKE built from it. This is the only
 *               mechanism by which "more people like my good leads" reaches
 *               Meta's delivery.
 *
 *   THE AVOID   everyone rated <= AVOID_RATING, uploaded hashed, attached as
 *               an EXCLUSION at launch.
 *
 * WHY THE SECOND ONE IS SHAPED DIFFERENTLY. There is no "bad lead" event in
 * the Conversions API — Meta has no negative signal to receive. Sending a
 * Purchase of value zero would teach it this person CONVERTED, which is the
 * opposite of the truth. Exclusion is the only honest negative lever, and it
 * is why this file builds a list rather than sending an event.
 *
 * WHAT LEAVES THIS SERVER. Email and phone only, and only ever SHA-256 hashed
 * by addHashedBuyers before the request — the same path every other audience
 * in this product uses. No name, no rating, no CRM note, no lead id. Meta
 * learns that some people resemble each other; it never learns what anybody
 * here wrote about them.
 *
 * REFRESH IS AN APPEND, not a rebuild — Meta custom audiences are additive.
 * That is the right shape: a lead judged junk in March should stay excluded in
 * April whether or not today's query happens to return it.
 */
import { query } from '@/lib/db'
import { getStoredCreds, setStoredCreds } from '@/lib/freehold/integration-credentials'
import {
  createCustomAudience, addHashedBuyers, createLookalikeAudience, isMetaConfigured,
} from '@/lib/meta/client'
import { VALUABLE_RATING } from '@/lib/freehold/lead-stages'
import { AVOID_RATING, LOOKALIKE_MIN_SEED } from '@/lib/freehold/rating-loop'

const SEED_PROVIDER = 'meta_rated_seed'
const AVOID_PROVIDER = 'meta_rated_avoid'

interface StoredAudience extends Record<string, unknown> {
  audienceId: string
  /** The lookalike built FROM it, when one has been. Seed only. */
  lookalikeId?: string
  refreshedAt: string
  /** What Meta reported it matched — never what we uploaded. */
  matched: number
}

/** Contacts on one side of the rating. Only the two fields that can be hashed
 *  and matched leave this query at all. */
async function ratedContacts(side: 'valuable' | 'avoid'): Promise<Array<{ email: string | null; phone: string | null }>> {
  const cmp = side === 'valuable' ? `>= ${VALUABLE_RATING}` : `<= ${AVOID_RATING}`
  try {
    return await query<{ email: string | null; phone: string | null }>(
      `SELECT email, phone FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND value_rating IS NOT NULL
          AND value_rating ${cmp}
          AND (email IS NOT NULL OR phone IS NOT NULL)`,
    )
  } catch { return [] }
}

async function syncSide(
  side: 'valuable' | 'avoid',
  provider: string,
  name: string,
  description: string,
): Promise<StoredAudience | null> {
  const contacts = await ratedContacts(side)
  if (contacts.length === 0) return null

  const stored = await getStoredCreds<StoredAudience>(provider).catch(() => null)
  let audienceId = stored?.audienceId ?? ''
  if (!audienceId) {
    const made = await createCustomAudience(name, description)
    audienceId = made.id
  }
  // MATCHED, not uploaded. addHashedBuyers returns what Meta accepted; a
  // hundred contacts commonly match sixty, and reporting the upload would be
  // reporting our own intention as a result.
  const matched = await addHashedBuyers(audienceId, contacts)
  const next: StoredAudience = {
    audienceId,
    lookalikeId: stored?.lookalikeId,
    refreshedAt: new Date().toISOString(),
    matched,
  }
  await setStoredCreds(provider, next, 'system').catch(() => undefined)
  return next
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
} | null> {
  if (!(await isMetaConfigured())) return null

  const seed = await syncSide(
    'valuable', SEED_PROVIDER,
    'Rated valuable — seed',
    'Leads this company\'s own brokers judged worth having. The seed for a value-based lookalike.',
  ).catch(() => null)

  const avoid = await syncSide(
    'avoid', AVOID_PROVIDER,
    'Rated junk — do not target',
    'Leads this company\'s own brokers judged worthless. Excluded from campaigns; there is no negative event to send instead.',
  ).catch(() => null)

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

  return { seed, avoid, lookalikeCreated }
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
 *  like the ones your own brokers called junk. */
export async function avoidAudienceId(): Promise<string | null> {
  const stored = await getStoredCreds<StoredAudience>(AVOID_PROVIDER).catch(() => null)
  return stored?.audienceId || null
}
