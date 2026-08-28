/**
 * THE ASSISTANT MAY NOT INVENT A RECORD, OR A LINK TO ONE — locked.
 *
 * The transcript, from a live workspace, on the inventory screen, with three
 * buttons under it:
 *
 *   "Saad Aldbsaoy shows high intent but is at high risk of going cold…
 *    He submitted his details via a Meta ad for a specific property, Volta
 *    Towers, just 3 hours ago… Originated from 'Volta_Towers_DXB_Leads_2024'
 *    campaign… Assigned to Aya Al-Masri."
 *
 * There is no Saad Aldbsaoy, no Volta Towers, no such campaign and no Aya
 * Al-Masri. Pressing "View Volta Towers Details" landed on 404 — Property not
 * found. Two guards were already in place and both passed it:
 *
 *   · THE LINK GUARD kept a hand-written list of record collections and
 *     required a tool-sourced id only inside them. The property route here is
 *     /freehold-intelligence/inventory/[id] and "inventory" was not on the
 *     list; outside the list it guessed whether a segment LOOKED like an id
 *     (8+ hex, 6+ digits, a uuid), and a slug looks like none of those.
 *   · THE ENTITY GUARD read its list of real campaigns from context.campaigns,
 *     which the calling PAGE supplies. The inventory screen supplies none, so
 *     it compared against an empty list and reported a clean answer.
 *
 * Both are the same mistake in different clothes: a check that only reaches the
 * places somebody remembered to enumerate. These assertions pin the replacement
 * rules, and — as much as they pin the catch — they pin that honest answers
 * still pass, because a guard that cries wolf is switched off in a week and
 * then the real lie ships.
 *
 * Pure — no model, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { linkVerdict, linkAllowed, wildcardSegments, LINK_REFUSALS } from '../lib/freehold/link-truth'
import { entityClaims, unknownEntities, unknownCampaigns, ENTITY_KINDS } from '../lib/freehold/answer-grounding'
import { APP_ROUTES } from '../lib/freehold/app-routes.generated'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** What the tools actually returned this turn. */
const SEEN = JSON.stringify({
  properties: [{ id: 'sea-legend-one', name: 'Sea Legend One' }],
  leads: [{ id: '9f2c11ab44de77', name: 'Mona Khalil' }],
})

console.log('\n── the button that 404\'d ──')
{
  // The exact link that shipped: a real route, an invented slug, nothing on
  // the old list to catch it.
  const v = linkVerdict('/freehold-intelligence/inventory/volta-towers', SEEN, APP_ROUTES)
  check('the invented property link is refused', !v.ok, JSON.stringify(v))
  check('…because the id came from nowhere',
    !v.ok && v.refusal === 'ungrounded', JSON.stringify(v))
  check('…and the offending segment is named for the log',
    !v.ok && v.segment === 'volta-towers', JSON.stringify(v))

  // The rule is about WILDCARDS, not about which collection somebody listed.
  // A slug, a hex id and a numeric id are all the same question.
  check('a real property link is allowed',
    linkAllowed('/freehold-intelligence/inventory/sea-legend-one', SEEN, APP_ROUTES))
  check('the id may carry a query string and a hash',
    linkAllowed('/freehold-intelligence/inventory/sea-legend-one?tab=ads#top', SEEN, APP_ROUTES))
  check('a url-encoded id is decoded before it is checked',
    linkAllowed('/freehold-intelligence/inventory/sea%2Dlegend%2Done', SEEN, APP_ROUTES))
}

console.log('\n── static pages are pages, not records ──')
{
  // A path that matches BOTH a literal route and a wildcard one is the literal
  // page. Grounding "new" would be a refusal with nothing behind it, and the
  // launcher would lose its own link.
  check('a static sub-page under a dynamic route still passes',
    linkAllowed('/freehold-intelligence/inventory/new', '', APP_ROUTES))
  check('a plain app page passes with no tool results at all',
    linkAllowed('/freehold-intelligence/inventory', '', APP_ROUTES))

  check('a route this app does not have is refused',
    (() => { const v = linkVerdict('/freehold-intelligence/library/creatives/edit/x.png', SEEN, APP_ROUTES)
             return !v.ok && v.refusal === 'no_route' })())
  // An off-site link from an assistant is a larger question than a 404 and
  // this is not the place to answer it.
  check('an external link is refused',
    (() => { const v = linkVerdict('https://example.com/x', SEEN, APP_ROUTES)
             return !v.ok && v.refusal === 'offsite' })())
  check('a non-string href is refused rather than coerced',
    !linkAllowed(null, SEEN, APP_ROUTES) && !linkAllowed(42, SEEN, APP_ROUTES))
}

console.log('\n── wildcards, including the catch-all ──')
{
  check('a literal pattern grounds nothing',
    JSON.stringify(wildcardSegments(['a', 'b'], '/a/b')) === '[]')
  check('a * captures exactly one segment',
    JSON.stringify(wildcardSegments(['a', 'x'], '/a/*')) === '["x"]')
  check('a pattern that does not match returns null',
    wildcardSegments(['a', 'x'], '/b/*') === null)
  check('a trailing pattern segment with no path left does not match',
    wildcardSegments(['a'], '/a/*') === null)
  // A catch-all is the widest place an invented path can hide, so everything
  // it swallows counts as dynamic.
  check('a ** grounds every segment it swallows',
    JSON.stringify(wildcardSegments(['a', 'x', 'y'], '/a/**')) === '["x","y"]')
  check('every refusal reason is walkable', LINK_REFUSALS.length === 3)
}

