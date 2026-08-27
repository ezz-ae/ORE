/**
 * DRAFTS YOU CHOOSE, NOT A DRAFT THAT CHOOSES YOU.
 *
 * The launcher kept ONE draft, under one key, and restored it silently on
 * mount. Every consequence of that followed:
 *
 *   · There was no way to start a new campaign. Opening the launcher put the
 *     last one back on screen, and the only escape was clearing fields by hand
 *     — a form with thirty of them.
 *   · Two campaigns could not be worked on in parallel. Starting the second
 *     overwrote the first with no warning and no record that it had existed.
 *   · A launch cleared it, so a campaign somebody spent an hour on and then
 *     abandoned was simply gone.
 *
 * The fix is not "stop saving". Saving is right — people leave, phones die,
 * tabs close. The fix is that a draft is an OFFER rather than a state: when
 * the launcher opens with drafts on file it says what it has and asks, and
 * "start fresh" is one of the answers.
 *
 * ── WHY EACH DRAFT CARRIES A SUMMARY ─────────────────────────────────────
 *
 * A list of "Draft — 14:32" tells nobody which one is which, so the chooser
 * would be a coin toss and people would pick the top one out of impatience.
 * `summarise` builds the line from what the draft actually holds — the
 * campaign's name, the project, the budget — so the choice is made on content
 * rather than on a timestamp.
 *
 * Pure — the storage adapter is injected, so this runs in a guard suite with
 * no browser. See `campaign-drafts-test.ts`.
 */

/** How many drafts are kept. Beyond this the oldest is dropped. */
export const MAX_DRAFTS = 8

/**
 * The shape stored per draft. `data` is the wizard's own state and this module
 * deliberately knows nothing about its fields beyond the few it summarises —
 * the launcher's state changes often and a draft store that had to be updated
 * alongside it would be updated late.
 */
export interface StoredDraft {
  id: string
  /** Epoch ms of the last edit. */
  at: number
  data: Record<string, unknown>
}

export interface DraftSummary {
  id: string
  at: number
  /** The line a person picks by. Never empty. */
  title: string
  /** The quieter second line: project, budget, whatever is known. */
  detail: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * What this draft is, in words.
 *
 * `fallback` is passed in rather than written here because it is the only
 * translated string this module would otherwise need, and a pure module that
 * holds one English sentence is a pure module somebody will add a second to.
 */
export function summarise(d: StoredDraft, fallback: string): DraftSummary {
  const name = str(d.data.campaignName)
  const headline = Array.isArray(d.data.headlines) ? str(d.data.headlines[0]) : ''
  const listing = str(d.data.listingId)
  const budget = num(d.data.dailyBudgetAED)

  const bits: string[] = []
  if (listing) bits.push(listing)
  if (budget > 0) bits.push(`AED ${budget.toLocaleString('en-US')}/day`)

  return {
    id: d.id,
    at: d.at,
    // Name first, then whatever the ad would have said — either is something
    // the operator typed and will recognise.
    title: name || headline || listing || fallback,
    detail: bits.join(' · '),
  }
}

/**
 * Is this draft worth keeping at all?
 *
 * A draft is written on every keystroke, so a launcher somebody opened and
 * closed leaves one behind. Offering it back is noise, and enough noise turns
 * the chooser into a dialog people dismiss without reading — which is how the
 * silent restore behaved in the first place.
 *
 * "Worth keeping" is: it has a name, or a headline, or a picture, or a
 * project. Anything less is an empty form with a timestamp.
 */
export function isSubstantial(d: StoredDraft): boolean {
  const hasText = !!str(d.data.campaignName) || !!str(d.data.primaryText)
  const hasHead = Array.isArray(d.data.headlines) && !!str(d.data.headlines[0])
  const hasImage = !!str(d.data.imageHash) || !!str(d.data.imageUrl)
  return hasText || hasHead || hasImage || !!str(d.data.listingId)
}

/** The storage this module reads and writes. Injected so guards need no browser. */
export interface DraftStore {
  read(): string | null
  write(raw: string): void
}

const parse = (raw: string | null): StoredDraft[] => {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter((d): d is StoredDraft =>
      !!d && typeof d === 'object' && typeof d.id === 'string' && typeof d.data === 'object')
  } catch { return [] }
}

/** Every kept draft, newest first, empties dropped. */
export function listDrafts(store: DraftStore): StoredDraft[] {
  return parse(store.read()).filter(isSubstantial).sort((a, b) => b.at - a.at)
}

/**
 * Write one draft, creating or replacing it by id.
 *
 * Replacing by ID rather than appending is what lets the launcher save on every
 * keystroke without filling the store — one editing session is one draft,
 * however many times it is written.
 *
 * Never throws. Storage is full, or blocked in a private window, far more
 * often than anybody expects, and losing the draft is not a reason to lose the
 * campaign somebody is typing.
 */
export function saveDraft(store: DraftStore, id: string, data: Record<string, unknown>, now: number): void {
  const kept = parse(store.read()).filter((d) => d.id !== id)
  const next: StoredDraft = { id, at: now, data }
  const all = [next, ...kept]
    .filter(isSubstantial)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_DRAFTS)
  try { store.write(JSON.stringify(all)) } catch { /* full or blocked storage */ }
}

export function deleteDraft(store: DraftStore, id: string): void {
  const kept = parse(store.read()).filter((d) => d.id !== id)
  try { store.write(JSON.stringify(kept)) } catch { /* full or blocked storage */ }
}

export const getDraft = (store: DraftStore, id: string): StoredDraft | null =>
  parse(store.read()).find((d) => d.id === id) ?? null

/**
 * Fields a restored draft must NEVER bring back with it.
 *
 * `launchStatus` is the one that costs money: a draft that once carried ACTIVE
 * would put every campaign restored from it straight live, which is exactly
 * what "it launched by itself" reports look like from the inside. Going live is
 * a decision taken at THIS launch's review, every time.
 *
 * A `blob:` preview URL is dropped for a different reason — it points at an
 * object owned by the page that made it, so a restored one renders an empty
 * frame for an image that uploaded perfectly well. The hash is the durable
 * half and is what actually launches.
 */
export function safeRestore(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data, launchStatus: 'PAUSED' }
  const dead = (v: unknown) => typeof v === 'string' && v.startsWith('blob:')
  if (dead(out.imageUrl)) out.imageUrl = ''
  if (Array.isArray(out.variants)) {
    out.variants = (out.variants as Array<Record<string, unknown>>).map((v) =>
      dead(v?.imageUrl) ? { ...v, imageUrl: '' } : v)
  }
  return out
}
