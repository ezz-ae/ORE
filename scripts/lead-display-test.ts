/**
 * WHAT A LEAD ROW SAYS ABOUT ITSELF — locked.
 *
 * 571 leads, and every row read:
 *
 *     General enquiry
 *     Unknown
 *     —
 *
 * None of it true, none of it necessary. Every one of those leads arrived
 * through a named Meta form, on a named campaign, for a named project, and the
 * database held all of it — `utm_id` carries the campaign id on every synced
 * lead. Nothing resolved it, so the row printed a placeholder instead of a
 * fact it already had.
 *
 * So the assertions are about the two rules that keep a column worth reading:
 * the most specific TRUE thing wins, and when there is genuinely nothing the
 * row says nothing rather than a word.
 *
 * Pure — no database. Runs in `pnpm guards`.
 */
import { leadSubject, leadBudgetLabel, leadOwnerLabel, SUBJECT_KINDS } from '../lib/freehold/lead-display'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the most specific true thing ──')
{
  const all = {
    interest: '2-bed in Marina',
    projectName: 'Sea Legend One',
    campaignName: 'cash offer new audiences',
    formName: 'Cash offer form',
  }
  check('what the person actually said outranks everything',
    leadSubject(all)?.label === '2-bed in Marina', JSON.stringify(leadSubject(all)))
  check('…and is marked as their own words',
    leadSubject(all)?.kind === 'stated')

  check('without that, the project the campaign sells',
    leadSubject({ ...all, interest: null })?.label === 'Sea Legend One')
  check('without that, the campaign itself — which tells a broker what they answered',
    leadSubject({ ...all, interest: null, projectName: null })?.label === 'cash offer new audiences')
  check('…and last the form they filled in',
    leadSubject({ campaignName: '', formName: 'Cash offer form' })?.label === 'Cash offer form')
  check('every kind it can report is named',
    SUBJECT_KINDS.length === 4, SUBJECT_KINDS.join(','))
}

console.log('\n── a placeholder is not a fact ──')
{
  // THE ROW THAT PRODUCED THIS MODULE: an older import stored the literal
  // words. If they out-ranked a real campaign name the fix would change
  // nothing on exactly the rows that needed it.
  check('a stored "General enquiry" does NOT out-rank a real campaign name',
    leadSubject({ interest: 'General enquiry', campaignName: 'cash offer new audiences' })?.label
      === 'cash offer new audiences')
  check('nor does a stored "Unknown"',
    leadSubject({ interest: 'Unknown', projectName: 'Sea Legend One' })?.label === 'Sea Legend One')
  for (const junk of ['n/a', 'N/A', 'none', 'null', 'undefined', '   ']) {
    check(`"${junk}" is not a description`,
      leadSubject({ interest: junk, campaignName: 'real campaign' })?.label === 'real campaign')
  }
}

console.log('\n── nothing renders as nothing ──')
{
  check('a lead we genuinely know nothing about returns NULL, not a word',
    leadSubject({}) === null)
  check('…and null/undefined fields do not become the string "null"',
    leadSubject({ interest: null, projectName: undefined, campaignName: null }) === null)

  // A column that says "Unknown" 571 times has taught its reader to skip it,
  // and on the day a real budget appears they skip that too.
  check('no budget is null, never the word Unknown', leadBudgetLabel(null) === null)
  check('zero is not a budget', leadBudgetLabel(0) === null)
  check('a negative is not a budget', leadBudgetLabel(-5) === null)
  check('junk is not a budget', leadBudgetLabel('not a number') === null)
  check('a real budget is formatted with its currency',
    leadBudgetLabel(1400000) === 'AED 1,400,000', String(leadBudgetLabel(1400000)))
  check('…and a stored string budget still parses',
    leadBudgetLabel('AED 1,400,000') === 'AED 1,400,000', String(leadBudgetLabel('AED 1,400,000')))
}

console.log('\n── unassigned is a state, not a blank ──')
{
  const nobody = leadOwnerLabel('', 'Unassigned')
  check('a lead nobody owns says so', nobody.label === 'Unassigned' && nobody.unassigned === true,
    JSON.stringify(nobody))
  check('…which is what makes it actionable rather than an em-dash', nobody.unassigned)
  const owned = leadOwnerLabel('sara@freehold.ae', 'Unassigned')
  check('an owned lead names its owner and is not flagged',
    owned.label === 'sara@freehold.ae' && owned.unassigned === false, JSON.stringify(owned))
}

if (failures > 0) {
  console.error(`\n${failures} lead-display rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery row says the truest thing it knows, and stays quiet when it knows nothing.\n')