console.log('\n── the four records that did not exist ──')
{
  const ANSWER = `Saad Aldbsaoy shows high intent but is at high risk of going cold. `
    + `He submitted his details via a Meta ad for a specific property, Volta Towers, just 3 hours ago. `
    + `Originated from 'Volta_Towers_DXB_Leads_2024' campaign, showing specific interest. `
    + `Next Action: Immediate Contact. Assigned to Aya Al-Masri.`
  const KNOWN = {
    campaign: ['cash offer new audiences', 'Sea Legend One — Quick'],
    project: ['Sea Legend One', 'Riverside Hills'],
    person: ['Bashar Ezz', 'Mona Khalil'],
  }
  const bad = unknownEntities(ANSWER, KNOWN)
  const named = (kind: string) => bad.some((e) => e.kind === kind)

  check('the invented campaign is caught, quoted and underscored as it was written',
    bad.some((e) => e.kind === 'campaign' && e.name === 'Volta_Towers_DXB_Leads_2024'),
    JSON.stringify(bad))
  check('the invented property is caught', named('project'), JSON.stringify(bad))
  // The one nothing had ever checked: an assistant telling somebody to go and
  // contact a colleague who does not work here.
  check('the invented colleague is caught', named('person'), JSON.stringify(bad))
  check('all three kinds are reported, not just the first',
    new Set(bad.map((e) => e.kind)).size === 3, JSON.stringify(bad))
  check('every entity kind is walkable', ENTITY_KINDS.length === 3)
}

console.log('\n── and honest answers are left alone ──')
{
  const KNOWN = {
    campaign: ['cash offer new audiences', 'Sea Legend One — Quick'],
    project: ['Sea Legend One', 'Riverside Hills'],
    person: ['Bashar Ezz', 'Mona Khalil'],
  }
  // A model naming "Sea Legend" for "Sea Legend One — Quick" is abbreviating.
  check('an abbreviated real campaign name passes',
    unknownEntities('The Sea Legend campaign spent AED 501.', KNOWN).length === 0)
  check('a real property and a real colleague pass',
    unknownEntities('The Sea Legend One project is assigned to Mona Khalil.', KNOWN).length === 0)
  // The cried-wolf risk this file is most exposed to: ordinary Dubai nouns.
  check('generic advice about towers is not an accusation',
    unknownEntities('Buyers comparing Marina towers respond better to floor plans.', KNOWN).length === 0,
    JSON.stringify(unknownEntities('Buyers comparing Marina towers respond better to floor plans.', KNOWN)))
  check('"assigned to someone else" names no person',
    entityClaims('This lead was assigned to someone else.').every((e) => e.kind !== 'person'))

  // SILENT WITHOUT A LIST, PER KIND — an accusation with nothing behind it is
  // its own kind of lie. This is also the rule that hid the whole transcript,
  // so it is asserted deliberately rather than left implicit.
  check('a kind with no list is not checked',
    unknownEntities('The Volta Towers project is assigned to Aya Al-Masri.', {}).length === 0)
  check('one kind having a list does not switch the others on',
    unknownEntities('The Volta Towers project is assigned to Aya Al-Masri.', { campaign: ['x'] }).length === 0)

  // The original entry point still works — the Zada Tower suite calls it.
  check('unknownCampaigns still answers for its old callers',
    unknownCampaigns('There are no rules for the Zada Tower campaign.', ['cash offer']).includes('Zada Tower'))
}

console.log('\n── the route uses both, and gathers its own lists ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/expert/chat/route.ts'), 'utf8')

  check('links are judged by the shared rule, against the real route table',
    /linkAllowed\(href, seen, APP_ROUTES\)/.test(route))
  // The two things that let the 404 through. Neither may come back.
  check('the hand-kept list of record collections is gone',
    !/RECORD_COLLECTIONS/.test(route))
  check('the "does this look like an id" guess is gone',
    !/\[0-9a-f\]\{8,\}/.test(route), route.slice(0, 0))

  check('the answer is checked for every entity kind, not only campaigns',
    /unknownEntities\(blocksToText\(blocks\), knownNames\)/.test(route))
  // THE SILENCE. The list must not come from whatever page the user is on.
  check('the known names are gathered server-side',
    /gatherKnownNames\(/.test(route))
  check('…and no longer read straight off context.campaigns as the only source',
    !/const knownCampaignNames/.test(route))

  const known = readFileSync(join(process.cwd(), 'lib/freehold/known-names.ts'), 'utf8')
  // A truncated list would make the guard call a real property invented and
  // tell the user their own inventory does not exist — worse than the failure
  // it is here to catch.
  // Read the QUERY, not the file: the header above it explains in prose why
  // there is no LIMIT, and a whole-file scan matched its own explanation — a
  // guard that fails on the sentence justifying it is worse than no guard.
  const projectSql = known.slice(known.indexOf('SELECT name FROM freehold_site_projects'))
  check('the project list is read whole, with no LIMIT',
    projectSql.startsWith('SELECT name FROM freehold_site_projects')
    && !/\blimit\b/i.test(projectSql.slice(0, projectSql.indexOf('`'))))
  check('a failed read leaves that kind unchecked rather than half-checked',
    (known.match(/catch \{ return \[\] \}/g) ?? []).length >= 3)
}

console.log(failures === 0
  ? '\n✅ link truth: a named record is a real one, and a link goes where it says.'
  : `\n❌ ${failures} link/entity truth guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
