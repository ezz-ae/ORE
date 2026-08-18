/**
 * WHERE A LEAD CAME FROM, IN WORDS SOMEBODY CAN SAY OUT LOUD.
 *
 * The CRM showed `meta_form:120251276961280734`. Nobody can read that, and
 * nobody can act on it — but the deeper problem is the case it cannot describe
 * at all.
 *
 * The correct way to run two offers is two ads in one campaign, each with its
 * own lead form, so the ads do not bid against each other. Do that and the
 * campaign name identifies nothing: two leads from the same campaign came from
 * different ads, different forms, and different promises. The one thing that
 * separates them is exactly the thing the screen was hiding behind a number.
 *
 * So the origin is a SENTENCE, built from the names stored at sync time:
 *
 *     Jul26 | cashoffer | (B) · 77 Shades
 *
 * ── WHY THE NAMES ARE STORED, NOT LOOKED UP ──────────────────────────────
 *
 * A name resolved when a screen renders is a Meta call on every page load, and
 * it vanishes the day somebody deletes the form. The lead outlives the form;
 * the record of where it came from has to outlive it too. meta-lead-sync writes
 * both names on arrival and backfills them for rows that predate the columns.
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */

export interface LeadOrigin {
  /** `meta_form:{id}`, `lp:{slug}`, `direct`, … — whatever the row carries. */
  source?: string | null
  formName?: string | null
  adName?: string | null
  formId?: string | null
}

/** Everything before the colon in a `kind:value` source, or the whole string. */
const kindOf = (source: string): string =>
  source.includes(':') ? source.slice(0, source.indexOf(':')) : source

/**
 * The line a person reads.
 *
 * Form first, because the form is what the lead actually filled in and what
 * the offer was. The ad is the second half — it says which creative brought
 * them, which is the half that distinguishes two ads inside one campaign.
 *
 * An id is NEVER printed as a label. When no name is known the answer is the
 * kind of thing it was ("Instant form") rather than its number: a reader can
 * do nothing with the number, and showing it implies somebody chose it.
 */
export function leadOriginLabel(o: LeadOrigin, fallback: string): string {
  const form = (o.formName ?? '').trim()
  const ad = (o.adName ?? '').trim()

  if (form && ad) return `${form} · ${ad}`
  if (form) return form
  // An ad name with no form name still beats a number — it says which creative
  // this person answered.
  if (ad) return ad

  const source = (o.source ?? '').trim()
  if (!source) return fallback
  // A `meta_form:123` with no name resolved yet: say what it is, not which one.
  // The names arrive on the next sync sweep and this line becomes specific.
  if (kindOf(source) === 'meta_form') return fallback
  return source
}

/** True when the only thing we hold is an id — the state the sync repairs. */
export const originIsUnnamed = (o: LeadOrigin): boolean =>
  !(o.formName ?? '').trim() && !(o.adName ?? '').trim()
