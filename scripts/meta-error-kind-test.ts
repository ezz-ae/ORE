/**
 * Reading a Meta error correctly, and refusing to over-read it.
 *
 * The hub opened on eight alarms that were two problems re-reported four times
 * each, every one of them Meta's raw string:
 *
 *   Unsupported get request. Object with ID '120246739739770436' does not
 *   exist, cannot be loaded due to missing permissions, or does not support
 *   this operation. — subcode 33
 *
 * The dangerous instinct is to read "does not exist" and mark the campaign
 * deleted. Subcode 33 is THREE ANSWERS IN ONE, and a token that lost `ads_read`
 * returns it for a campaign that is alive and spending. Pausing that campaign
 * on a guess is the expensive mistake, so the classifier reports "cannot tell"
 * and the engine changes nothing.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { metaErrorKind, isWorthAlarming, explainMetaError } from '../lib/meta/error-kind'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

// The exact error off the hub screenshot, in the shapes it actually arrives in.
const REAL = "Unsupported get request. Object with ID '120246739739770436' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api — subcode 33"

console.log('\n── the error that filled the hub ──')
{
  check('the raw message classifies as unreachable',
    metaErrorKind(new Error(REAL)) === 'unreachable', metaErrorKind(new Error(REAL)))
  check('…as a Graph payload', metaErrorKind({ error: { code: 100, error_subcode: 33, message: REAL } }) === 'unreachable')
  check('…as a nested response body',
    metaErrorKind({ response: { error: { code: 100, error_subcode: 33 } } }) === 'unreachable')
  check('…and as serialised JSON inside an Error message',
    metaErrorKind(new Error('Meta error: {"error":{"code":100,"error_subcode":33,"message":"Unsupported get request."}}')) === 'unreachable')
  check('it is worth telling a human about', isWorthAlarming('unreachable'))
}

console.log('\n── subcode 33 is three answers, so it decides nothing ──')
{
  // THE POINT OF THE WHOLE MODULE. The classification must not licence an
  // action, and the sentence must not claim to know which of the three it is.
  const sentence = explainMetaError('unreachable', 'Buyer Match')
  check('the sentence names the campaign, not an object id',
    sentence.includes('Buyer Match') && !/\d{10,}/.test(sentence), sentence)
  check('…and admits both causes rather than picking one',
    /deleted/i.test(sentence) && /access/i.test(sentence), sentence)
  check('…and says plainly that nothing was changed',
    /nothing has been changed|no campaign has been changed/i.test(sentence), sentence)
  check('…and points at somewhere a person can actually go',
    /Ads Manager|Integrations/.test(sentence), sentence)
  check('no explanation pastes a Graph documentation URL at an operator',
    (['unreachable', 'auth', 'rate_limit', 'transient'] as const)
      .every((k) => !explainMetaError(k, 'X').includes('http')))
}

console.log('\n── a rate limit is not an alarm ──')
{
  // It clears by itself. Alarming on it trains an operator to ignore alarms,
  // which is how the one that matters gets missed.
  check('code 4 is a rate limit', metaErrorKind({ error: { code: 4 } }) === 'rate_limit')
  check('code 17 too', metaErrorKind({ error: { code: 17 } }) === 'rate_limit')
  check('and by message when the code is missing',
    metaErrorKind(new Error('(#4) Application request limit reached')) === 'rate_limit')
  check('a rate limit never reaches a human', !isWorthAlarming('rate_limit'))
  check('nor does an ordinary transient failure', !isWorthAlarming('transient'))
  // A permission refusal is permanent until a human acts — it must never sit
  // in 'transient' being retried forever.
  check('a permission refusal is not transient',
    metaErrorKind({ error: { code: 200 } }) === 'unreachable',
    metaErrorKind({ error: { code: 200 } }))
}

console.log('\n── a dead token is its own problem ──')
{
  check('code 190 is an auth failure', metaErrorKind({ error: { code: 190 } }) === 'auth')
  check('code 102 too', metaErrorKind({ error: { code: 102, error_subcode: 33 } }) === 'auth')
  check('an expired session by message',
    metaErrorKind(new Error('Error validating access token: Session has expired')) === 'auth')
  check('it is worth telling a human about', isWorthAlarming('auth'))
  check('the auth sentence does not blame a campaign — nothing will work at all',
    /reconnect/i.test(explainMetaError('auth', 'Buyer Match')),
    explainMetaError('auth', 'Buyer Match'))
}

console.log('\n── an unknown error is retried, not guessed at ──')
{
  check('a plain network failure is transient',
    metaErrorKind(new Error('fetch failed')) === 'transient')
  check('an empty error does not throw', metaErrorKind(undefined) === 'transient')
  check('null does not throw', metaErrorKind(null) === 'transient')
  check('a bare string is read', metaErrorKind('socket hang up') === 'transient')
  check('a number is not mistaken for a code', metaErrorKind(42) === 'transient')
  check('an unrelated code stays transient rather than being invented into a bucket',
    metaErrorKind({ error: { code: 1 } }) === 'transient')
}

console.log('\n── the engine only alarms on what a person can act on ──')
{
  const ENGINE = readFileSync('lib/freehold/ads-machine-engine.ts', 'utf8')
  const insights = ENGINE.slice(ENGINE.indexOf('const insights = await getCampaignInsights'))
    .slice(0, 2000)
  check('the insights failure is classified before anything is logged',
    /metaErrorKind\(e\)/.test(insights), 'raw error still logged unclassified')
  check('…and only a rate limit is dropped, so nothing permanent goes unrecorded',
    /kind !== 'rate_limit'/.test(insights),
    'an unrecognised permanent failure would be retried forever and logged nowhere')
  check('…and is logged at most once per standing condition',
    /logActivityOnce\(/.test(insights), 'still logs every cycle')
  check('…and still keeps the raw error for whoever debugs it',
    /raw: errMsg\(e\)/.test(insights))
  check('nothing on this path pauses or stops a campaign on a guess',
    !/setCampaignStatus|'stopped'|pauseCampaign/.test(insights), 'an unreadable campaign is being acted on')
}

if (failures > 0) {
  console.error(`\n${failures} meta-error rule(s) broken.`)
  process.exit(1)
}
console.log('\nMeta errors are read for what they say, not for what they hint.\n')
