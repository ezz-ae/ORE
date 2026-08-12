/**
 * WHAT A RATING ACTUALLY DOES — locked.
 *
 * Brokers have started rating leads. A rating that changes nothing is worse
 * than no rating: it costs ten seconds a lead and buys a number in a column.
 *
 * Half the loop already worked — a lead rated >= 6 sends Meta a QualifiedLead
 * event. The other half did NOT: a lead rated 0–2 sent nothing at all, so Meta
 * learned which leads were good and never which were junk.
 *
 * So these assertions are about the two ways this screen could lie: claiming a
 * step is done when it is not (a lookalike built from eleven people is a broad
 * audience wearing a precise name), and reporting what we UPLOADED as though
 * it were what Meta MATCHED.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  loopStepsFor, loopHeadline, isValuableRating, isAvoidRating,
  LOOKALIKE_MIN_SEED, SUPPRESSION_MIN_SEED, AVOID_RATING, LOOP_STEPS, LOOP_STATES,
  type RatingLoopFacts,
} from '../lib/freehold/rating-loop'
import { VALUABLE_RATING } from '../lib/freehold/lead-stages'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const facts = (o: Partial<RatingLoopFacts> = {}): RatingLoopFacts => ({
  total: 571, rated: 40, valuable: 12, avoid: 9, sent: 12,
  seedMatched: 0, lookalikeExists: false, suppressionMatched: 0,
  attached: false, metaConnected: true, ...o,
})
const stateOf = (f: RatingLoopFacts, id: string) => loopStepsFor(f).find((s) => s.id === id)!

console.log('\n── the bands mean one thing everywhere ──')
{
  check(`>= ${VALUABLE_RATING} is valuable`, isValuableRating(VALUABLE_RATING) && isValuableRating(10))
  check('…and 5 is not', !isValuableRating(5))
  check(`<= ${AVOID_RATING} is avoid`, isAvoidRating(0) && isAvoidRating(AVOID_RATING))
  check('…and 3 is not', !isAvoidRating(3))
  // A ZERO IS A RATING. "This lead was worthless" is the most useful thing a
  // broker writes, and treating it as unrated loses the strongest signal.
  check('zero is a rating, not an absence', isAvoidRating(0))
  check('null and undefined are neither', !isValuableRating(null) && !isAvoidRating(undefined))
}

console.log('\n── nothing past step one happens without Meta ──')
{
  const off = loopStepsFor(facts({ metaConnected: false }))
  check('rating still counts — it is the half a person drives',
    off[0].state === 'done', off[0].state)
  check('…and the other three say BLOCKED rather than stalling silently',
    off.slice(1).every((s) => s.state === 'blocked'), off.map((s) => s.state).join(','))
  check('…offering nothing to press, because nothing here would work',
    off.slice(1).every((s) => s.action === 'none'))
}

console.log('\n── the seed is MATCHED people, against Meta\'s real floor ──')
{
  // THE LIE THIS PREVENTS: a lookalike from a dozen people is accepted by Meta
  // and produces something indistinguishable from open targeting — a broad
  // audience wearing a precise name.
  const thin = stateOf(facts({ seedMatched: 12, lookalikeExists: true }), 'seeded')
  check(`a lookalike on 12 matched people is WAITING, not done (floor ${LOOKALIKE_MIN_SEED})`,
    thin.state === 'waiting', thin.state)
  check('…and says how far off it is', thin.vars.matched === 12 && thin.vars.need === LOOKALIKE_MIN_SEED,
    JSON.stringify(thin.vars))

  const real = stateOf(facts({ valuable: 140, sent: 140, seedMatched: 120, lookalikeExists: true }), 'seeded')
  check('a real seed with a real lookalike is done', real.state === 'done', real.state)

  const noLal = stateOf(facts({ valuable: 140, seedMatched: 120, lookalikeExists: false }), 'seeded')
  check('enough people but NO lookalike built is still waiting — an audience is not targeting',
    noLal.state === 'waiting', noLal.state)

  check('an unknown match count is treated as zero, never as "probably fine"',
    stateOf(facts({ seedMatched: null, lookalikeExists: true }), 'seeded').state === 'waiting')
}

console.log('\n── the negative half, which is not symmetrical ──')
{
  // There is no "bad lead" event in the Conversions API. The only honest
  // negative lever is exclusion — and it pays off far earlier than a
  // lookalike, because no modelling is involved to be degraded by a small
  // sample.
  check(`suppression is useful at ${SUPPRESSION_MIN_SEED}, far below the lookalike floor`,
    SUPPRESSION_MIN_SEED < LOOKALIKE_MIN_SEED)

  const onlyBad = facts({ valuable: 0, sent: 0, avoid: 30, suppressionMatched: 25 })
  check('a workspace that has only rated BAD leads still has something to press',
    stateOf(onlyBad, 'seeded').action === 'sync', stateOf(onlyBad, 'seeded').action)
  check('…and its exclusion alone is enough to reach the targeting step',
    stateOf(onlyBad, 'targeted').state === 'waiting', stateOf(onlyBad, 'targeted').state)
  check('…which then offers the attach',
    stateOf(onlyBad, 'targeted').action === 'attach')

  const tinyBad = facts({ valuable: 0, sent: 0, avoid: 3, suppressionMatched: 3 })
  check('three bad ratings is not an exclusion list',
    stateOf(tinyBad, 'targeted').state === 'idle', stateOf(tinyBad, 'targeted').state)
}

console.log('\n── an audience nothing points at changes no delivery ──')
{
  const built = facts({ valuable: 140, sent: 140, seedMatched: 120, lookalikeExists: true, attached: false })
  check('a built lookalike attached to nothing is WAITING, not done',
    stateOf(built, 'targeted').state === 'waiting', stateOf(built, 'targeted').state)
  check('…and that is what the headline says, because a loop is only as closed as its weakest link',
    loopHeadline(loopStepsFor(built)).id === 'targeted')

  const closed = { ...built, attached: true }
  check('attached is the only state that closes it',
    stateOf(closed, 'targeted').state === 'done')
  check('…and then the headline is done', loopHeadline(loopStepsFor(closed)).state === 'done')
}

console.log('\n── the shortfall between earned and sent is visible ──')
{
  // A lead with no email and no phone earns an event Meta cannot match, and a
  // failed write-back leaves the same gap. Both are worth seeing.
  const gap = stateOf(facts({ valuable: 12, sent: 9 }), 'told')
  check('nine sent against twelve earned is waiting, not done', gap.state === 'waiting', gap.state)
  check('…with both numbers on the card', gap.vars.sent === 9 && gap.vars.valuable === 12,
    JSON.stringify(gap.vars))
  check('all sent is done', stateOf(facts({ valuable: 12, sent: 12 }), 'told').state === 'done')
  check('nothing valuable yet is IDLE, not a fault',
    stateOf(facts({ valuable: 0, sent: 0 }), 'told').state === 'idle')
  check('the send is automatic — never a button, because it fires on the rating write',
    stateOf(facts(), 'told').action === 'none')
}

console.log('\n── the headline names what to press ──')
{
  check('a workspace with no ratings at all points at rating',
    loopHeadline(loopStepsFor(facts({ rated: 0, valuable: 0, avoid: 0, sent: 0 }))).id === 'rated')
  check('…and a disconnected one points at the block first',
    loopHeadline(loopStepsFor(facts({ metaConnected: false }))).state === 'blocked')

  // Every step and state must be reachable, or the screen carries dead copy.
  const seen = new Set<string>()
  const cases = [
    facts(), facts({ rated: 0, valuable: 0, avoid: 0, sent: 0 }), facts({ metaConnected: false }),
    facts({ valuable: 140, sent: 140, seedMatched: 120, lookalikeExists: true }),
    facts({ valuable: 140, sent: 140, seedMatched: 120, lookalikeExists: true, attached: true }),
    facts({ valuable: 12, sent: 9 }),
  ]
  for (const c of cases) for (const s of loopStepsFor(c)) seen.add(s.state)
  const missing = LOOP_STATES.filter((s) => !seen.has(s))
  check('every state this module can report is reachable', missing.length === 0, missing.join(','))
  check('every step is always present, so the screen never loses a row',
    cases.every((c) => loopStepsFor(c).length === LOOP_STEPS.length))
}

if (failures > 0) {
  console.error(`\n${failures} rating-loop rule(s) broken.`)
  process.exit(1)
}
console.log('\nA rating reaches Meta, or the screen says exactly where it stopped.\n')
