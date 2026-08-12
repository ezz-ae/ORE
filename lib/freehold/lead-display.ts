/**
 * WHAT A LEAD ROW SAYS ABOUT ITSELF.
 *
 * 571 leads, and every row read the same three things:
 *
 *     General enquiry
 *     Unknown
 *     —
 *
 * None of that was true, and none of it was necessary. Every one of those
 * leads arrived through a named Meta instant form, on a named campaign, for a
 * named project. The database HELD all of it — `utm_id` carries the campaign
 * id on every synced lead, and meta_campaign_projects maps that campaign to
 * its project. Nothing resolved it, so the row printed a placeholder instead
 * of a fact it already had.
 *
 * TWO RULES:
 *
 *  1. THE MOST SPECIFIC TRUE THING, NEVER A CATEGORY. A lead who typed what
 *     they want gets that. Failing that, the project the campaign sells.
 *     Failing that, the campaign itself — "cash offer new audiences" tells a
 *     broker what this person answered, and "General enquiry" tells them
 *     nothing at all.
 *
 *  2. WHEN THERE IS GENUINELY NOTHING, SAY NOTHING. Not "Unknown". A word
 *     that appears on every row is furniture the eye stops reading, and 571
 *     rows of "Unknown" is a screen that has trained its user to ignore the
 *     column. Absence is rendered as absence and the space goes to what is
 *     real.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

/** Where the label came from, so the row can style it and the guard can check
 *  the precedence held. Ordered most specific first. */
export const SUBJECT_KINDS = ['stated', 'project', 'campaign', 'form'] as const
export type SubjectKind = (typeof SUBJECT_KINDS)[number]

export interface LeadSubject { label: string; kind: SubjectKind }

const clean = (v: unknown): string => {
  const s = String(v ?? '').trim()
  // A stored placeholder is not a fact. Rows carrying the literal word from an
  // older import must not out-rank a real campaign name.
  if (!s || /^(unknown|n\/?a|none|null|undefined|general enquiry)$/i.test(s)) return ''
  return s
}

/**
 * The best true description of what this lead is about, or null.
 *
 * Null is a real answer and the caller renders it as nothing — see rule 2.
 */
export function leadSubject(src: {
  /** What the person actually said they wanted. */
  interest?: unknown
  /** The project their landing page or campaign belongs to. */
  projectName?: unknown
  /** The campaign that brought them. */
  campaignName?: unknown
  /** The instant form they filled in, when nothing else is known. */
  formName?: unknown
}): LeadSubject | null {
  const stated = clean(src.interest)
  if (stated) return { label: stated, kind: 'stated' }
  const project = clean(src.projectName)
  if (project) return { label: project, kind: 'project' }
  const campaign = clean(src.campaignName)
  if (campaign) return { label: campaign, kind: 'campaign' }
  const form = clean(src.formName)
  if (form) return { label: form, kind: 'form' }
  return null
}

/**
 * A budget, or nothing.
 *
 * The old row printed the word "Unknown" for every lead without a stated
 * budget — which is almost all of them, because a Meta instant form does not
 * ask. A column that says "Unknown" 571 times has taught its reader to skip
 * it, and on the day a real budget appears they will skip that too.
 */
export function leadBudgetLabel(budgetAed: unknown, currency = 'AED'): string | null {
  const n = typeof budgetAed === 'number' ? budgetAed : Number(String(budgetAed ?? '').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return `${currency} ${Math.round(n).toLocaleString()}`
}

/**
 * WHO OWNS THIS LEAD — and unassigned is not a blank.
 *
 * The dash said "no data". Unassigned is not missing data; it is a STATE, and
 * an urgent one: a lead nobody owns is a lead nobody is calling. The row names
 * it so it can be acted on rather than scrolled past.
 */
export function leadOwnerLabel(agent: unknown, unassignedWord: string): { label: string; unassigned: boolean } {
  const a = clean(agent)
  return a ? { label: a, unassigned: false } : { label: unassignedWord, unassigned: true }
}
