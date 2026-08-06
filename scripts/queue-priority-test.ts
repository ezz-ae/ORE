/**
 * The queue's rules, locked.
 *
 * This is the screen a broker lives in, and the thing it must never do is
 * silently lose a lead. Three properties carry the whole design:
 *
 *  1. NOTHING VANISHES. Every lead in is a lead out, in one list or the other.
 *  2. A BREACHED PROMISE OUTRANKS QUALITY. We told someone we would call.
 *  3. UNRATED IS UNKNOWN, NOT BAD. Burying unrated leads buries every new
 *     lead behind every old one — and new leads are the ones with a clock.
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */
import {
  triage, callOrder, setAsideReason, SET_ASIDE_AT_OR_BELOW, STRONG_AT_OR_ABOVE,
  type QueueLead,
} from '../lib/freehold/queue-priority'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const lead = (leadId: string, o: Partial<QueueLead> = {}): QueueLead => ({
  leadId, valueRating: null, slaBreachMinutes: null, overdueHours: 0, ...o,
})
const ids = (xs: QueueLead[]) => xs.map((x) => x.leadId).join(',')

console.log('\n── nothing is deleted, only moved ──')
{
  const all = [
    lead('a', { valueRating: 9 }), lead('b', { valueRating: 1 }),
    lead('c', { archived: true }), lead('d'), lead('e', { blocked: true }),
    lead('f', { wrongNumberRisk: true }), lead('g', { duplicateRisk: true }),
  ]
  const { queue, setAside } = triage(all)
  check('every lead in is a lead out',
    queue.length + setAside.length === all.length, `${queue.length}+${setAside.length} of ${all.length}`)
  check('…and none is duplicated across the two lists',
    new Set([...queue.map((q) => q.leadId), ...setAside.map((s) => s.lead.leadId)]).size === all.length)
  check('every set-aside lead carries a reason a human can read',
    setAside.every((s) => !!s.reason), JSON.stringify(setAside.map((s) => s.reason)))
  check('an empty queue does not throw', triage([]).queue.length === 0)
}

console.log('\n── a promise outranks every judgment about the lead ──')
{
  // The lead scores 0 AND is archived AND cannot be dialled — and we still
  // said we would call. The breach is a fact about US.
  const breached = lead('x', { valueRating: 0, archived: true, wrongNumberRisk: true, slaBreachMinutes: 30 })
  check('a breached lead is never set aside, whatever it scores',
    setAsideReason(breached) === null, String(setAsideReason(breached)))

  const { queue } = triage([lead('good', { valueRating: 10 }), breached])
  check('…and it sorts above a perfect lead', queue[0].leadId === 'x', ids(queue))
  check('worse breaches come first',
    ids(triage([
      lead('small', { slaBreachMinutes: 5 }), lead('big', { slaBreachMinutes: 400 }),
    ]).queue) === 'big,small')
}

console.log('\n── unrated sits in the middle, because unknown is not bad ──')
{
  const { queue } = triage([
    lead('mid', { valueRating: 4 }), lead('new'), lead('strong', { valueRating: 8 }),
  ])
  check('strong first, unrated second, middling last', ids(queue) === 'strong,new,mid', ids(queue))

  // THE REGRESSION THIS EXISTS TO PREVENT. A fresh lead with a running
  // response clock must not be buried behind every rated lead in the account.
  const many = [
    ...Array.from({ length: 20 }, (_, i) => lead(`rated${i}`, { valueRating: 3 })),
    lead('brandnew'),
  ]
  check('one new lead is not buried behind twenty middling rated ones',
    triage(many).queue[0].leadId === 'brandnew', ids(triage(many).queue).slice(0, 40))
  check('within a band the higher rating still wins',
    ids(triage([lead('six', { valueRating: 6 }), lead('nine', { valueRating: 9 })]).queue) === 'nine,six')
  check('…and among middling ones too',
    ids(triage([lead('three', { valueRating: 3 }), lead('five', { valueRating: 5 })]).queue) === 'five,three')
  check('overdue still breaks a tie between two unrated leads',
    ids(triage([lead('fresh', { overdueHours: 1 }), lead('stale', { overdueHours: 90 })]).queue) === 'stale,fresh')
}

