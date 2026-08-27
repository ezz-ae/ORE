/**
 * A DRAFT IS AN OFFER, NOT A STATE — locked.
 *
 * The launcher kept ONE draft under one key and restored it silently on mount.
 * Three things followed, and all three were reported from a live account:
 *
 *   · There was no way to start a new campaign. Opening the launcher put the
 *     last one back, and the only escape was clearing thirty fields by hand.
 *   · Two campaigns could not be worked on at once — the second silently
 *     overwrote the first.
 *   · A launch wiped the slot, so an abandoned campaign somebody had spent an
 *     hour on was simply gone.
 *
 * Pure — the storage adapter is injected, so this runs with no browser.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_DRAFTS, summarise, isSubstantial, listDrafts, saveDraft, deleteDraft,
  getDraft, safeRestore, type DraftStore, type StoredDraft,
} from '../lib/freehold/campaign-drafts'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** An in-memory store, which is all the module ever needed. */
function memory(initial = ''): DraftStore & { raw: string } {
  const s = { raw: initial, read: () => s.raw || null, write: (r: string) => { s.raw = r } }
  return s
}
const draft = (o: Record<string, unknown> = {}) => ({ campaignName: 'Cash offer', ...o })

console.log('\n── more than one campaign at a time ──')
{
  const st = memory()
  saveDraft(st, 'a', draft({ campaignName: 'Binghati' }), 1000)
  saveDraft(st, 'b', draft({ campaignName: 'Reportage' }), 2000)
  const all = listDrafts(st)
  // THE ORIGINAL BUG. One slot meant the second campaign destroyed the first.
  check('two drafts coexist', all.length === 2, String(all.length))
  check('…newest first, so the last thing worked on is the first offered',
    all[0].id === 'b', all.map((d) => d.id).join(','))

  // ONE EDITING SESSION IS ONE DRAFT, however many keystrokes it takes —
  // otherwise saving on every character fills the store in a minute.
  saveDraft(st, 'a', draft({ campaignName: 'Binghati Sky' }), 3000)
  check('re-saving the same id replaces rather than appends',
    listDrafts(st).length === 2, String(listDrafts(st).length))
  check('…and keeps the newer content',
    getDraft(st, 'a')?.data.campaignName === 'Binghati Sky',
    String(getDraft(st, 'a')?.data.campaignName))

  for (let i = 0; i < MAX_DRAFTS + 4; i++) saveDraft(st, `x${i}`, draft(), 4000 + i)
  check('the store is capped', listDrafts(st).length <= MAX_DRAFTS, String(listDrafts(st).length))
  check('…and the cap drops the OLDEST, never the newest',
    listDrafts(st)[0].at === 4000 + MAX_DRAFTS + 3, String(listDrafts(st)[0].at))
}

console.log('\n── an empty form is not a draft ──')
{
  // A draft is written on every keystroke, so a launcher somebody opened and
  // closed leaves one. Offering that back is noise, and noise is what turns a
  // chooser into a dialog people dismiss without reading.
  check('an untouched form is not kept',
    !isSubstantial({ id: 'e', at: 1, data: { campaignName: '', headlines: [''], imageUrl: '' } }))
  check('a name makes it real', isSubstantial({ id: 'n', at: 1, data: { campaignName: 'X' } }))
  check('so does a headline', isSubstantial({ id: 'h', at: 1, data: { headlines: ['Villa'] } }))
  check('so does an uploaded picture', isSubstantial({ id: 'i', at: 1, data: { imageHash: 'abc' } }))
  check('so does a chosen project', isSubstantial({ id: 'p', at: 1, data: { listingId: 'binghati' } }))

  const st = memory()
  saveDraft(st, 'empty', { campaignName: '   ', headlines: [] }, 1)
  check('an empty draft is never written', listDrafts(st).length === 0)
}

console.log('\n── the chooser can be chosen from ──')
{
  // "Draft — 14:32" three times over is a coin toss, and people pick the top
  // one out of impatience. The line has to say what the draft IS.
  const s1 = summarise({ id: 'a', at: 1, data: { campaignName: 'Cash offer | B', listingId: 'binghati', dailyBudgetAED: 250 } }, 'Untitled')
  check('the name leads', s1.title === 'Cash offer | B', s1.title)
  check('…with the project and budget under it',
    s1.detail.includes('binghati') && s1.detail.includes('250'), s1.detail)

  const s2 = summarise({ id: 'b', at: 1, data: { headlines: ['Villa in Al Warqa'] } }, 'Untitled')
  check('an unnamed draft falls back to its headline', s2.title === 'Villa in Al Warqa', s2.title)
  const s3 = summarise({ id: 'c', at: 1, data: {} }, 'Untitled')
  check('…and to the caller\'s word when there is nothing', s3.title === 'Untitled', s3.title)
  check('the title is never empty', !!s1.title && !!s2.title && !!s3.title)

  // The module holds no English of its own — the fallback is passed in.
  check('no translated string is hardcoded in the module',
    !/'[A-Z][a-z]+ [a-z]+/.test(code('lib/freehold/campaign-drafts.ts').replace(/import[^\n]*/g, '')),
    'a user-facing sentence is baked into the pure module')
}

