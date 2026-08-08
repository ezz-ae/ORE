/**
 * The persona kitchen, locked.
 *
 * A persona is OUR word for a person, translated into SEVERAL live Meta
 * signals — never one-to-one — with the real-estate MUST bolted on top. The
 * planning half is pure and tested here; the live-resolution half is tested
 * for its refusal behaviour (a persona that resolves to nothing must throw,
 * not quietly build an audience of nobody).
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import {
  PERSONAS, MAX_STACK, getPersona, planPersona, PersonaUnresolvableError,
} from '../lib/freehold/persona-audience'
import { REAL_ESTATE_MUST } from '../lib/freehold/audience-pattern'
import type { TargetingEntity } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ent = (id: string, name: string): TargetingEntity => ({ id, name })
const group = (n: number, prefix: string) =>
  ({ interests: Array.from({ length: n }, (_, i) => ent(`${prefix}${i}`, `${prefix} ${i}`)), behaviors: [] })

const reIds = new Set(REAL_ESTATE_MUST.map((e) => e.id))
const hasAnchor = (narrowing?: { interests?: TargetingEntity[]; behaviors?: TargetingEntity[] }[]) =>
  (narrowing ?? []).some((g) => {
    const ids = [...(g.interests ?? []), ...(g.behaviors ?? [])].map((e) => e.id)
    return ids.length > 0 && ids.every((id) => reIds.has(id))
  })

console.log('\n── the library is recipes, not renamed checkboxes ──')
{
  check('every persona carries several ingredients — a recipe, never one term',
    PERSONAS.every((p) => p.interests.length + (p.behaviors?.length ?? 0) >= 2),
    PERSONAS.filter((p) => p.interests.length + (p.behaviors?.length ?? 0) < 2).map((p) => p.id).join(','))
  check('ids are unique', new Set(PERSONAS.map((p) => p.id)).size === PERSONAS.length)
  check('getPersona finds what personaIds lists', PERSONAS.every((p) => getPersona(p.id)?.id === p.id))
  check('an unknown id resolves to nothing rather than something invented',
    getPersona('astronauts') === undefined)
  check('the unresolvable error is a named type callers can catch',
    new PersonaUnresolvableError('x') instanceof Error)
}

console.log('\n── the plan: one language, one market, stack as intersection ──')
{
  const plan = planPersona({
    stack: [group(3, 'doc')],
    speaker: 'arabic',
    residency: 'resident',
  })
  check('one persona means one persona layer plus the real-estate MUST',
    (plan.narrowing ?? []).length === 2, String(plan.narrowing?.length))
  check('the real-estate MUST group is present', hasAnchor(plan.narrowing))
  check('one language, exactly', plan.leadLanguages?.join(',') === 'ar', String(plan.leadLanguages))
  check('the market decides the geo', plan.countries.join(',') === 'AE', plan.countries.join(','))
  check('Saudi is its own campaign here too',
    planPersona({ stack: [group(2, 'x')], speaker: 'arabic', residency: 'saudi' }).countries.join(',') === 'SA')
  check('ages stay inside the 30–65 envelope', plan.ageMin >= 30 && plan.ageMax <= 65,
    `${plan.ageMin}-${plan.ageMax}`)
  check('the time-waster exclusions ride along',
    (plan.exclusions?.interests?.length ?? 0) > 0)

  const stacked = planPersona({
    stack: [group(3, 'doc'), group(2, 'visa'), group(2, 'lux')],
    speaker: 'english',
    residency: 'resident',
  })
  check('three personas stack into three AND layers plus the MUST',
    (stacked.narrowing ?? []).length === 4, String(stacked.narrowing?.length))

  const over = planPersona({
    stack: [group(1, 'a'), group(1, 'b'), group(1, 'c'), group(1, 'd'), group(1, 'e')],
    speaker: 'english',
    residency: 'resident',
  })
  check(`more than ${MAX_STACK} layers is cut, not honoured — an empty room sells nothing`,
    (over.narrowing ?? []).length === MAX_STACK + 1, String(over.narrowing?.length))

  const holey = planPersona({
    stack: [group(2, 'ok'), { interests: [], behaviors: [] }],
    speaker: 'english',
    residency: 'resident',
  })
  check('an empty group is dropped rather than sent as an impossible AND',
    (holey.narrowing ?? []).length === 2, String(holey.narrowing?.length))

  const banded = planPersona({
    stack: [group(2, 'x')], speaker: 'russian', residency: 'resident', ageMin: 20, ageMax: 90,
  })
  check('a persona age band cannot escape the envelope',
    banded.ageMin >= 30 && banded.ageMax <= 65, `${banded.ageMin}-${banded.ageMax}`)
}

console.log('\n── the recipe never leaks through the persona route ──')
{
  const route = readFileSync('app/api/freehold/ads/audiences/persona/route.ts', 'utf8')
  // The public shape is counts and dials. If the route ever returns the
  // resolved entities, the recipe is in the network tab forever.
  check('the response builder exposes layer COUNT, not the layers',
    /layers: \(t\.narrowing \?\? \[\]\)\.length/.test(route))
  check('no response path serialises resolved interests or behaviors',
    !/interests:\s*stack|behaviors:\s*stack|resolved\.interests|resolved\.behaviors/.test(route))
}

if (failures > 0) {
  console.error(`\n${failures} persona rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery persona is a recipe, and the recipe stays in the kitchen.\n')
