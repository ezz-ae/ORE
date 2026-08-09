/**
 * Which audience actually produces buyers — locked.
 *
 * The system launched from a named audience and then forgot the name. It kept
 * a fingerprint of the targeting, which is enough to spot a duplicate and
 * useless for the only question worth asking before the next launch: of the
 * audiences we have run, which one brought people who bought?
 *
 * Without it every audience is picked by its name, and a name is a hypothesis.
 *
 * Two things must hold, and both are quiet failures:
 *   1. "Qualified" here means what it means everywhere else. A lead cannot be
 *      real on the campaign page, real to the optimiser, and not real here.
 *   2. An audience that was run and brought nothing is still shown. Dropping
 *      it makes the list read as though only the winners were ever tried,
 *      which is the most flattering possible lie about our own targeting.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { rollupAudienceLeads, SAMPLE_LEADS, type AttributedLead } from '../lib/freehold/audience-outcomes'
import { QUALIFIED_STATUSES, WON_STATUSES } from '../lib/freehold/lead-stages'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const lead = (key: string, status: string | null, name?: string): AttributedLead =>
  ({ audienceKey: key, audienceName: key.replace(/^\w+:/, ''), campaignId: 'c1', status, name })

console.log('\n── the record of a name ──')
{
  const rows = rollupAudienceLeads(
    [
      lead('ready:arabicCashUAE', 'closed'),
      lead('ready:arabicCashUAE', 'qualified'),
      lead('ready:arabicCashUAE', 'new'),
      lead('ready:arabicCashUAE', 'lost'),
      lead('saved:abc', 'new'),
      lead('saved:abc', 'new'),
    ],
    new Map([['ready:arabicCashUAE', 2], ['saved:abc', 1]]),
  )
  const arabic = rows.find((r) => r.key === 'ready:arabicCashUAE')!
  check('every attributed lead is counted', arabic.leads === 4, JSON.stringify(arabic))
  check('a closed deal counts as qualified too — it is qualified by definition',
    arabic.qualified === 2, JSON.stringify(arabic))
  check('…and separately as won', arabic.won === 1)
  check('the campaigns that produced it are counted', arabic.campaigns === 2)

  check('the audience that brought buyers is read first',
    rows[0].key === 'ready:arabicCashUAE', rows.map((r) => r.key).join(' | '))
  check('an audience with only raw leads is still listed',
    rows.some((r) => r.key === 'saved:abc' && r.leads === 2 && r.qualified === 0))
}

console.log('\n── "qualified" means the same thing everywhere ──')
{
  for (const status of QUALIFIED_STATUSES) {
    const r = rollupAudienceLeads([lead('k', status)], new Map([['k', 1]]))[0]
    check(`"${status}" counts as real here too`, r.qualified === 1, JSON.stringify(r))
  }
  for (const status of WON_STATUSES) {
    const r = rollupAudienceLeads([lead('k', status)], new Map([['k', 1]]))[0]
    check(`"${status}" counts as a deal`, r.won === 1)
  }
  for (const status of ['new', 'contacted', 'lost', null]) {
    const r = rollupAudienceLeads([lead('k', status)], new Map([['k', 1]]))[0]
    check(`"${status ?? 'no status'}" is a lead and nothing more`,
      r.leads === 1 && r.qualified === 0 && r.won === 0, JSON.stringify(r))
  }
  check('an unfamiliar status is not quietly promoted',
    rollupAudienceLeads([lead('k', 'PARKED')], new Map([['k', 1]]))[0].qualified === 0)
  check('…and casing does not decide whether a lead is real',
    rollupAudienceLeads([lead('k', 'QUALIFIED')], new Map([['k', 1]]))[0].qualified === 1)
}

console.log('\n── nothing is invented, and nothing flattering is hidden ──')
{
  check('no leads at all is an empty list, not a row of zeros',
    rollupAudienceLeads([], new Map()).length === 0)
  // The audience that was run and brought nobody is added by the caller from
  // the campaign table; the rollup must not invent it from thin air here.
  check('an audience with campaigns but no leads is not fabricated by the rollup',
    rollupAudienceLeads([], new Map([['ready:x', 3]])).length === 0)
  check('a lead whose audience has no recorded campaign still counts',
    rollupAudienceLeads([lead('ready:x', 'qualified')], new Map())[0].campaigns === 0)
}

console.log('\n── the people it actually brought ──')
{
  // A percentage is a number. A name a broker recognises is a judgement they
  // can make. The examples shown are the ones that went somewhere, because
  // three leads that all went nowhere would misrepresent an audience that
  // also produced buyers — and the counts above already say how many there
  // were in total.
  const rows = rollupAudienceLeads(
    [
      lead('k', 'new', 'Nobody One'),
      lead('k', 'closed', 'Ahmed Buyer'),
      lead('k', 'new', 'Nobody Two'),
      lead('k', 'viewing', 'Sara Viewer'),
    ],
    new Map([['k', 1]]),
  )
  const r = rows[0]
  check('the examples are the leads that went somewhere',
    r.samples.slice(0, 2).map((s) => s.name).join('|') === 'Ahmed Buyer|Sara Viewer',
    JSON.stringify(r.samples))
  check('…and never more than three', r.samples.length <= SAMPLE_LEADS)
  check('the totals still count every lead', r.leads === 4 && r.qualified === 2)

  // An audience with nothing but raw leads still shows a face rather than a
  // blank — it is still the honest answer to "who did this bring?".
  const raw = rollupAudienceLeads([lead('k', 'new', 'Only Lead')], new Map([['k', 1]]))[0]
  check('an audience with only raw leads still shows one',
    raw.samples.length === 1 && raw.samples[0].name === 'Only Lead', JSON.stringify(raw.samples))
  check('a lead with no name is never shown as a blank face',
    rollupAudienceLeads([lead('k', 'qualified')], new Map([['k', 1]]))[0].samples.length === 0)
  check('the same person is not listed twice',
    rollupAudienceLeads([lead('k', 'new', 'Same One'), lead('k', 'new', 'Same One')], new Map([['k', 1]]))[0]
      .samples.length === 1)
}

if (failures > 0) {
  console.error(`\n${failures} audience-record rule(s) broken.`)
  process.exit(1)
}
console.log('\nAn audience is judged by what it brought back.\n')
