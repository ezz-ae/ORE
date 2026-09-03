/**
 * THE GATE WAS THE MARKET — locked.
 *
 * Measured against the account's own catalogue pull (8,611 live interests,
 * 3 Sep 2026). Two findings, and neither was visible from inside the code.
 *
 * ── THE GATE ─────────────────────────────────────────────────────────────
 *
 * REAL_ESTATE_MUST was one node: `Real estate investing`, id 6003051380892.
 *
 * That id IS NOT IN META'S VOCABULARY. It has not been for as long as anyone
 * can tell — the launch resolves by NAME, so nothing ever failed, and the id
 * in the file was decoration.
 *
 * The name resolves to `Real estate investing (investing)` — 610M worldwide,
 * and about 4M IN THE UAE. Roughly two in five reachable adults in this
 * country. A narrowing group is an OR, so the widest member is the width of
 * the gate: the one rule every audience in this product hangs on was letting
 * in most of the market.
 *
 * ── THE EXCLUSIONS ───────────────────────────────────────────────────────
 *
 * Worse, because it was silent. `Real estate agents`, `Job seeking`,
 * `Discount shoppers` and `Apartment renters` are all names Meta does not
 * have. repairTargetingInterests drops an unknown name deliberately, so a
 * stale id cannot fail a launch — and the MUST group is protected from being
 * emptied that way. Exclusions were not.
 *
 * So every exclusion this product has ever set went out empty. "half of them
 * try to find job" is that, exactly: a job-seeker exclusion never once sent.
 *
 * Runs in `pnpm guards`.
 */
import {
  REAL_ESTATE_MUST, GATE_MAX_AUDIENCE, GATE_MEASURED,
  UNBUILDABLE_EXCLUSIONS, standardExclusions, hardenRealEstate, MASS_ENTITY_IDS,
} from '../lib/freehold/audience-pattern'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the gate is narrower than the market ──')
{
  check('the gate is more than one interest',
    REAL_ESTATE_MUST.length >= 3, String(REAL_ESTATE_MUST.length))

  // THE ASSERTION THAT WOULD HAVE CAUGHT IT. Not "is the list long" — a list
  // of four mass interests is no better than one. Every member must be under
  // the ceiling, because the widest member IS the gate.
  for (const e of REAL_ESTATE_MUST) {
    const m = GATE_MEASURED[e.name]
    check(`${e.name} is measured`, !!m, 'no recorded size')
    check(`  …and is under the ceiling`, (m?.upper ?? Infinity) <= GATE_MAX_AUDIENCE,
      `${m?.upper} > ${GATE_MAX_AUDIENCE}`)
    // Asserted on the RECORDED CATEGORY, not on the words in the name. A
    // 'Job titles' or 'Employers' node names people who SELL property; the
    // first attempt at this test matched /broker/ and flagged
    // `Residential real estate brokerage`, an Interests node, while it would
    // have missed an employer called something else entirely.
    check(`  …and came from Interests, not Work`, m?.pathRoot === 'Interests', String(m?.pathRoot))
  }

  // The node that was there. Named explicitly so nobody restores it.
  check('`Real estate investing` is not in the gate',
    !REAL_ESTATE_MUST.some((e) => /^real estate investing/i.test(e.name)),
    'the 4M-in-UAE node is back')

  // A name here that Meta does not have is dropped at launch, and a gate that
  // loses its members runs broad. Every name must be one the catalogue pull
  // actually returned — recorded as a measured size, which is the proof.
  check('every gate member came from the live vocabulary',
    REAL_ESTATE_MUST.every((e) => e.name in GATE_MEASURED),
    REAL_ESTATE_MUST.map((e) => e.name).join(' / '))

  check('no gate member is a mass entity', !REAL_ESTATE_MUST.some((e) => MASS_ENTITY_IDS.has(e.id)))

  // Job titles and Employers name people who SELL property. Putting one in
  // the gate would target the agents this product excludes.
  // The gate must not admit the trade the exclusions remove — two rules
  // arguing. `Residential real estate brokerage` passed every size test and
  // came out for exactly this.
  check('the gate does not admit the trade the exclusions remove',
    !REAL_ESTATE_MUST.some((e) => /brokerage|coaching|license|realtor/i.test(e.name)),
    REAL_ESTATE_MUST.map((e) => e.name).join(' / '))

  // The gate must still actually be applied.
  const hardened = hardenRealEstate({
    countries: ['AE'], cityKeys: [], ageMin: 25, ageMax: 65,
    publisherPlatforms: [], interests: [],
  })
  check('every audience still gets the gate as an AND layer',
    (hardened.narrowing?.[0].interests ?? []).length === REAL_ESTATE_MUST.length)
}

console.log('\n── an exclusion that cannot be built does not pretend to be ──')
{
  // The four dead names, by id. Restoring any of them puts a rule in the spec
  // that Meta silently deletes.
  const DEAD = ['6008500426593', '6002867432822', '6002867432172', '6003417049485']
  const all = standardExclusions()
  for (const id of DEAD) {
    check(`the dead id ${id} is gone from the exclusions`,
      !all.some((e) => e.id === id), `${id} is back`)
  }

  check('the exclusions that DO exist are still sent',
    all.length > 0 && all.every((e) => !!e.id && !!e.name), JSON.stringify(all))

  // NAMED, so a screen can say "this rule is not available" instead of
  // showing a checkbox that does nothing. job_seekers is the expensive one:
  // Meta has no job-seeking interest, and the nearest node (`New job`) is
  // somebody who just started one — close to the opposite.
  check('job seekers is declared unbuildable rather than faked',
    UNBUILDABLE_EXCLUSIONS.includes('job_seekers'), UNBUILDABLE_EXCLUSIONS.join(','))
  check('…and nothing in the exclusions claims to cover it',
    !all.some((e) => /job|employ|career|recruit/i.test(e.name)),
    all.map((e) => e.name).join(' / '))
}

console.log(failures === 0
  ? '\n✅ the gate narrows, and no rule claims to apply when it cannot.'
  : `\n❌ ${failures} gate-width guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
