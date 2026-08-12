/**
 * NOT SPENDING MONEY ON A 404 — locked.
 *
 * app/lp/[slug] returns a 404 to anonymous visitors outside the publish
 * window, and every paid click is an anonymous visitor. The launch route
 * validated only that a landing URL was PRESENT, so a campaign could be
 * launched, approved by Meta, and spend its whole daily budget delivering
 * people to a 404 — with no symptom anywhere except that no leads arrive,
 * which reads exactly like a bad audience.
 *
 * Same shape as the permit rule: trakheesi.ts says a permit NUMBER says
 * nothing about today; a page's STATUS says nothing about tomorrow, because
 * publish_to is a real field with real dates in it.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  preflightLanding, landingSlugOf, blocksLaunch,
  PREFLIGHT_VERDICTS, CLOSING_SOON_DAYS,
  type LandingPageState,
} from '../lib/freehold/landing-preflight'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const DOMAIN = 'freeholdproperty.ae'
const NOW = new Date('2026-08-12T09:00:00Z')
const URL_OK = `https://www.${DOMAIN}/lp/azizi-venice`

const page = (o: Partial<LandingPageState> = {}): LandingPageState => ({
  slug: 'azizi-venice', status: 'published', publishFrom: null, publishTo: null, ...o,
})
const pf = (url: string | null, p: LandingPageState | null) =>
  preflightLanding(url, p, { domain: DOMAIN, now: NOW })

console.log('\n── a page that is live right now is the only thing that passes ──')
{
  check('published with no window is ok', pf(URL_OK, page()).verdict === 'ok')
  check('…and nothing about it blocks a launch', !blocksLaunch('ok'))

  const open = pf(URL_OK, page({ publishFrom: '2026-01-01', publishTo: '2027-01-01' }))
  check('an open window is ok', open.verdict === 'ok', open.verdict)
}

console.log('\n── the guaranteed 404s are refusals, not warnings ──')
{
  // There is no reading under which spending money on a certain 404 is what
  // somebody meant.
  const gone = pf(URL_OK, null)
  check('a /lp/ URL with no page behind it is refused',
    gone.verdict === 'noSuchPage' && blocksLaunch(gone.verdict), gone.verdict)
  check('…and it still names the slug, so the message can say WHICH page',
    gone.slug === 'azizi-venice', String(gone.slug))

  const draft = pf(URL_OK, page({ status: 'draft' }))
  check('a draft page is refused', draft.verdict === 'notPublished' && blocksLaunch(draft.verdict))

  // NOT YET OPEN and ALREADY CLOSED are the same outcome for a paid click.
  // They keep separate verdicts because "it starts Monday" and "it ended in
  // March" are answered differently.
  const early = pf(URL_OK, page({ publishFrom: '2026-09-01' }))
  check('a page whose window has not opened yet is refused',
    early.verdict === 'notPublished' && blocksLaunch(early.verdict), early.verdict)

  const closed = pf(URL_OK, page({ publishTo: '2026-08-11' }))
  check('a page whose window closed yesterday is refused',
    closed.verdict === 'windowClosed' && blocksLaunch(closed.verdict), closed.verdict)
  check('…and says when it closed, rather than only that it did',
    closed.closesOn === '2026-08-11', String(closed.closesOn))

  check('no URL at all is refused', blocksLaunch(pf(null, null).verdict))
  check('…and so is an empty one', pf('   ', null).verdict === 'noUrl')
}

console.log('\n── a window that closes mid-flight is the one nobody sees ──')
{
  // THE DEEPER HALF, and the same rule the permit gate encodes. The campaign,
  // the budget and the ad all stay perfectly healthy while the destination
  // goes dark underneath them.
  const soon = pf(URL_OK, page({ publishTo: '2026-08-15' }))
  check('a page closing in three days warns', soon.verdict === 'closesSoon', soon.verdict)
  check('…and does NOT block — it is live today and the campaign may be short',
    !blocksLaunch(soon.verdict))
  check('…and carries the date the operator has to act on',
    soon.closesOn === '2026-08-15', String(soon.closesOn))

  const far = pf(URL_OK, page({ publishTo: '2027-06-01' }))
  check('a window closing well beyond the horizon is simply ok', far.verdict === 'ok', far.verdict)

  // The horizon is a week rather than a day: a campaign launched today is
  // normally still running next week, and a warning the day before arrives
  // after that week's budget is already committed.
  check(`the horizon is ${CLOSING_SOON_DAYS} days, not one`, CLOSING_SOON_DAYS >= 7)
}

console.log('\n── not ours is a warning, because it can be deliberate ──')
{
  // A developer's microsite is a legitimate destination. It simply has no
  // publish window we can read and no CRM of ours on the other end.
  const ext = pf('https://developer-microsite.com/venice', null)
  check('an external URL warns rather than blocks',
    ext.verdict === 'notOurs' && !blocksLaunch(ext.verdict), ext.verdict)

  // Our own site elsewhere is NOT a landing page: a project page has no
  // publish window, so there is nothing here to check and nothing to refuse.
  const project = pf(`https://www.${DOMAIN}/projects/azizi-venice`, null)
  check('our own non-/lp/ page is not treated as a landing page',
    project.verdict === 'notOurs', project.verdict)

  // THE ATTACK, and the honest mistake: a partner host that merely CONTAINS
  // our domain is not ours, and a slug read off it would check the wrong page.
  check('a host that contains our domain is not ours',
    landingSlugOf(`https://${DOMAIN}.evil.com/lp/x`, DOMAIN) === null)
  check('…while a real subdomain is', landingSlugOf(`https://lp.${DOMAIN}/lp/x`, DOMAIN) === 'x')
  check('…and a trailing slash does not defeat it',
    landingSlugOf(`https://${DOMAIN}/lp/x/`, DOMAIN) === 'x')
  check('…and a deeper path is not a landing page',
    landingSlugOf(`https://${DOMAIN}/lp/x/y`, DOMAIN) === null)
  check('an unparseable URL never throws', landingSlugOf('not a url', DOMAIN) === null)
}

console.log('\n── every verdict is reachable and correctly classified ──')
{
  const seen = new Set<string>([
    pf(URL_OK, page()).verdict,
    pf(URL_OK, null).verdict,
    pf(URL_OK, page({ status: 'draft' })).verdict,
    pf(URL_OK, page({ publishTo: '2026-08-11' })).verdict,
    pf(URL_OK, page({ publishTo: '2026-08-15' })).verdict,
    pf('https://other.com/x', null).verdict,
    pf(null, null).verdict,
  ])
  const missing = PREFLIGHT_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict can happen', missing.length === 0, missing.join(','))

  // A verdict that blocks must be one where the click CANNOT work. Anything
  // else belongs in the warning half, or the launcher becomes a thing people
  // route around.
  const blocking = PREFLIGHT_VERDICTS.filter(blocksLaunch)
  check('only the certain-404 verdicts block a launch',
    blocking.join(',') === 'noSuchPage,notPublished,windowClosed,noUrl', blocking.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} landing-preflight rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo campaign spends a budget on a page that is not there.\n')
