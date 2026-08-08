/**
 * Meta's errors, said in words that can be acted on — locked.
 *
 * Five failed launches in a month reached the operator as Meta's own text, and
 * each one ended with a phone call asking whether the system was broken:
 *
 *   "Interests with ID 6002714398372 is invalid — subcode 1487079"
 *   "Facebook Stories Placement Not Allowed Alone — subcode 1815891"
 *   "Parameter label cannot be specified for non-custom questions — 1892063"
 *
 * The rule in both directions:
 *   · A fault we KNOW gets one plain sentence naming the fix.
 *   · A fault we do NOT know keeps Meta's own words. Inventing an explanation
 *     for an unseen error is worse than the raw text, because it would be
 *     confidently wrong and would send someone to fix the wrong thing.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { explainMetaError, splitLaunchStep, SUBCODE_ADVICE } from '../lib/meta/error-advice'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the faults this account has actually produced ──')
{
  check('an interest Meta dropped says which button to press',
    /Check now/i.test(explainMetaError({ subcode: 1487079 }) ?? ''),
    String(explainMetaError({ subcode: 1487079 })))
  check('Facebook Stories alone says what to add',
    /Facebook Feed|Instagram Stories/.test(explainMetaError({ subcode: 1815891 }) ?? ''))
  check('the prefill-label rejection says whose wording wins',
    /Meta writes the wording/i.test(explainMetaError({ subcode: 1892063 }) ?? ''))
  check('a fault that is ours says so, instead of sending them hunting',
    /on us/i.test(explainMetaError({ subcode: 3858504 }) ?? ''))
  check('an expired login says where to reconnect',
    /Integrations/.test(explainMetaError({ code: 190 }) ?? ''))
  check('rate limiting says nothing is broken',
    /Nothing is broken/i.test(explainMetaError({ code: 4 }) ?? ''))
}

console.log('\n── the error arrives as a plain string too ──')
{
  // Once it has crossed an API route it is one string; the structured code and
  // subcode are gone. The subcode is still in the text, so it is still read.
  const asText = 'Invalid parameter — Facebook Stories Placement Not Allowed Alone — subcode 1815891'
  check('a subcode inside the text is found',
    explainMetaError({ message: asText }) === SUBCODE_ADVICE[1815891],
    String(explainMetaError({ message: asText })))
  check("Meta's shrug is answered honestly, not diagnosed",
    /without saying why/i.test(explainMetaError({ message: 'An unknown error has occurred.' }) ?? ''),
    String(explainMetaError({ message: 'An unknown error has occurred.' })))
  check('a budget below the minimum says to raise it',
    /Raise it/i.test(explainMetaError({ message: 'The daily budget is too low for this country' }) ?? ''))
}

console.log('\n── an error we do not know is left exactly as Meta wrote it ──')
{
  check('an unrecognised subcode gets no invented explanation',
    explainMetaError({ message: 'Something new broke — subcode 9999999', subcode: 9999999 }) === null,
    String(explainMetaError({ subcode: 9999999 })))
  check('an unrecognised code gets none either', explainMetaError({ code: 12345 }) === null)
  check('an empty error is not dressed up', explainMetaError({ message: '' }) === null)
  check('nothing at all returns nothing', explainMetaError({}) === null)
}

console.log('\n── which step failed is kept ──')
{
  const { step, rest } = splitLaunchStep('[ad set (Instagram Story)] Invalid parameter — subcode 1815891')
  check('the failing ad set is named', step === 'ad set (Instagram Story)', String(step))
  check('…and the rest of the message survives whole',
    rest === 'Invalid parameter — subcode 1815891', rest)
  check('…and it still resolves to the plain sentence',
    explainMetaError({ message: rest }) === SUBCODE_ADVICE[1815891])

  const plain = splitLaunchStep('Could not reach Meta')
  check('a message with no step is unchanged',
    plain.step === null && plain.rest === 'Could not reach Meta')
  check('a multi-line message keeps its later lines',
    splitLaunchStep('[ad] line one\nline two').rest === 'line one\nline two',
    JSON.stringify(splitLaunchStep('[ad] line one\nline two').rest))
}

if (failures > 0) {
  console.error(`\n${failures} error-wording rule(s) broken.`)
  process.exit(1)
}
console.log('\nA Meta failure says what to do, or says exactly what Meta said.\n')
