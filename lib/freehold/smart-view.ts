/**
 * SMART VIEW — a saved report you ask for in property words.
 *
 * Meta's Ads Manager has "Create view": you name it, then assemble it from
 * Filters, Columns, Sorting, Breakdowns and Attribution settings, and it is
 * saved for next time. The idea is right and the assembly is the problem —
 * before you can see anything you have to already know that Frequency is the
 * fatigue number, that Reach and Impressions are different, that a 7-day-click
 * attribution window will not match the 1-day-view one, and which twelve of the
 * three hundred available columns are the ones that matter for a property lead.
 *
 * Nobody running a brokerage knows that, and nobody should have to. They know
 * exactly what they want:
 *
 *   "which project is actually selling"
 *   "where did yesterday's money go"
 *   "which ads have gone stale"
 *   "who did nobody call"
 *   "what deserves more money"
 *   "what is about to waste money this week"
 *
 * SO THERE IS NO COLUMN PICKER. The question picks the columns, the sort, the
 * grouping and the filter — that is what makes it a TEMPLATE rather than a
 * blank form with better labels. Every column below is named for the thing it
 * counts in this business: enquiries, viewings, sold, money in. Frequency is
 * "times each person saw it". Reach is "people who saw it". Neither word
 * appears on the screen and neither is ever a choice.
 *
 * AND IT IS BUILT BEFORE IT IS OPENED. A saved view that recomputes on every
 * visit is a loading spinner with a name; this one is built on a schedule and
 * carries the moment it was built, so opening it is instant and the screen can
 * say how old the answer is instead of pretending it is live.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */

/** Walkable — each is a question somebody actually asks. */
export const VIEW_TEMPLATES = [
  'sellingProjects', 'moneyToday', 'goneStale', 'uncalled', 'readyToScale', 'aboutToWaste',
] as const
export type ViewTemplate = (typeof VIEW_TEMPLATES)[number]

/**
 * Walkable — every column this product will show, named for what it counts.
 *
 * The list is deliberately short. Meta offers hundreds and the length is the
 * problem: a report with forty columns is one nobody reads, so it gets
 * screenshotted into WhatsApp with a circle drawn round one number.
 */
export const VIEW_COLUMNS = [
  'spend',          // Spent
  'enquiries',      // People who asked
  'worthCalling',   // The ones worth calling
  'viewings',       // Got to a viewing
  'sold',           // Sold
  'moneyIn',        // Money in
  'costPerEnquiry', // What an enquiry cost
  'costPerSale',    // What a sale cost
  'seenBy',         // People who saw it
  'timesSeen',      // Times each person saw it   (frequency, never called that)
  'answeredIn',     // How fast we answered
  'daysLive',       // Days running
] as const
export type ViewColumn = (typeof VIEW_COLUMNS)[number]

/**
 * What each row of the sheet stands for.
 *
 * No 'ad' grouping yet, deliberately. Frequency and reach are read at the
 * campaign level in this product, and a creative-level staleness sheet built
 * from campaign-level numbers would attribute one tired picture's fatigue to
 * every picture beside it. Creative decay is its own piece of work; a grouping
 * with no honest data behind it is the kind of thing this file exists to avoid.
 */
export const VIEW_GROUPINGS = ['project', 'campaign'] as const
export type ViewGrouping = (typeof VIEW_GROUPINGS)[number]

/** How often the sheet rebuilds itself. */
export const VIEW_SCHEDULES = ['everyMorning', 'everyMonday', 'onOpen'] as const
export type ViewSchedule = (typeof VIEW_SCHEDULES)[number]

/** Who else can open it. */
export const VIEW_ACCESS = ['onlyMe', 'myTeam', 'everyone'] as const
export type ViewAccess = (typeof VIEW_ACCESS)[number]

/** How far back the sheet looks. Named for the question, not the API window. */
export const VIEW_RANGES = ['sinceLaunch', 'last30', 'thisMonth'] as const
export type ViewRange = (typeof VIEW_RANGES)[number]

/**
 * A template's whole shape: what a row is, what the columns are, what it sorts
 * by, and which rows it keeps.
 *
 * The FILTER is part of the template and not a separate control, because "ads
 * that have gone stale" without the staleness filter is just a list of ads. A
 * question that does not narrow anything is not a question.
 */
export interface TemplateSpec {
  groupBy: ViewGrouping
  columns: readonly ViewColumn[]
  /** The column the sheet is ordered by. */
  sortBy: ViewColumn
  /** Biggest first is the default; some questions want the worst at the top. */
  worstFirst: boolean
  /** Which rows survive — the question's own narrowing. */
  keep: ViewFilter
}

/**
 * Walkable — the things that will stop or waste a campaign, in the words of
 * the thing that is wrong rather than of the system that noticed.
 */
export const RISK_KINDS = ['permitLapsing', 'notServing', 'budgetTooThin'] as const
export type RiskKind = (typeof RISK_KINDS)[number]

