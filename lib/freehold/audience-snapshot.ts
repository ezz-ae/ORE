/**
 * AUDIENCE SNAPSHOT — freeze the definition a lead actually arrived through.
 *
 * The loop this closes: track every behaviour we buy, catch the registration
 * event, snap the audience that produced it, repeat. After enough leads, every
 * behaviour in the account has its own 2×2 table against real funnel outcomes,
 * and "is this behaviour worth targeting" stops being an opinion.
 *
 * WHY A SNAPSHOT AND NOT A JOIN. This is the whole design, and getting it
 * wrong would be silent. An ad set's targeting is mutable: budgets move,
 * interests get added, a behaviour is swapped out, the machine rotates the
 * arm. If relevance were computed by joining a lead to its ad set's CURRENT
 * targeting, then every historical lead would be re-attributed every time
 * someone edited the ad set — a behaviour added yesterday would inherit credit
 * for a lead that closed last month, and a behaviour removed yesterday would
 * lose the leads it actually earned. The table would keep answering, fluently,
 * and it would be wrong in a way nobody could see.
 *
 * So the definition is copied at registration and never touched again. A
 * snapshot row is an immutable historical fact: "this person arrived through
 * exactly this definition, on this date."
 *
 * FAIL-SOFT, ALWAYS. Capture happens after the lead is committed and can never
 * fail the lead. A missing snapshot costs one row of learning; a lead lost to
 * a slow Graph call costs a customer.
 */
import { query, ensureOnce } from '@/lib/db'
import type { CampaignTargeting } from '@/lib/meta/types'

export interface AudienceSnapshot {
  leadId: string
  campaignId: string | null
  adsetId: string | null
  /** Meta interest ids live in the ad set at registration. */
  interestIds: string[]
  interestNames: string[]
  /** Meta behaviour ids live in the ad set at registration. THE thing being
   *  measured — everything else here is context for it. */
  behaviorIds: string[]
  behaviorNames: string[]
  ageMin: number | null
  ageMax: number | null
  countries: string[]
  /** Language codes the ad set was narrowed to, empty when unnarrowed. */
  languages: string[]
  platforms: string[]
  /** The AD the lead actually saw, and the copy it carried at that moment.
   *  Creative is edited far more often than targeting, so joining live would
   *  credit today's headline for a lead won by last month's. */
  adId: string | null
  creativeHeadline: string | null
  creativeBody: string | null
  creativeImage: string | null
  /** The surface it was seen on, e.g. 'feed', 'instagram_stories'. Meta's
   *  {{placement}} URL macro, so it exists for landing-page leads and NOT for
   *  instant-form leads — there is no landing URL to carry it. Null means
   *  unknown, never 'feed'. */
  placement: string | null
  capturedAt: string
}

