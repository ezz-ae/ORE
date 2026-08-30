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
import { readableText, type ExpertBlock } from '../lib/freehold/expert-blocks'
import { listedNames, unsourcedListedNames } from '../lib/freehold/listed-records'
import { blocksToText } from '../lib/freehold/expert-sessions'
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

console.log('\n── the contact links, and only the ones a tool built ──')
{
  // There is no WhatsApp API on this deployment: crm_message_link builds a
  // wa.me link that opens the USER'S OWN WhatsApp with the text pre-filled.
  // It is off-site by nature, so the internal-paths rule would have refused it
  // — and relaxing that rule generally would let a model hand somebody a link
  // to any site it liked.
  const wa = 'https://wa.me/971501234567?text=Hello'
  const SEEN_WA = JSON.stringify({ whatsappUrl: wa })
  check('a wa.me link a tool produced is allowed', linkAllowed(wa, SEEN_WA, APP_ROUTES))

  // THE WHOLE SAFETY OF IT. A number the model composed is a message to a
  // stranger — worse than a 404, because it reaches a real person.
  check('a wa.me link the model invented is refused',
    !linkAllowed('https://wa.me/971509999999?text=Hi', SEEN_WA, APP_ROUTES))
  check('…and reported as off-site, not as a bad route',
    (() => { const v = linkVerdict('https://wa.me/971509999999', SEEN_WA, APP_ROUTES)
             return !v.ok && v.refusal === 'offsite' })())

  check('tel: and mailto: work the same way',
    linkAllowed('tel:+971501234567', 'call tel:+971501234567 now', APP_ROUTES)
    && linkAllowed('mailto:a@b.com', 'write to mailto:a@b.com', APP_ROUTES)
    && !linkAllowed('mailto:a@b.com', 'nothing was fetched', APP_ROUTES))

  // The allowlist is four schemes, not "https is fine now".
  check('an ordinary external link is still refused even when quoted in a result',
    !linkAllowed('https://example.com/x', 'https://example.com/x', APP_ROUTES))
  check('…including a lookalike host',
    !linkAllowed('https://wa.me.evil.com/971501234567', 'https://wa.me.evil.com/971501234567', APP_ROUTES))
  check('…and a wa.me link with no number at all',
    !linkAllowed('https://wa.me/', 'https://wa.me/', APP_ROUTES))
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

console.log('\n── the checker reads what the USER reads ──')
{
  // THE HOLE UNDER THE HOLE. The entity check ran on blocksToText, which exists
  // to replay history to the model compactly: it keeps a plan step's `step`,
  // drops its `detail` and `owner`, drops action labels entirely, and truncates
  // at 4,000 characters. The reply that prompted all of this put its invented
  // campaign in a `detail`, its invented colleague in an `owner`, and its
  // invented property in a button label. The checker examined
  // "Intent: High; Risk: High; Next Action: Immediate Contact" and found
  // nothing wrong — which was true of the text it was handed.
  const card: ExpertBlock[] = [
    { type: 'text', content: 'Saad Aldbsaoy shows high intent but is at high risk of going cold.' },
    { type: 'text', content: 'He submitted his details via a Meta ad for a specific property, Volta Towers, just 3 hours ago.' },
    { type: 'plan', title: 'LEAD ASSESSMENT', steps: [
      { step: 'Intent: High', detail: "Originated from 'Volta_Towers_DXB_Leads_2024' campaign, showing specific interest.", owner: 'LEAD' },
      { step: 'Next Action: Immediate Contact', detail: 'Assigned to Aya Al-Masri. A WhatsApp message is the fastest way to engage.', owner: 'AYA AL-MASRI' },
    ] },
    { type: 'actions', actions: [
      { label: 'View Volta Towers Details', kind: 'navigate', href: '/freehold-intelligence/inventory/volta-towers' },
    ] },
  ]
  const KNOWN = {
    campaign: ['cash offer new audiences'],
    project: ['Sea Legend One', 'Riverside Hills'],
    person: ['Bashar Ezz', 'Mona Khalil'],
  }

  const full = readableText(card)
  check('a plan step’s detail is read', full.includes('Volta_Towers_DXB_Leads_2024'), full)
  check('…and its owner chip', full.includes('AYA AL-MASRI'), full)
  check('…and an action button’s label', full.includes('View Volta Towers Details'), full)

  // The whole point, measured: the old reader caught one of three.
  const before = unknownEntities(blocksToText(card), KNOWN)
  const after = unknownEntities(full, KNOWN)
  check('the compact history reader missed most of it',
    before.length < after.length, `${before.length} vs ${after.length}`)
  check('all three inventions are caught now',
    new Set(after.map((e) => e.kind)).size === 3, JSON.stringify(after))
  // Worth being exact about which layer catches what: the PROPERTY is caught
  // from the prose sentence, not from the button label — "View Volta Towers
  // Details" matches no entity pattern, and widening the patterns to read
  // button text would flag every real button in the product. The button is
  // stopped by the OTHER layer instead: its href names a record no tool
  // returned, so linkVerdict refuses it.
  check('the invented button is stopped by the link rule, not the name rule',
    !linkAllowed('/freehold-intelligence/inventory/volta-towers', SEEN, APP_ROUTES))

  // No truncation. A long reply's tail is exactly where a model puts the
  // things it is least sure about.
  const long: ExpertBlock[] = [
    { type: 'text', content: 'x'.repeat(6000) },
    { type: 'text', content: 'The Volta Towers project is ready.' },
  ]
  check('a long reply is not truncated before it is checked',
    unknownEntities(readableText(long), KNOWN).some((e) => e.name === 'Volta Towers'),
    String(readableText(long).length))

  // blocksToText keeps its own job — it is right for history, wrong for
  // verification, and nothing here should have changed it.
  check('the history reader is left alone, still compact',
    blocksToText(card).length < full.length)
}

console.log('\n── the route checks the full reply, not the summary ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/freehold/expert/chat/route.ts'), 'utf8')
  check('the entity check reads the full reply',
    /unknownEntities\(readableText\(blocks\), knownNames\)/.test(route))
  check('…and no longer the compact history view',
    !/unknownEntities\(blocksToText/.test(route))
  // Figures were always audited over JSON.stringify(blocks), which covers every
  // field. Asserted so a future tidy-up does not "unify" them onto the summary.
  check('figures are still audited over the whole reply object',
    /auditFigures\(replyJson/.test(route) && /const replyJson = JSON\.stringify\(blocks\)/.test(route))
}

console.log('\n── FIVE PEOPLE WHO DO NOT EXIST, WITH A BUTTON EACH ──')
{
  // The transcript, after every other guard in this product had passed. The
  // tool had RUN and come back with nothing; the reply was five names.
  const answer = [
    "Here are the top 5 leads advanced to 'Qualified' but not rated yet.",
    '- Aisha Al-Futtaim (Emaar Beachfront)',
    '- Fatima Al-Mansoori (Damac Lagoons)',
    '- Omar bin Rashid (Dubai Hills Estate)',
    '- Layla El-Sayed (Arabian Ranches III)',
    '- Khalid Al-Jaber (Tilal Al Ghaf)',
  ].join('\n')
  // What it was actually given: an empty result, and a context whose project
  // names are REAL — which is what made the invented people beside them read
  // as credible, and why checking names against the workspace cleared them.
  const corpus = JSON.stringify({ ok: true, count: 0, leads: [] })
    + JSON.stringify({ inventory: { topPicks: [{ name: 'Damac Lagoons' }, { name: 'Tilal Al Ghaf' }] } })

  check('all five invented people are caught',
    unsourcedListedNames(answer, corpus).length === 5,
    JSON.stringify(unsourcedListedNames(answer, corpus)))
  // The entity guard could not see this shape at all: a bullet is not
  // "<Name> campaign" or "assigned to <Name>".
  check('…which the sentence-shape guard could not see',
    unknownEntities(answer, { person: ['Bashar Ezz'], project: ['Sea Legend One'] })
      .every((e) => e.kind !== 'person'))

  // Real records pass — the test is provenance, not vocabulary.
  const real = '- Mona Khalil (Sea Legend One)\n- Bashar Ezz (Riverside Hills)'
  check('a list of leads a tool DID return passes',
    unsourcedListedNames(real, JSON.stringify({
      leads: [{ name: 'Mona Khalil' }, { name: 'Bashar Ezz' }],
      projects: ['Sea Legend One', 'Riverside Hills'],
    })).length === 0)
  // A user who types a name is entitled to have it repeated back.
  check('…and a name the USER typed passes',
    unsourcedListedNames('- Khalid Al-Jaber (Tilal Al Ghaf)', 'find me Khalid Al-Jaber and Tilal Al Ghaf').length === 0)

  // NARROW BY SHAPE. A general proper-noun detector would flag every area and
  // building in Dubai and be switched off in a week.
  check('advice lines are not records',
    unsourcedListedNames(
      '- Raise the budget to AED 1,143\n- Dubai Marina is worth targeting\n- Add a second design',
      JSON.stringify({ x: 1 })).length === 0)
  check('…only names followed by record punctuation are read',
    JSON.stringify(listedNames('- Aisha Al-Futtaim (X)\n- Dubai Marina is worth targeting'))
      === JSON.stringify(['Aisha Al-Futtaim']))
  // An accusation with nothing behind it is its own kind of lie.
  check('an empty corpus accuses nobody',
    unsourcedListedNames(answer, '').length === 0)

  const route = readFileSync(join(process.cwd(), 'app/api/freehold/expert/chat/route.ts'), 'utf8')
  // Read the CALL, not the import line, which is what indexOf finds first.
  const call = route.slice(route.indexOf('const listed = unsourcedListedNames'))
  check('the route checks listed records against everything it was given',
    call.startsWith('const listed = unsourcedListedNames')
    && /toolResultsText/.test(call.slice(0, 300))
    && /JSON\.stringify\(fullContext\)/.test(call.slice(0, 300))
    // The user's own words count: somebody who types a name may have it back.
    && /\$\{message\}/.test(call.slice(0, 300)),
    call.slice(0, 220))
  // Checked over the FULL reply, not the compact history view — the same
  // lesson as the entity guard, which read a summary the user never sees.
  check('…over everything the user can read',
    /unsourcedListedNames\(\s*readableText\(blocks\)/.test(call.slice(0, 200)))
}

console.log('\n── an empty result has to say what zero means ──')
{
  const tools = readFileSync(join(process.cwd(), 'lib/freehold/coordinator-tools.ts'), 'utf8')
  // A `count: 0` that does not say what zero MEANS is a blank the model fills
  // in with plausible names.
  check('no unrated leads says so, and forbids naming any',
    /NOBODY is waiting to be rated/.test(tools) && /Do NOT list any names/.test(tools))
  check('nothing overdue says so',
    /NOTHING is overdue/.test(tools))
  check('no search match says so',
    /No lead in the CRM matches/.test(tools))
  // And a non-empty result is a closed set, not a starting point.
  check('a result that DOES have rows says it is the only rows',
    /These are the ONLY leads waiting\. Name no others\./.test(tools))
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
    /unknownEntities\(readableText\(blocks\), knownNames\)/.test(route))
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