/** Walkable — each is a rule about which rows belong in the answer. */
export const VIEW_FILTERS = [
  'anySpend', 'hasSales', 'stale', 'slowlyAnswered', 'provenAndFresh', 'atRisk',
] as const
export type ViewFilter = (typeof VIEW_FILTERS)[number]

export const TEMPLATE_SPEC: Record<ViewTemplate, TemplateSpec> = {
  // "Which project is actually selling" — the money question, by project,
  // because a brokerage buys advertising per project and sells per project.
  sellingProjects: {
    groupBy: 'project',
    columns: ['spend', 'enquiries', 'worthCalling', 'viewings', 'sold', 'moneyIn', 'costPerSale'],
    sortBy: 'moneyIn', worstFirst: false, keep: 'anySpend',
  },
  // "Where did the money go" — the same money, arranged by what bought it.
  moneyToday: {
    groupBy: 'campaign',
    columns: ['spend', 'enquiries', 'costPerEnquiry', 'worthCalling', 'sold', 'daysLive'],
    sortBy: 'spend', worstFirst: false, keep: 'anySpend',
  },
  // "Which ads have gone stale" — the same people keep seeing it and it has
  // stopped producing. Worst first, because this list exists to be acted on.
  goneStale: {
    groupBy: 'campaign',
    columns: ['spend', 'seenBy', 'timesSeen', 'enquiries', 'costPerEnquiry', 'daysLive'],
    sortBy: 'timesSeen', worstFirst: false, keep: 'stale',
  },
  // "Who did nobody call" — an advertising report about the desk, which is
  // where most wasted property spend actually goes.
  uncalled: {
    groupBy: 'campaign',
    columns: ['enquiries', 'answeredIn', 'worthCalling', 'spend', 'costPerEnquiry'],
    sortBy: 'answeredIn', worstFirst: true, keep: 'slowlyAnswered',
  },
  // "What deserves more money" — proven AND still finding new people. The
  // second half is what stops this being a list of things about to saturate.
  readyToScale: {
    groupBy: 'campaign',
    columns: ['spend', 'enquiries', 'worthCalling', 'sold', 'costPerSale', 'timesSeen'],
    sortBy: 'costPerSale', worstFirst: true, keep: 'provenAndFresh',
  },
  // "What will waste money this week" — permits lapsing, pages closing,
  // budgets too thin to learn. Everything that is fine is left out.
  aboutToWaste: {
    groupBy: 'campaign',
    columns: ['spend', 'enquiries', 'costPerEnquiry', 'daysLive'],
    sortBy: 'spend', worstFirst: false, keep: 'atRisk',
  },
}

/** One row of the built sheet. Every field is a count or a price — nothing on
 *  a row is a judgement, so a row can be re-sorted without becoming a lie. */
export interface ViewRow {
  /** Stable key — project slug, campaign id or ad id. */
  id: string
  /** What it is called on screen. */
  label: string
  spend: number
  enquiries: number
  worthCalling: number
  viewings: number
  sold: number
  moneyIn: number
  /** People who saw it, and how many times each. 0 when the platform did not
   *  report it — never invented, and the cell renders empty rather than zero. */
  seenBy: number
  timesSeen: number
  /** Median minutes to the first reply. null when nobody was ever answered. */
  answeredIn: number | null
  daysLive: number
  /** Is the audience used up? Decided upstream (lookalike-ladder). */
  saturated: boolean
  /** Anything that will stop or waste this campaign. Empty when nothing is
   *  wrong — which is most rows, most of the time. */
  risks: RiskKind[]
}

/** Cost columns are derived, never stored — so a row cannot carry a price that
 *  disagrees with the counts beside it. */
export function cellOf(row: ViewRow, col: ViewColumn): number | null {
  switch (col) {
    case 'spend':          return row.spend
    case 'enquiries':      return row.enquiries
    case 'worthCalling':   return row.worthCalling
    case 'viewings':       return row.viewings
    case 'sold':           return row.sold
    case 'moneyIn':        return row.moneyIn
    // A cost with nothing bought is not zero and not infinity — it is a cell
    // with no number in it, and that is what the sheet shows.
    case 'costPerEnquiry': return row.enquiries > 0 ? row.spend / row.enquiries : null
    case 'costPerSale':    return row.sold > 0 ? row.spend / row.sold : null
    case 'seenBy':         return row.seenBy > 0 ? row.seenBy : null
    case 'timesSeen':      return row.timesSeen > 0 ? row.timesSeen : null
    case 'answeredIn':     return row.answeredIn
    case 'daysLive':       return row.daysLive
  }
}

/**
 * How many times one person must have seen an ad before it counts as tired.
 *
 * Meta's own working number for a saturating audience, the same one
 * lookalike-ladder uses as its ceiling. Kept here rather than imported so a
 * report cannot quietly start disagreeing with the ladder about what tired
 * means — the guard asserts the two are equal.
 */
export const TIRED_TIMES_SEEN = 1.6