console.log('\n── what leaves the working queue, and why ──')
{
  check('a lead rated at the floor is set aside',
    setAsideReason(lead('a', { valueRating: SET_ASIDE_AT_OR_BELOW })) === 'rated_poor')
  check('…and one just above it is not',
    setAsideReason(lead('a', { valueRating: SET_ASIDE_AT_OR_BELOW + 1 })) === null)
  check('a zero-rated lead is set aside', setAsideReason(lead('a', { valueRating: 0 })) === 'rated_poor')
  check('an UNRATED lead is never set aside — nobody has judged it',
    setAsideReason(lead('a')) === null)
  check('archived and blocked are honoured, which the lead list itself does not do',
    setAsideReason(lead('a', { archived: true })) === 'archived' &&
    setAsideReason(lead('a', { blocked: true })) === 'blocked')
  check('a blocked lead reports blocked, not archived, when it is both',
    setAsideReason(lead('a', { archived: true, blocked: true })) === 'blocked')

  // An undialable number is a data-entry problem when someone rated the
  // person well. Setting that lead aside loses a real buyer over a typo.
  check('an undialable unrated lead is set aside',
    setAsideReason(lead('a', { wrongNumberRisk: true })) === 'undialable')
  check('…but not one a human rated strongly — that is a typo, not a bad lead',
    setAsideReason(lead('a', { wrongNumberRisk: true, valueRating: STRONG_AT_OR_ABOVE })) === null)

  // Duplicate is an INFERENCE, not a judgment, and never enough on its own.
  check('a suspected duplicate stays in the queue by itself',
    setAsideReason(lead('a', { duplicateRisk: true })) === null)
  check('…and still stays when someone rated it well, however duplicated',
    setAsideReason(lead('a', { duplicateRisk: true, valueRating: 8 })) === null)
  // The reason was declared, the caller populated the flag, and nothing could
  // ever return it — a dead branch that read as a working rule.
  check('a duplicate whose phone also fails is set aside AS a duplicate',
    setAsideReason(lead('a', { duplicateRisk: true, wrongNumberRisk: true })) === 'duplicate',
    String(setAsideReason(lead('a', { duplicateRisk: true, wrongNumberRisk: true }))))
  check('…even when rated well, because the person survives on the other record',
    setAsideReason(lead('a', { duplicateRisk: true, wrongNumberRisk: true, valueRating: 9 })) === 'duplicate',
    String(setAsideReason(lead('a', { duplicateRisk: true, wrongNumberRisk: true, valueRating: 9 }))))
  check('a dead phone with NO duplicate still reads as undialable, not duplicate',
    setAsideReason(lead('a', { wrongNumberRisk: true })) === 'undialable')
}

console.log('\n── the order is total and stable ──')
{
  // A comparator that is not consistent produces a different queue on every
  // render, and a broker watching rows swap places stops trusting the screen.
  const sample: QueueLead[] = [
    lead('a', { valueRating: 9 }), lead('b'), lead('c', { valueRating: 4 }),
    lead('d', { slaBreachMinutes: 10 }), lead('e', { valueRating: 7, overdueHours: 5 }),
    lead('f', { overdueHours: 50 }), lead('g', { valueRating: 6 }),
  ]
  const once = ids(triage(sample).queue)
  const again = ids(triage([...sample].reverse()).queue)
  check('reversing the input does not change the order', once === again, `${once} vs ${again}`)
  check('comparing a lead with itself is zero',
    sample.every((l) => callOrder(l, l) === 0))
  check('the comparator is antisymmetric',
    sample.every((x) => sample.every((y) => Math.sign(callOrder(x, y)) === -Math.sign(callOrder(y, x)))))
}

console.log('\n── the thresholds are the ones the rest of the system uses ──')
{
  // Two different numbers for "poor" would be two different opinions wearing
  // one word: a lead the broker set aside and a lead the machine counts
  // against a campaign must be the same lead.
  check('the set-aside floor matches campaign-quality\'s "avoid" line',
    SET_ASIDE_AT_OR_BELOW === 2, String(SET_ASIDE_AT_OR_BELOW))
  check('the strong line matches campaign-quality\'s "valuable" line',
    STRONG_AT_OR_ABOVE === 6, String(STRONG_AT_OR_ABOVE))
}

if (failures > 0) {
  console.error(`\n${failures} queue rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo lead can be silently lost from the queue.\n')
