/**
 * BRINGING REAL LEADS IN.
 *
 * The Data Pool takes rows and throws the contacts away. That is not a bug —
 * it is an anonymised statistics pool, and stripping names, phones and emails
 * is the entire promise it makes to every tenant sharing into it.
 *
 * The bug is that it was the ONLY import. Someone with a real lead list
 * dropped it there, watched 24,713 rows land, and got a pool that cannot ring
 * anybody. There was nowhere else to put them: leads could only be added one
 * at a time through a modal.
 *
 * So a file with contacts in it now goes to BOTH places, and each takes what
 * it is for:
 *
 *   the CRM   — the person. Name, phone, email, budget, interest. Private to
 *               this tenant, workable, assignable, and the only thing that can
 *               seed a real Meta Custom Audience.
 *   the pool  — the shape. Area, price band, outcome, and the rest, with no
 *               contact attached, which is what the shared brain is allowed to
 *               see.
 *
 * Pure — normalising and validating only. The inserts live in the route.
 */

/** A lead as it arrives from a mapped file. Every field optional: real
 *  exports are ragged, and refusing a whole file over one blank cell is how a
 *  migration gets abandoned. */
export interface RawLead {
  name?: string
  phone?: string
  email?: string
  source?: string
  interest?: string
  budgetAed?: string
  message?: string
  status?: string
  assignedTo?: string
}

export interface CleanLead {
  name: string
  phone: string | null
  email: string | null
  source: string
  interest: string | null
  budgetAed: number | null
  message: string | null
  status: string
  assignedTo: string | null
  /** What makes this person the same person as another row. */
  dedupeKey: string
}

export interface ImportPlan {
  /** Rows that carry a usable contact — these become CRM leads. */
  leads: CleanLead[]
  /** Rows with a name but no way to reach them. Kept separate and COUNTED,
   *  never silently dropped: a list that is 40% unreachable is a fact about
   *  the list, and the person importing should learn it now rather than after
   *  a week of wondering why nobody answers. */
  unreachable: number
  /** Rows that were the same person as an earlier row in the same file. */
  duplicatesInFile: number
  /** Rows with nothing usable at all. */
  empty: number
}

/** Digits only, last 9 kept — the part that identifies a UAE number whatever
 *  the prefix, so +971 50 123 4567, 0501234567 and 971501234567 are one
 *  person rather than three leads three brokers each call. */
export function normalisePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length < 7) return ''
  return digits.slice(-9)
}

export function normaliseEmail(raw: string): string {
  const e = (raw || '').trim().toLowerCase()
  // Deliberately loose. A strict RFC test rejects real addresses people
  // actually use, and the cost of accepting a bad one is a bounced email —
  // far cheaper than dropping a live buyer during a migration.
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e) ? e : ''
}

const STATUSES = new Set(['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'converted', 'closed', 'lost'])

/** Map whatever their export called it onto a status we store. Anything
 *  unrecognised becomes 'new' — a lead we cannot place is still a lead. */
export function normaliseStatus(raw: string): string {
  const s = (raw || '').trim().toLowerCase()
  if (STATUSES.has(s)) return s
  if (/win|won|deal|sold|closed/.test(s)) return 'closed'
  if (/lost|dead|junk|invalid/.test(s)) return 'lost'
  if (/qualif|hot/.test(s)) return 'qualified'
  if (/view|visit|meeting/.test(s)) return 'viewing'
  if (/negoti|offer/.test(s)) return 'negotiation'
  if (/contact|call|follow/.test(s)) return 'contacted'
  return 'new'
}

export function parseBudget(raw: string): number | null {
  const n = Number((raw || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Turn mapped rows into leads worth inserting.
 *
 * A row needs a way to REACH someone to become a lead. A name on its own is
 * not a lead, it is a note — and importing thousands of them would fill a
 * broker's queue with people nobody can call, which is the fastest way to
 * make them stop trusting the queue.
 */
export function planLeadImport(rows: RawLead[]): ImportPlan {
  const leads: CleanLead[] = []
  const seen = new Set<string>()
  let unreachable = 0
  let duplicatesInFile = 0
  let empty = 0

  for (const r of rows) {
    const name = (r.name || '').trim()
    const phone = normalisePhone(r.phone || '')
    const email = normaliseEmail(r.email || '')

    if (!name && !phone && !email) { empty++; continue }
    if (!phone && !email) { unreachable++; continue }

    // Phone first: in this market it is the identity a broker actually uses,
    // and one person's email varies more than their number.
    const dedupeKey = phone ? `p:${phone}` : `e:${email}`
    if (seen.has(dedupeKey)) { duplicatesInFile++; continue }
    seen.add(dedupeKey)

    leads.push({
      // A contactable row with no name is still worth having — "Unnamed" is
      // honest, and a broker can fill it in on the first call.
      name: name || (phone ? `+${phone}` : email),
      phone: (r.phone || '').trim() || null,
      email: email || null,
      source: (r.source || '').trim() || 'Imported',
      interest: (r.interest || '').trim() || null,
      budgetAed: parseBudget(r.budgetAed || ''),
      message: (r.message || '').trim() || null,
      status: normaliseStatus(r.status || ''),
      assignedTo: (r.assignedTo || '').trim() || null,
      dedupeKey,
    })
  }

  return { leads, unreachable, duplicatesInFile, empty }
}