async function ensureTable(): Promise<void> {
  await ensureOnce('freehold_lead_audience_snapshot', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_lead_audience_snapshot (
        lead_id        text PRIMARY KEY,
        campaign_id    text,
        adset_id       text,
        interest_ids   text[] NOT NULL DEFAULT '{}',
        interest_names text[] NOT NULL DEFAULT '{}',
        behavior_ids   text[] NOT NULL DEFAULT '{}',
        behavior_names text[] NOT NULL DEFAULT '{}',
        age_min        int,
        age_max        int,
        countries      text[] NOT NULL DEFAULT '{}',
        languages      text[] NOT NULL DEFAULT '{}',
        platforms      text[] NOT NULL DEFAULT '{}',
        ad_id          text,
        creative_headline text,
        creative_body  text,
        creative_image text,
        placement      text,
        captured_at    timestamptz NOT NULL DEFAULT now()
      )
    `)
    // Reading is always "which leads carried behaviour X" — a GIN index makes
    // that a scan of the matching rows rather than of the whole table.
    await query(`CREATE INDEX IF NOT EXISTS lead_aud_snap_behaviors_idx
                   ON freehold_lead_audience_snapshot USING GIN (behavior_ids)`).catch(() => undefined)
    await query(`CREATE INDEX IF NOT EXISTS lead_aud_snap_interests_idx
                   ON freehold_lead_audience_snapshot USING GIN (interest_ids)`).catch(() => undefined)
  })
}

/** Flatten a targeting spec's base groups AND its AND-narrowing groups — a
 *  behaviour used only as a narrowing constraint was still bought. */
export function entitiesFromTargeting(t: CampaignTargeting | null | undefined): {
  interestIds: string[]; interestNames: string[]; behaviorIds: string[]; behaviorNames: string[]
} {
  const interests = [...(t?.interests ?? [])]
  const behaviors = [...(t?.behaviors ?? [])]
  for (const g of t?.narrowing ?? []) {
    interests.push(...(g.interests ?? []))
    behaviors.push(...(g.behaviors ?? []))
  }
  const uniq = <T extends { id: string; name: string }>(xs: T[]) => {
    const seen = new Map<string, T>()
    for (const x of xs) if (x?.id && !seen.has(x.id)) seen.set(x.id, x)
    return [...seen.values()]
  }
  const i = uniq(interests), b = uniq(behaviors)
  return {
    interestIds: i.map((x) => x.id), interestNames: i.map((x) => x.name),
    behaviorIds: b.map((x) => x.id), behaviorNames: b.map((x) => x.name),
  }
}

export interface CaptureInput {
  leadId: string
  campaignId?: string | null
  adsetId?: string | null
  /** The definition as it stood at registration. Resolved by the caller —
   *  this module never fetches, so it stays testable and never blocks a lead. */
  targeting: CampaignTargeting | null
  adId?: string | null
  /** The ad's copy at registration. Frozen for the same reason targeting is:
   *  an operator who rewrites a headline must not retroactively change which
   *  headline earned last month's leads. */
  creative?: { headline?: string | null; body?: string | null; image?: string | null } | null
  /** Meta's {{placement}} value from the landing URL. Absent for instant-form
   *  leads — those have no URL, and guessing one would invent the fact this
   *  whole table exists to record. */
  placement?: string | null
}

/**
 * Record the snapshot. Idempotent on lead_id and DELIBERATELY not an upsert:
 * the first capture is the historical truth, and a later call — a re-sync, a
 * retry, a backfill run after the ad set changed — must not overwrite it with
 * a definition from a different moment.
 *
 * Returns false on any failure. Callers must not await this in a request path
 * that owes the user a response.
 */
export async function captureAudienceSnapshot(input: CaptureInput): Promise<boolean> {
  if (!input.leadId) return false
  try {
    await ensureTable()
    const e = entitiesFromTargeting(input.targeting)
    const t = input.targeting
    await query(
      `INSERT INTO freehold_lead_audience_snapshot
         (lead_id, campaign_id, adset_id, interest_ids, interest_names,
          behavior_ids, behavior_names, age_min, age_max, countries, languages, platforms,
          ad_id, creative_headline, creative_body, creative_image, placement)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (lead_id) DO NOTHING`,
      [
        input.leadId, input.campaignId || null, input.adsetId || null,
        e.interestIds, e.interestNames, e.behaviorIds, e.behaviorNames,
        t?.ageMin ?? null, t?.ageMax ?? null,
        t?.countries ?? [], t?.leadLanguages ?? [], t?.publisherPlatforms ?? [],
        input.adId || null,
        input.creative?.headline || null, input.creative?.body || null, input.creative?.image || null,
        // Normalised so 'Feed' and 'feed' are one surface, not two.
        input.placement ? String(input.placement).trim().toLowerCase() : null,
      ],
    )
    return true
  } catch {
    // A lead is worth more than a row of learning. Never rethrow.
    return false
  }
}

/** Which leads have no snapshot yet — the backfill worklist. Only leads that
 *  came from paid delivery can ever have one. */
export async function leadsAwaitingSnapshot(limit = 200): Promise<Array<{ leadId: string; campaignId: string | null; adsetId: string | null }>> {
  try {
    await ensureTable()
    const rows = await query<{ id: string; utm_id: string | null; meta_adset_id: string | null; utm_term: string | null }>(
      `SELECT l.id, l.utm_id, l.meta_adset_id, l.utm_term
         FROM freehold_site_leads l
    LEFT JOIN freehold_lead_audience_snapshot s ON s.lead_id = l.id
        WHERE s.lead_id IS NULL
          AND (l.meta_adset_id IS NOT NULL OR l.utm_term IS NOT NULL)
        ORDER BY l.created_at DESC
        LIMIT $1`,
      [limit],
    )
    return rows.map((r) => ({
      leadId: r.id,
      campaignId: r.utm_id,
      // Instant-form leads carry meta_adset_id; landing-page leads carry the
      // ad set id in utm_term, written by the creative's url_tags.
      adsetId: r.meta_adset_id || r.utm_term,
    }))
  } catch {
    return []
  }
}

/** One row per lead: the behaviours it arrived through and whether it
 *  progressed. The join that makes every behaviour measurable. */
export interface SnapshotOutcomeRow {
  leadId: string
  behaviorIds: string[]
  behaviorNames: string[]
  interestIds: string[]
  interestNames: string[]
  /** Single-valued dimensions, expressed as one-element lists so every
   *  dimension goes through the same 2x2 machinery. Empty when unknown. */
  placements: string[]
  creatives: string[]
  creativeNames: string[]
  won: boolean
}

/** CRM statuses that count as a lead having gone somewhere. Mirrors
 *  campaign-quality's QUALIFIED_STATUSES so one lead is never "good" in one
 *  screen and "not yet" in another. */
const PROGRESSED = ['qualified', 'viewing', 'negotiation', 'converted', 'closed']

export async function snapshotOutcomes(): Promise<SnapshotOutcomeRow[]> {
  try {
    await ensureTable()
    const rows = await query<{
      lead_id: string; behavior_ids: string[]; behavior_names: string[]
      interest_ids: string[]; interest_names: string[]; status: string | null
      placement: string | null; ad_id: string | null; creative_headline: string | null
    }>(
      `SELECT s.lead_id, s.behavior_ids, s.behavior_names, s.interest_ids, s.interest_names,
              s.placement, s.ad_id, s.creative_headline, l.status
         FROM freehold_lead_audience_snapshot s
         JOIN freehold_site_leads l ON l.id = s.lead_id
        WHERE l.archived IS NOT TRUE`,
    )
    return rows.map((r) => ({
      leadId: r.lead_id,
      behaviorIds: r.behavior_ids ?? [],
      behaviorNames: r.behavior_names ?? [],
      interestIds: r.interest_ids ?? [],
      interestNames: r.interest_names ?? [],
      placements: r.placement ? [r.placement] : [],
      creatives: r.ad_id ? [r.ad_id] : [],
      // The headline is what a human recognises an ad by; the id is what makes
      // it unique. Falling back to the id keeps an unnamed creative countable.
      creativeNames: r.ad_id ? [r.creative_headline || r.ad_id] : [],
      won: !!r.status && PROGRESSED.includes(r.status),
    }))
  } catch {
    return []
  }
}
