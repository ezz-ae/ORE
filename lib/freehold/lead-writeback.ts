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
/**
 * A DEAL REACHED ITS FINAL STATE — teach every downstream reader.
 *
 * Two writes, both idempotent, both fire-and-forget from the deals route:
 *
 *  1. Stamp freehold_site_leads.deal_value_aed — the column the seed builder
 *     has read since it shipped and NOTHING ever wrote (the deep-seed route
 *     even documents it as "created lazily by the deals feature"; this is
 *     that feature finally doing it). GREATEST keeps the biggest deal when a
 *     person buys twice, because a seed weights people, not transactions.
 *  2. Run the write-back, which now sees the closed deal and sends the
 *     Purchase with the real value — once, guarded by meta_reported_stages.
 */
export async function reportDealCloseToMeta(deal: {
  leadId: string | null
  propertyValueAed?: number | null
}): Promise<void> {
  if (!deal.leadId) return
  const value = Number(deal.propertyValueAed)
  if (Number.isFinite(value) && value > 0) {
    try {
      await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS deal_value_aed numeric`)
      await query(
        `UPDATE freehold_site_leads
            SET deal_value_aed = GREATEST(coalesce(deal_value_aed, 0), $2)
          WHERE id = $1`,
        [deal.leadId, value],
      )
    } catch { /* the stamp is an enrichment, never a blocker */ }
  }
  await reportLeadToMeta(deal.leadId).catch(() => null)
}

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
      meta_fbc: string | null
      meta_fbp: string | null
      meta_lead_id: string | null
    }>(
      `SELECT status, value_rating, email, phone, interest, meta_reported_stages,
              meta_fbc, meta_fbp, meta_lead_id
         FROM freehold_site_leads WHERE id = $1 LIMIT 1`,
      [leadId],
    )
    const lead = rows[0]
    if (!lead) return null

    // THE DEAL IS THE MONEY'S OWN RECORD. A final approved/closed deal makes
    // this lead won whatever its CRM column says, and its property value is
    // the only number honest enough to ride the Purchase event. Defensive:
    // the deals table is created lazily by its own feature, and a database
    // without it means "no deals", never a failed write-back.
    let dealClosed = false
    let dealValueAed: number | null = null
    try {
      const deals = await query<{ n: number; v: number | null }>(
        `SELECT COUNT(*)::int AS n, MAX(property_value_aed) AS v
           FROM freehold_site_deals
          WHERE lead_id = $1 AND status IN ('approved', 'closed')`,
        [leadId],
      )
      dealClosed = (deals[0]?.n ?? 0) > 0
      const v = Number(deals[0]?.v)
      if (dealClosed && Number.isFinite(v) && v > 0) dealValueAed = v
    } catch { /* no deals feature in this database */ }

    const sent = (lead.meta_reported_stages ?? []).filter(
      (s): s is WriteBackStage => s === 'qualified' || s === 'won',
    )
    const { stage } = writeBackFor({
      status: lead.status,
      valueRating: lead.value_rating,
      sent,
      dealClosed,
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
      // THE CLICK COOKIE FROM THE VISIT THAT PRODUCED THIS PERSON.
      //
      // It was read at submission, handed to that one Lead event and dropped,
      // so these events — fired weeks later and carrying the only outcome
      // Meta cannot see for itself — went out with a hashed email and phone
      // and nothing else. `_fbc` is the strongest match Meta accepts, and the
      // strongest signal this account can send was going out with the weakest
      // identity it had. See lib/freehold/click-identity.ts.
      fbc: lead.meta_fbc ?? undefined,
      fbp: lead.meta_fbp ?? undefined,
      // WHICH AD FOUND THEM, not merely that somebody good bought.
      //
      // Meta's own id for this form submission. With it Meta joins the outcome
      // straight to the originating ad, ad set and campaign — no matching, no
      // guessing from a hashed email weeks after the click. Stored on every
      // synced lead since the sync existed and never sent until now, so every
      // qualified and won event this account has ever reported landed without
      // telling Meta which creative earned it.
      leadId: lead.meta_lead_id ?? undefined,
      contentName: lead.interest ?? undefined,
      // The REAL deal value when one exists — the closed deal's property
      // price, read from the deals ledger above — and nothing otherwise.
      // Meta treats `value` as what a customer is worth: with it, value-based
      // lookalikes rank buyers by dirhams closed; with a placeholder, they
      // would rank them by our imagination. The builder additionally drops it
      // for anything but the Purchase.
      valueAED: dealValueAed,
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
