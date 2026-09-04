/**
 * THE LEDGER ITSELF — every event this account has told Meta about.
 *
 * The rules are in capi-ledger.ts; this is the table and the two reads that
 * make it worth having. Written on every send, success or failure, because
 * the failures are the half that was invisible: a rejected event used to
 * leave a console line and nothing else.
 *
 * Never throws. An ad platform must not be able to fail a CRM write, and
 * neither may our own bookkeeping about one.
 */
import { query, ensureOnce } from '@/lib/db'
import {
  coverage, type Coverage, type MatchKey, type MetaEventResponse,
} from '@/lib/freehold/capi-ledger'

/** DDL through ensureOnce, keyed per TENANT SCHEMA. A module-level memo would
 *  run the CREATE TABLE once per process — so the first tenant served by an
 *  instance gets the table and every other tenant on that instance silently
 *  writes into a table that does not exist in their schema. */
const ensure = () => ensureOnce('freehold_meta_capi_events', async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_meta_capi_events (
      id bigserial PRIMARY KEY,
      lead_id uuid,
      stage text NOT NULL,
      event_id text NOT NULL,
      event_name text,
      sent_at timestamptz NOT NULL DEFAULT now(),
      ok boolean NOT NULL,
      http_status integer,
      events_received integer,
      fbtrace_id text,
      messages text[],
      match_keys text[],
      attributes_to_ad boolean NOT NULL DEFAULT false
    )
  `)
  // The deterministic event id is the second line of defence against a
  // duplicate (the stage array on the lead is the first). A unique index makes
  // it the last, at the database, where a race between two writers cannot get
  // past it.
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS freehold_meta_capi_events_event_id_idx
       ON freehold_meta_capi_events (event_id)`,
  ).catch(() => undefined)
})

export async function recordCapiEvent(row: {
  leadId: string | null
  stage: string
  eventId: string
  eventName?: string | null
  response: MetaEventResponse
  matchKeys: readonly MatchKey[]
  attributesToAd: boolean
}): Promise<void> {
  try {
    await ensure()
    await query(
      `INSERT INTO freehold_meta_capi_events
         (lead_id, stage, event_id, event_name, ok, http_status,
          events_received, fbtrace_id, messages, match_keys, attributes_to_ad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       -- A SUCCESS IS NEVER OVERWRITTEN; A FAILURE IS.
       --
       -- The event id is deterministic, so a retry of a failed send arrives
       -- with the same id. DO NOTHING would freeze the first failure on the
       -- record forever and the eventual success would be invisible; a plain
       -- DO UPDATE could let a later failed retry erase a delivery that
       -- actually happened. So the row advances only while it is still a
       -- failure.
       ON CONFLICT (event_id) DO UPDATE SET
         sent_at = now(), ok = EXCLUDED.ok, http_status = EXCLUDED.http_status,
         events_received = EXCLUDED.events_received, fbtrace_id = EXCLUDED.fbtrace_id,
         messages = EXCLUDED.messages, match_keys = EXCLUDED.match_keys,
         attributes_to_ad = EXCLUDED.attributes_to_ad
       WHERE freehold_meta_capi_events.ok IS NOT TRUE`,
      [
        row.leadId, row.stage, row.eventId, row.eventName ?? null,
        row.response.ok, row.response.status,
        row.response.eventsReceived ?? null, row.response.fbtraceId ?? null,
        row.response.messages ?? [], [...row.matchKeys], row.attributesToAd,
      ],
    )
  } catch {
    // Bookkeeping never fails the send it is describing.
  }
}

/**
 * How much of the team's judgment reached Meta, and how much of that could be
 * traced to an ad.
 *
 * `rated` counts leads a human has actually rated — the events that SHOULD
 * exist. Not "leads": an unrated lead is not a missing event, it is missing
 * work, and conflating the two would blame the sender for the queue.
 */
export async function capiCoverage(): Promise<Coverage & { withWarnings: number }> {
  const empty = { ...coverage({ rated: 0, delivered: 0, attributing: 0 }), withWarnings: 0 }
  try {
    await ensure()
    const [ratedRow] = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND value_rating IS NOT NULL`,
    )
    const [sentRow] = await query<{ delivered: string; attributing: string; warned: string }>(
      `SELECT COUNT(*) FILTER (WHERE ok)::text AS delivered,
              COUNT(*) FILTER (WHERE ok AND attributes_to_ad)::text AS attributing,
              COUNT(*) FILTER (WHERE ok AND array_length(messages, 1) > 0)::text AS warned
         FROM freehold_meta_capi_events`,
    )
    return {
      ...coverage({
        rated: Number(ratedRow?.n ?? 0),
        delivered: Number(sentRow?.delivered ?? 0),
        attributing: Number(sentRow?.attributing ?? 0),
      }),
      withWarnings: Number(sentRow?.warned ?? 0),
    }
  } catch {
    return empty
  }
}

/** The most recent events, newest first — what a person opens when they want
 *  to know whether the loop is running today rather than in aggregate. */
export async function recentCapiEvents(limit = 50) {
  try {
    await ensure()
    return await query<{
      lead_id: string | null; stage: string; event_name: string | null
      sent_at: string; ok: boolean; http_status: number | null
      events_received: number | null; messages: string[] | null
      match_keys: string[] | null; attributes_to_ad: boolean
    }>(
      `SELECT lead_id, stage, event_name, sent_at::text, ok, http_status,
              events_received, messages, match_keys, attributes_to_ad
         FROM freehold_meta_capi_events
        ORDER BY id DESC LIMIT $1`,
      [Math.min(200, Math.max(1, limit))],
    )
  } catch {
    return []
  }
}