console.log('\n── a restored draft never relaunches yesterday\'s decision ──')
{
  // THE ONE THAT COSTS MONEY. A draft that once carried ACTIVE would put every
  // campaign restored from it straight live — which is exactly what "it went
  // live by itself" looks like from the inside.
  const r = safeRestore({ campaignName: 'X', launchStatus: 'ACTIVE' })
  check('live is never inherited', r.launchStatus === 'PAUSED', String(r.launchStatus))

  // A blob: URL points at an object owned by the page that made it. Restored,
  // it renders an empty frame for an image that uploaded perfectly well.
  const b = safeRestore({ imageUrl: 'blob:http://x/abc', imageHash: 'h1' })
  check('a dead preview URL is dropped', b.imageUrl === '', String(b.imageUrl))
  check('…and the durable hash is kept, because that is what launches',
    b.imageHash === 'h1', String(b.imageHash))
  const keep = safeRestore({ imageUrl: 'https://cdn/x.jpg' })
  check('a real URL survives', keep.imageUrl === 'https://cdn/x.jpg', String(keep.imageUrl))

  const v = safeRestore({ variants: [{ imageUrl: 'blob:x', imageHash: 'h2' }] })
  check('variants get the same treatment',
    (v.variants as Array<Record<string, unknown>>)[0].imageUrl === '')
}

console.log('\n── corrupt or blocked storage loses the campaign, not the session ──')
{
  check('garbage reads as no drafts', listDrafts(memory('not json')).length === 0)
  check('a non-array reads as no drafts', listDrafts(memory('{"a":1}')).length === 0)
  check('rows missing an id are skipped',
    listDrafts(memory(JSON.stringify([{ at: 1, data: {} }, { id: 'k', at: 2, data: { campaignName: 'K' } }]))).length === 1)

  // Storage is full, or blocked in a private window, far more often than
  // anybody expects. Losing the draft must never take the page with it.
  const blocked: DraftStore = { read: () => null, write: () => { throw new Error('QuotaExceeded') } }
  let threw = false
  try { saveDraft(blocked, 'a', draft(), 1) } catch { threw = true }
  check('a write that throws is swallowed', !threw)
  let threw2 = false
  try { deleteDraft(blocked, 'a') } catch { threw2 = true }
  check('…and so is a delete that throws', !threw2)
}

console.log('\n── the launcher asks instead of restoring ──')
{
  const page = code('app/freehold-intelligence/lead-machine/campaigns/new/page.tsx')
  check('the chooser renders BEFORE the wizard, not over it',
    /if \(draftChoices && draftChoices\.length > 0\) \{[\s\S]{0,200}return \(/.test(page),
    'a dialog over a form already filled with the old draft answers its own question')
  check('starting fresh is an option',
    /function startFresh\(\)/.test(page) && /lm\.newCampaign\.draft\.fresh/.test(page),
    'there is still no way to begin a new campaign')
  check('saving waits until the chooser is answered',
    /if \(!savingEnabled\.current\) return/.test(page),
    'the pristine form would overwrite the very draft being offered')
  check('a launch clears only the draft that launched',
    /deleteDraft\(draftStore, draftId\.current\)/.test(page),
    'a campaign half-written in another tab is wiped by an unrelated launch')
  // Nobody mid-campaign when this shipped should lose it.
  check('the old single-slot draft is migrated, not dropped',
    /fh-campaign-draft'/.test(page) && /saveDraft\(draftStore, 'legacy'/.test(page))
}

console.log('\n── a prefill never overwrites real work ──')
{
  const page = code('app/freehold-intelligence/lead-machine/campaigns/new/page.tsx')
  // `onListingChange` used to set `imageUrl: listing.imageUrl, imageHash: ''`
  // unconditionally, so re-picking the project replaced the operator's own
  // upload with the website's hero shot. From the outside: "the preview shows
  // the landing page, not my image".
  check('an uploaded design survives changing the project',
    /const uploaded = !!prev\.imageHash \|\| prev\.imageUrl\.startsWith\('blob:'\)/.test(page)
      && /\.\.\.\(uploaded \? \{\} : \{ imageUrl: listing\.imageUrl, imageHash: '' \}\)/.test(page),
    'picking a project still destroys an uploaded image')
  check('…and so does copy somebody wrote',
    /const wroteCopy = prev\.primaryText\.trim\(\) !== ''/.test(page))

  // The Page selector set the very state it depended on, so it re-triggered
  // itself and fought whatever the operator had chosen.
  check('the Page resolves its default once, not on every pass',
    /resolvedDefault\.current = true/.test(page),
    'the Page selector chooses itself again')
  // A landing page arrives from three places and could not be undone.
  check('the landing page can be cleared',
    /onClick=\{\(\) => update\('landingUrl', ''\)\}/.test(page),
    'a landing page filled in by something else cannot be removed')
}

if (failures > 0) {
  console.error(`\n${failures} draft rule(s) broken.`)
  console.error('A launcher that restores without asking is a launcher you cannot start a campaign in.')
  process.exit(1)
}
console.log('\nDrafts are offered, chosen, and never overwrite the work in front of you.\n')
