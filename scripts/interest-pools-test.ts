/**
 * WHICH POOL BOUGHT THIS LEAD — locked.
 *
 * "know each lead coming from which interest pool — analyse a full interest
 *  and behaviour signal — understand where the delivery is working now."
 *
 * The product could not answer this for a single dirham of current spend.
 * audience-outcomes.ts keys on OUR saved-audience id, so it sees only what
 * this system launched; every live campaign in the account was built by hand
 * in Ads Manager and does not exist to it.
 *
 * The join that works on anything is Meta's own:
 *   lead.meta_ad_id → ad.adset_id → adset.targeting → the pool.
 *
 * ── THE HONEST GRAIN ─────────────────────────────────────────────────────
 *
 * META NEVER SAYS WHICH INTEREST PRODUCED A LEAD. Inside an ad set the
 * interests are an OR resolved in one auction; there is no per-node
 * attribution. So the unit is the ad set's WHOLE STACK, and the way to get
 * finer resolution is structural — one pool per ad set — not analytical.
 *
 * These assertions pin the three ways that could quietly become a lie: a key
 * that changes when Meta reorders the same stack, a spec shape that gets
 * missed so two pools merge, and a mean that lets one rated lead outvote
 * forty.
 *
 * Runs in `pnpm guards`.
 */
import {
  poolSignals, poolKey, rollupPools, poolResolution, type AdSetPool,
} from '../lib/freehold/interest-pools'
import { MIN_ATTRIBUTED_FOR_QUALITY } from '../lib/freehold/min-evidence'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ent = (...names: string[]) => names.map((n, i) => ({ id: String(100 + i), name: n }))

console.log('\n── the pool is the whole stack, in every shape Meta uses ──')
{
  // Ads Manager and the API return the same audience three different ways.
  // Missing one silently merges two different pools under one key.
  const flat = { interests: ent('Residential real estate'), behaviors: ent('Frequent travellers') }
  const flex = { flexible_spec: [{ interests: ent('Residential real estate') }, { behaviors: ent('Frequent travellers') }] }
  check('a flat spec and a flexible one describing the same stack are one pool',
    poolKey(flat) === poolKey(flex), `${poolKey(flat)} vs ${poolKey(flex)}`)

  // THE ASSERTION THAT MATTERS MOST FOR EVIDENCE. If the key moved when Meta
  // reordered the list, the pool would "become new" overnight and reset its
  // own sample to zero — the mean would never clear the threshold and the
  // screen would say "not enough data" forever.
  const a = { interests: ent('Zebra', 'Apple') }
  const b = { interests: ent('Apple', 'Zebra') }
  check('the same stack in a different order is the same pool', poolKey(a) === poolKey(b))

  check('an ad set with no interests is a pool called broad, not a blank',
    poolKey({}) === 'broad' && poolKey(null) === 'broad')
  check('…which is the pool most worth being able to name',
    poolSignals({}).length === 0)

  check('duplicate names across layers collapse',
    poolSignals({ interests: ent('X'), flexible_spec: [{ interests: ent('X') }] }).join('|') === 'X')
}

console.log('\n── two ad sets with one stack are one pool ──')
{
  const stack = { interests: ent('Residential real estate') }
  const sets: AdSetPool[] = [
    { adSetId: 's1', adSetName: 'A', adIds: ['a1'], targeting: stack },
    { adSetId: 's2', adSetName: 'B', adIds: ['a2'], targeting: stack },
  ]
  const ratings = new Map([
    ['a1', { rated: 4, meanRating: 8 }],
    ['a2', { rated: 6, meanRating: 6 }],
  ])
  const [pool] = rollupPools(sets, ratings)

  check('their evidence adds up rather than sitting in two piles',
    pool.rated === 10, String(pool.rated))
  // WEIGHTED BY SAMPLE. The naive average of 8 and 6 is 7; the truth is 6.8,
  // because six leads say more than four. Averaging the means would let one
  // broker's Tuesday count as much as a month.
  check('…and the mean is weighted by sample, not by ad',
    Math.abs(pool.meanRating - 6.8) < 1e-9, String(pool.meanRating))
  check('…and the pool knows it is shared across ad sets',
    pool.resolution === 'shared' && pool.adSetIds.length === 2)

  const alone = rollupPools([sets[0]], ratings)[0]
  check('one ad set carrying a pool alone is exact attribution',
    alone.resolution === 'exact')
}

console.log('\n── undecided is not a verdict ──')
{
  const thin: AdSetPool[] = [{ adSetId: 's1', adSetName: 'A', adIds: ['a1'], targeting: { interests: ent('P') } }]
  const rich: AdSetPool[] = [{ adSetId: 's2', adSetName: 'B', adIds: ['a2'], targeting: { interests: ent('Q') } }]
  const ratings = new Map([
    ['a1', { rated: MIN_ATTRIBUTED_FOR_QUALITY - 1, meanRating: 10 }],
    ['a2', { rated: MIN_ATTRIBUTED_FOR_QUALITY + 5, meanRating: 6 }],
  ])
  const rolled = rollupPools([...thin, ...rich], ratings)

  check('a pool below the evidence line is marked undecided',
    rolled.find((p) => p.key === 'P')!.decided === false)
  // The order is the recommendation. A perfect 10 on four leads must not sit
  // above a solid 6 on ten — "which pool do I buy more of" is not answered by
  // a provisional mean, however good it looks.
  check('…and never outranks a decided pool, however good it looks',
    rolled[0].key === 'Q', rolled.map((p) => p.key).join(','))

  check('the evidence line is the product\'s, not a new one',
    rolled.find((p) => p.key === 'Q')!.rated >= MIN_ATTRIBUTED_FOR_QUALITY)
}

console.log('\n── and it says when splitting would buy an answer ──')
{
  const many: AdSetPool[] = [{
    adSetId: 's1', adSetName: 'A', adIds: ['a1'],
    targeting: { interests: ent('One', 'Two', 'Three') },
  }]
  const decided = rollupPools(many, new Map([['a1', { rated: 20, meanRating: 7 }]]))[0]
  const r = poolResolution(decided)
  check('a three-signal pool would split into three answers',
    r.signals === 3 && r.wouldSplitInto === 3)
  check('…and that is worth saying once the pool has produced something',
    r.worthSplitting)

  // Asking somebody to pay for resolution on a question they have not asked.
  const undecided = rollupPools(many, new Map([['a1', { rated: 1, meanRating: 9 }]]))[0]
  check('…but never on a pool nobody has rated yet',
    !poolResolution(undecided).worthSplitting)

  const single = rollupPools(
    [{ adSetId: 's1', adSetName: 'A', adIds: ['a1'], targeting: { interests: ent('Only') } }],
    new Map([['a1', { rated: 20, meanRating: 7 }]]),
  )[0]
  check('a one-signal pool has nothing to split', !poolResolution(single).worthSplitting)
}

console.log(failures === 0
  ? '\n✅ every lead is attributed to the pool that bought it, at the grain Meta supports.'
  : `\n❌ ${failures} interest-pool guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
