/**
 * Creative exploration, locked.
 *
 * The machine previously detected creative fatigue and stopped at an alarm,
 * because swapping a working ad resets learning and risks a known performer.
 * Minting a sibling has neither cost — but only if the rules stay honest about
 * WHEN a fresh creative is the answer.
 *
 * The condition that matters most is the third: a fatigued arm with no leads
 * is not a worn-out creative, it is one that never worked, and giving it a
 * second angle spends more money on the same wrong thing.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  nextAngle, shouldMintCreativeArm, FATIGUE_FREQUENCY, MAX_CREATIVE_ARMS_PER_PROJECT,
} from '../lib/freehold/creative-explore'
import type { CreativeAngle } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── a second creative is a second ARGUMENT, not a rewrite ──')
{
  check('investor is answered by lifestyle', nextAngle('investor', []) === 'lifestyle')
  check('lifestyle is answered by investor', nextAngle('lifestyle', []) === 'investor')
  check('yield is answered by the home, not by more numbers',
    nextAngle('yield', []) === 'end_user', String(nextAngle('yield', [])))
  check('urgency is answered by the long-term reason to act',
    nextAngle('urgency', []) === 'golden_visa', String(nextAngle('urgency', [])))
  check('the pairing is symmetric',
    nextAngle('golden_visa', []) === 'urgency' && nextAngle('end_user', []) === 'yield')
}

console.log('\n── it does not repeat itself ──')
{
  check('an angle already tried is skipped',
    nextAngle('investor', ['lifestyle']) !== 'lifestyle',
    String(nextAngle('investor', ['lifestyle'])))
  check('…and the current angle is never returned',
    nextAngle('investor', ['lifestyle']) !== 'investor')
  check('the fallback is deterministic',
    nextAngle('investor', ['lifestyle']) === nextAngle('investor', ['lifestyle']))

  // Everything tried: say so rather than cycling back to the start.
  const all: CreativeAngle[] = ['investor', 'yield', 'end_user', 'lifestyle', 'urgency', 'golden_visa']
  check('when every angle has been tried it returns null',
    nextAngle('investor', all) === null, String(nextAngle('investor', all)))
  check('…which is the signal to change the image, not the words',
    nextAngle('lifestyle', all) === null)

  // Exhausting them one at a time must terminate and never repeat.
  const seen: CreativeAngle[] = []
  let cur: CreativeAngle = 'investor'
  for (let i = 0; i < 10; i++) {
    const n = nextAngle(cur, seen)
    if (n === null) break
    if (seen.includes(n)) { fail('an angle was suggested twice', `${n} after ${seen.join(',')}`); break }
    seen.push(n)
  }
  check('walking the angles terminates without repeating', seen.length === 5, seen.join(','))
}

console.log('\n── fatigue with no leads is not fatigue ──')
{
  // THE ONE THAT MATTERS. A worn-out ad that never worked is not worn out.
  const dead = shouldMintCreativeArm({ frequency: 4.2, leads: 0, creativeArmsMinted: 0 })
  check('a fatigued arm with zero leads does NOT get a fresh creative',
    !dead.mint, dead.reason)
  check('…and the reason says it never worked, rather than that it wore out',
    /never worked/.test(dead.reason), dead.reason)
  check('…and warns a second angle would spend more on the same wrong thing',
    /same wrong thing/.test(dead.reason), dead.reason)

  const alive = shouldMintCreativeArm({ frequency: 4.2, leads: 6, creativeArmsMinted: 0 })
  check('a fatigued arm that DOES work gets one', alive.mint, alive.reason)
  check('…and the reason separates the audience from the ad',
    /audience works and the ad is worn out/.test(alive.reason), alive.reason)
  check('…and states that nothing proven is risked',
    /nothing proven is risked/.test(alive.reason), alive.reason)
}

console.log('\n── it waits for the signal ──')
{
  check('below the fatigue threshold, nothing is minted',
    !shouldMintCreativeArm({ frequency: FATIGUE_FREQUENCY - 0.1, leads: 20, creativeArmsMinted: 0 }).mint)
  check('at the threshold exactly, it fires',
    shouldMintCreativeArm({ frequency: FATIGUE_FREQUENCY, leads: 20, creativeArmsMinted: 0 }).mint)
  const noReading = shouldMintCreativeArm({ frequency: null, leads: 20, creativeArmsMinted: 0 })
  check('no frequency reading means no claim about the creative', !noReading.mint)
  check('…and it says so rather than assuming health',
    /nothing says this creative is worn out/.test(noReading.reason), noReading.reason)
}

console.log('\n── the cap is real and explains itself ──')
{
  const capped = shouldMintCreativeArm({
    frequency: 5, leads: 30, creativeArmsMinted: MAX_CREATIVE_ARMS_PER_PROJECT,
  })
  check('the lifetime cap holds', !capped.mint, capped.reason)
  check('…and points at the image or the offer instead of another rewrite',
    /new image or a new offer/.test(capped.reason), capped.reason)
  check('one below the cap still mints',
    shouldMintCreativeArm({ frequency: 5, leads: 30, creativeArmsMinted: MAX_CREATIVE_ARMS_PER_PROJECT - 1 }).mint)
}

if (failures > 0) {
  console.error(`\n${failures} creative-explore rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll creative-explore rules hold.\n')
