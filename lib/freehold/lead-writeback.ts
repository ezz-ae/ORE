import { query } from '@/lib/db'
import { sendQualifiedLead } from '@/lib/meta/capi'
import { writeBackFor, writeBackEventId, type WriteBackStage } from '@/lib/freehold/lead-stages'

/**
 * TELL META WHICH LEADS TURNED OUT TO BE REAL.
 *
 * Meta optimises for what it can see, and all it can see is that a form was
 * submitted. The rest — who answered, who qualified, who bought — lives in the
 * CRM and never travelled back, which is precisely why a campaign can look
 * excellent in Ads Manager while the numbers do not answer.
 *
 * Called after a lead is updated. Reads the lead's own state, decides whether
 * anything is worth sending, and sends it at most once per stage. Never
 * throws: an ad platform must not be able to fail a CRM write.
 *
 * What it does NOT do is decide anything on its own. The stage comes from a
 * human moving the card or rating the lead; nothing is inferred, and nothing
 * is sent on a guess, because Meta has no way to take an event back.
 */
export async function reportLeadToMeta(leadId: string): Promise<WriteBackStage | null> {
  try {
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_reported_stages text[]`)
      .catch(() => undefined)

    const rows = await query<{
      status: string | null
      value_rating: number | null
      email: string | null
      phone: string | null
      interest: string | null
      meta_reported_stages: string[] | null
    }>(
      `SELECT status, value_rating, email, phone, interest, meta_reported_stages
         FROM freehold_site_leads WHERE id = $1 LIMIT 1`,
      [leadId],
    )
    const lead = rows[0]
    if (!lead) return null

    const sent = (lead.meta_reported_stages ?? []).filter(
      (s): s is WriteBackStage => s === 'qualified' || s === 'won',
    )
    const { stage } = writeBackFor({
      status: lead.status,
      valueRating: lead.value_rating,
      sent,
    })
    if (!stage) return null

    // Marked BEFORE the send, not after. A duplicate "this lead was worth
    // 2 million" is worse than a missed one: it teaches the optimiser to buy
    // more of a customer who only existed once. The deterministic event id is
    // the second line of defence, not the first.
    await query(
      `UPDATE freehold_site_leads
          SET meta_reported_stages = array_append(coalesce(meta_reported_stages, '{}'), $2)
        WHERE id = $1`,
      [leadId, stage],
    )

    const ok = await sendQualifiedLead({
      eventId: writeBackEventId(leadId, stage),
      stage,
      // Our own id for this person, hashed on the way out — it joins this
      // event to the submission event as the same human without depending on
      // a cookie that iOS has usually already dropped.
      externalId: leadId,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      contentName: lead.interest ?? undefined,
      // No invented deal value. Meta treats `value` as what a customer is
      // worth, and a placeholder there quietly becomes the target the
      // optimiser aims at.
      valueAED: null,
    })
    if (!ok) {
      // Nothing reached Meta — release the stage so the next update can retry.
      await query(
        `UPDATE freehold_site_leads
            SET meta_reported_stages = array_remove(meta_reported_stages, $2)
          WHERE id = $1`,
        [leadId, stage],
      ).catch(() => undefined)
      return null
    }
    return stage
  } catch {
    return null
  }
}
