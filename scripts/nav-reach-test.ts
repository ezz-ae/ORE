/**
 * A SCREEN NOBODY CAN REACH DOES NOT EXIST — locked.
 *
 * The Wallet shipped complete: a page, two API routes, a database layer, 90
 * guard suites passing, a clean build. Nobody could see it.
 *
 * Two faults, and neither was visible to any gate we had:
 *
 *   1. It was registered as a TOOL under `app: 'agent'`, and the agent app is
 *      `brokerOnly` — so the wallet inherited that guard and every manager,
 *      director and admin was refused the screen holding their own money.
 *   2. It was not an APP, so it had no tab in the spine and no card on the hub.
 *      The only way in was the ⌘K popup, which is where you go when you already
 *      know a thing exists.
 *
 * typecheck, i18n, guards and build were all green throughout. They check that
 * the code is correct; not one of them asks WHETHER A PERSON CAN GET THERE.
 *
 * So this suite asks that. It is the navigation half of the lockfile lesson: a
 * gate for the thing the other gates are structurally unable to see.
 *
 * Pure — reads the registries, no network. Runs in `pnpm guards`.
 */
import { APPS, ALL_ROLES, spineApps, visibleApps, rolesForApp } from '../lib/freehold/apps'
import { TOOLS, visibleTools, toolRoles } from '../lib/freehold/tools'
import { APP_ROUTES } from '../lib/freehold/app-routes.generated'
import type { Role } from '../lib/freehold/session-types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A route exists if the generated list has it, or a dynamic segment covers it. */
const routes = new Set<string>(APP_ROUTES as readonly string[])
const routeExists = (href: string): boolean => {
  const path = href.split('?')[0].replace(/\/$/, '')
  if (routes.has(path)) return true
  // `/inventory/[slug]` covers `/inventory/anything`.
  return (APP_ROUTES as readonly string[]).some((r) => {
    if (!r.includes('[')) return false
    const re = new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$')
    return re.test(path)
  })
}

console.log('\n── every door leads somewhere ──')
{
  // A tab or a tool pointing at a route that does not exist is a 404 with a
  // label on it, and the person who clicks it concludes the product is broken.
  const deadApps = APPS.filter((a) => !routeExists(a.href)).map((a) => `${a.id} → ${a.href}`)
  check('every app in the registry has a real page', deadApps.length === 0, deadApps.join(', '))

  const deadTools = TOOLS.filter((t) => !routeExists(t.href)).map((t) => `${t.id} → ${t.href}`)
  check('every tool in the popup has a real page', deadTools.length === 0, deadTools.join(', '))
}

console.log('\n── a tool never inherits a guard that contradicts it ──')
{
  // THE EXACT FAULT. A tool with no `roles` of its own inherits the app it is
  // filed under, and filing it under the wrong app silently narrows who can
  // reach it — with no error anywhere, because both halves are individually
  // correct.
  const orphans = TOOLS
    .filter((t) => !APPS.some((a) => a.id === t.app))
    .map((t) => `${t.id} → app '${t.app}'`)
  check('every tool is filed under an app that exists', orphans.length === 0, orphans.join(', '))

  // And a tool must not be reachable by NOBODY — the state the wallet was one
  // step away from, and which no other check would have reported.
  const unreachable = TOOLS.filter((t) => toolRoles(t).length === 0).map((t) => t.id)
  check('no tool is invisible to every role', unreachable.length === 0, unreachable.join(', '))
}

console.log('\n── everybody\'s screens are reachable by everybody ──')
{
  /**
   * Screens the product CLAIMS are for every role.
   *
   * This list is the claim written down. The Wallet says "everybody has one"
   * in its own header and was then filed under a broker-only app, and nothing
   * could tell that the sentence and the registration disagreed — because the
   * sentence lived in a comment. Here it is as an assertion.
   */
  const FOR_EVERYONE = ['wallet'] as const

  for (const id of FOR_EVERYONE) {
    const app = APPS.find((a) => a.id === id)
    check(`${id} is an app in its own right`, !!app, 'not in the registry')
    if (!app) continue

    const cannotSee = ALL_ROLES.filter((r) => !visibleApps(r).some((a) => a.id === id))
    check(`…and every role can see it`, cannotSee.length === 0, `refused to: ${cannotSee.join(', ')}`)

    // A hub card is not enough. The spine is the navigation people actually
    // use, and an app missing from it is an app most users never find.
    const notInSpine = ALL_ROLES.filter((r) => !spineApps(r).some((a) => a.id === id))
    check(`…and it is in the spine for every role`, notInSpine.length === 0,
      `missing from the spine for: ${notInSpine.join(', ')}`)

    const tool = TOOLS.find((t) => t.href.endsWith(`/${id}`))
    check(`…and it is in the ⌘K popup too`, !!tool, 'no tool entry')
    if (tool) {
      const popupBlind = ALL_ROLES.filter((r) => !visibleTools(r).some((x) => x.id === tool.id))
      check(`…for every role there as well`, popupBlind.length === 0, popupBlind.join(', '))
    }
  }
}

console.log('\n── no role is left with nothing ──')
{
  // A role that can see no apps has been locked out of the product entirely,
  // which is the kind of fault that ships because nobody logs in as that role.
  for (const role of ALL_ROLES as Role[]) {
    const apps = spineApps(role)
    check(`${role} has somewhere to go`, apps.length > 0, 'no apps in the spine')
  }
}

console.log('\n── the registries agree with each other ──')
{
  // Two apps sharing an id means one of them silently wins every lookup.
  const ids = APPS.map((a) => a.id)
  const dupeApps = ids.filter((id, i) => ids.indexOf(id) !== i)
  check('no two apps share an id', dupeApps.length === 0, [...new Set(dupeApps)].join(', '))

  const toolIds = TOOLS.map((t) => t.id)
  const dupeTools = toolIds.filter((id, i) => toolIds.indexOf(id) !== i)
  check('no two tools share an id', dupeTools.length === 0, [...new Set(dupeTools)].join(', '))

  // An app with no tool pointing into it is reachable only from the spine —
  // legal, but it means search cannot find it, so it is worth reporting rather
  // than failing on.
  const searchless = APPS.filter((a) => !TOOLS.some((t) => t.app === a.id))
  if (searchless.length > 0) {
    console.log(`\n  note: ${searchless.length} app(s) have no tool entry, so global search cannot find them:`)
    console.log(`        ${searchless.map((a) => a.id).join(', ')}`)
  }

  // Every app's role list must be derivable — rolesForApp falls back to
  // ALL_ROLES for an unknown id, which would quietly widen a guard.
  const bad = APPS.filter((a) => rolesForApp(a.id).length === 0).map((a) => a.id)
  check('every app resolves to at least one role', bad.length === 0, bad.join(', '))
}

if (failures > 0) {
  console.error(`\n${failures} navigation rule(s) broken.`)
  console.error('A screen nobody can reach does not exist, however well it is built.')
  process.exit(1)
}
console.log('\nEvery screen that was built can actually be opened.\n')