/**
 * How slow an answer has to be before a campaign lands in "who did nobody
 * call". Four hours: inside a working day, a property enquiry that has waited
 * this long has usually already spoken to somebody else.
 */
export const SLOW_ANSWER_MINUTES = 240

/**
 * Enquiries a row needs before a "nobody called" or "gone stale" verdict
 * counts. Three, because these two lists name and shame — one slow answer is
 * a Tuesday, not a pattern.
 */
export const MIN_ROWS_TO_FLAG = 3

/** Does this row belong in the answer? */
export function keeps(row: ViewRow, filter: ViewFilter): boolean {
  switch (filter) {
    case 'anySpend':  return row.spend > 0
    case 'hasSales':  return row.sold > 0
    // Tired AND not producing. Tired alone is a winner at scale, and putting
    // winners on a list headed "gone stale" is how a list gets ignored.
    case 'stale':
      return row.enquiries >= MIN_ROWS_TO_FLAG
        ? row.timesSeen >= TIRED_TIMES_SEEN && row.saturated
        : row.timesSeen >= TIRED_TIMES_SEEN && row.saturated && row.spend > 0
    case 'slowlyAnswered':
      return row.enquiries >= MIN_ROWS_TO_FLAG
        && (row.answeredIn === null || row.answeredIn >= SLOW_ANSWER_MINUTES)
    // Proven AND still reaching new people. Without the second half this is a
    // list of campaigns about to stop working.
    case 'provenAndFresh': return row.sold > 0 && !row.saturated
    case 'atRisk':         return row.risks.length > 0
  }
}

/**
 * Order the sheet.
 *
 * A missing number always sorts LAST, whichever direction the sort runs. On a
 * worst-first sheet an empty cell would otherwise take the top row and the
 * loudest position on the page would belong to the row with no evidence.
 */
export function sortRows(rows: ViewRow[], by: ViewColumn, worstFirst: boolean): ViewRow[] {
  return [...rows].sort((a, b) => {
    const x = cellOf(a, by)
    const y = cellOf(b, by)
    if (x === null && y === null) return a.label.localeCompare(b.label)
    if (x === null) return 1
    if (y === null) return -1
    if (x === y) return a.label.localeCompare(b.label)
    return worstFirst ? x - y : y - x
  })
}

/** Build the sheet for a template: filter, then order. */
export function buildSheet(rows: ViewRow[], template: ViewTemplate): ViewRow[] {
  const spec = TEMPLATE_SPEC[template]
  return sortRows(rows.filter((r) => keeps(r, spec.keep)), spec.sortBy, spec.worstFirst)
}

/** The totals strip. Counts add up; prices are re-derived from the totals,
 *  never averaged from the rows — an average of costs weights a campaign that
 *  spent AED 40 the same as one that spent AED 40,000. */
export interface SheetTotals {
  rows: number
  spend: number
  enquiries: number
  worthCalling: number
  viewings: number
  sold: number
  moneyIn: number
  costPerEnquiry: number | null
  costPerSale: number | null
}

export function totalsOf(rows: ViewRow[]): SheetTotals {
  const sum = (f: (r: ViewRow) => number) => rows.reduce((n, r) => n + f(r), 0)
  const spend = sum((r) => r.spend)
  const enquiries = sum((r) => r.enquiries)
  const sold = sum((r) => r.sold)
  return {
    rows: rows.length,
    spend, enquiries, sold,
    worthCalling: sum((r) => r.worthCalling),
    viewings: sum((r) => r.viewings),
    moneyIn: sum((r) => r.moneyIn),
    costPerEnquiry: enquiries > 0 && spend > 0 ? spend / enquiries : null,
    costPerSale: sold > 0 && spend > 0 ? spend / sold : null,
  }
}

/**
 * Is a snapshot old enough to rebuild?
 *
 * 'onOpen' always rebuilds. The scheduled ones rebuild when the clock has
 * passed their next build — and a view that has NEVER been built is due
 * immediately, so a freshly saved view is never an empty screen.
 */
export const REBUILD_AFTER_HOURS: Record<ViewSchedule, number> = {
  everyMorning: 24, everyMonday: 24 * 7, onOpen: 0,
}

export function isDue(schedule: ViewSchedule, builtAt: string | null, now: Date = new Date()): boolean {
  if (schedule === 'onOpen') return true
  if (!builtAt) return true
  const t = Date.parse(builtAt)
  if (!Number.isFinite(t)) return true
  return (now.getTime() - t) / 3_600_000 >= REBUILD_AFTER_HOURS[schedule]
}

/** A saved view, as stored. */
export interface SmartView {
  id: string
  name: string
  description: string
  template: ViewTemplate
  range: ViewRange
  access: ViewAccess
  schedule: ViewSchedule
  /** Narrow to one project. Empty = every project. */
  projectSlug: string
  /** Narrow to one channel. Empty = both. */
  channel: '' | 'meta' | 'google'
  createdBy: string
  createdAt: string
  /** When the sheet was last built. null = never. */
  builtAt: string | null
}
