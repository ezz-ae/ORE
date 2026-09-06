/**
 * A REALTOR CAN CONNECT META — locked.
 *
 * "i want an easier connection way in meta for a realtor."
 *
 * Connecting used to mean pasting an access token, an ad account id and a page
 * id into a form. That is a developer's task described as a settings screen. A
 * brokerage owner has never generated a token, will not find the Graph API
 * Explorer, and the first thing they do is give up — or send you their
 * Facebook password, which is worse.
 *
 * Four things decide whether the button version is safe, and each one fails
 * quietly.
 *
 *   THE CALLBACK MUST BELONG TO A LOGIN THIS SERVER STARTED. Otherwise
 *   somebody can walk a realtor through connecting THEIR ad account to an
 *   attacker's workspace, and the result looks entirely normal.
 *
 *   THE TOKEN MUST BE THE LONG ONE. What Facebook hands back at the end of a
 *   login lasts about an hour. Everything works, beautifully, until lunch.
 *
 *   THE EXPIRY MUST BE RECORDED. A token that dies quietly takes the
 *   campaigns, the lead sync and every ads screen with it, and each of those
 *   reads like a bug in the product rather than an expired login.
 *
 *   AND ONLY WHAT IS USED MAY BE ASKED FOR. Every scope is a line on the
 *   consent screen and a question in App Review.
 *
 * Runs in `pnpm guards`. Talks to nothing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  META_SCOPES, scopeString, signState, verifyState, STATE_TTL_MS,
  authorizeUrl, expiryFrom, daysUntilExpiry, connectionHealth,
  RECONNECT_WARNING_DAYS, OAUTH_GRAPH_VERSION,
} from '../lib/freehold/meta-oauth'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const SECRET = 'app-secret-for-tests'
const NOW = Date.parse('2026-09-06T12:00:00Z')

console.log('\n── the callback belongs to a login we started ──')
{
  const state = signState({ tenant: 't_acme', nonce: 'n1', issuedAtMs: NOW }, SECRET)
  const good = verifyState(state, SECRET, NOW + 1000)
  check('a state we signed verifies, and names its tenant',
    good.ok && good.tenant === 't_acme', JSON.stringify(good))

  // THE ATTACK THIS STOPS. Without a signature, a crafted callback connects
  // somebody else's ad account into whichever workspace the attacker chose.
  const forged = signState({ tenant: 't_acme', nonce: 'n1', issuedAtMs: NOW }, 'not-the-secret')
  check('a state signed with another secret is refused',
    !verifyState(forged, SECRET, NOW).ok)
  check('…and so is a tampered payload',
    !verifyState('eyJ0ZW5hbnQiOiJ0X2V2aWwifQ.' + state.split('.')[1], SECRET, NOW).ok)
  check('…and garbage', !verifyState('nonsense', SECRET, NOW).ok)
  check('…and an empty state', !verifyState('', SECRET, NOW).ok)

  // A state left in a browser history must not still work tomorrow.
  check('an old state has expired',
    !verifyState(state, SECRET, NOW + STATE_TTL_MS + 1000).ok)
  check('…while a login taken at a normal pace still works',
    verifyState(state, SECRET, NOW + 60_000).ok)
  // Clock skew forward is not a licence to accept anything.
  check('a state from the future is refused',
    !verifyState(signState({ tenant: 't', nonce: 'n', issuedAtMs: NOW + 600_000 }, SECRET), SECRET, NOW).ok)

  const reasons = ['malformed', 'bad_signature', 'expired']
  const r = verifyState('nonsense', SECRET, NOW)
  check('a refusal says which kind it was',
    !r.ok && reasons.includes(r.reason), JSON.stringify(r))
}

console.log('\n── ask for the least that works ──')
{
  check('every scope states what breaks without it',
    META_SCOPES.every((s) => s.because.length > 10), JSON.stringify(META_SCOPES))

  // Without this one, no lead ever arrives — the product does nothing.
  check('leads_retrieval is requested', scopeString().includes('leads_retrieval'))
  check('…and ads_management, or nothing can be launched or paused',
    scopeString().includes('ads_management'))

  // NOT REQUESTED, DELIBERATELY. The product never posts as the page or reads
  // profiles; asking anyway costs a consent line and a review question.
  for (const unwanted of ['pages_manage_posts', 'publish_to_groups', 'user_photos', 'email']) {
    check(`${unwanted} is not requested`, !scopeString().includes(unwanted))
  }

  const url = authorizeUrl({ appId: '123', redirectUri: 'https://x.test/cb', state: 'st' })
  check('the authorize URL carries app, redirect, state and scopes',
    url.includes('client_id=123') && url.includes('state=st')
    && url.includes('redirect_uri=https%3A%2F%2Fx.test%2Fcb')
    && url.includes('leads_retrieval'), url.slice(0, 120))
  // A flow that authorizes on one version and exchanges on another fails in a
  // way that reads as "the user declined".
  check('one pinned Graph version, used by the whole flow',
    url.includes(OAUTH_GRAPH_VERSION))
}

console.log('\n── the token that lasts, and knowing when it will not ──')
{
  // ~60 days from Facebook.
  const exp = expiryFrom(60 * 86_400, NOW)
  check('an expiry is recorded from what Facebook returns',
    typeof exp === 'string' && daysUntilExpiry(exp, NOW) === 60, String(exp))

  // "Never" and "in ten years" are different facts, and only one is true.
  check('a token with no expiry is recorded as never, not as a far-off date',
    expiryFrom(undefined, NOW) === null && expiryFrom(0, NOW) === null)
  check('…and reads as never_expires',
    connectionHealth(null, NOW) === 'never_expires')

  check('a healthy connection is ok', connectionHealth(expiryFrom(60 * 86_400, NOW), NOW) === 'ok')
  // SAY IT WHILE IT STILL WORKS. The failure mode is silence: campaigns stop
  // being readable and every screen shows what looks like a bug.
  check('a connection inside the warning window says so',
    connectionHealth(expiryFrom(RECONNECT_WARNING_DAYS * 86_400 - 3600, NOW), NOW) === 'expiring')
  check('…and a dead one says expired',
    connectionHealth(new Date(NOW - 86_400_000).toISOString(), NOW) === 'expired')
  check('two weeks is enough notice to act between other things',
    RECONNECT_WARNING_DAYS >= 7)
  check('an unparseable expiry is not treated as a date',
    daysUntilExpiry('not a date', NOW) === null)
}

console.log('\n── and the routes do it in that order ──')
{
  const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const start = code('app/api/freehold/integrations/meta/oauth/start/route.ts')
  const cb = code('app/api/freehold/integrations/meta/oauth/callback/route.ts')

  // Connecting an ad account spends money and reads lead PII.
  check('starting a connection is management-only', /MANAGEMENT_ROLES/.test(start))
  check('…and so is finishing one', /MANAGEMENT_ROLES/.test(cb))
  check('the state is signed on the way out', /signState\(/.test(start))
  check('…and verified on the way back', /verifyState\(/.test(cb))
  check('…and checked against THIS tenant, not just any valid one',
    /checked\.tenant !== \(await resolveActiveSchema\(\)\)/.test(cb))

  // THE ONE THAT WOULD LOOK LIKE IT WORKED. A short-lived token works
  // beautifully until lunch.
  check('the short token is exchanged for the long one',
    /fb_exchange_token/.test(cb), 'the connection would die within the hour')
  check('…and the expiry is stored with it', /tokenExpiresAt: expiryFrom\(/.test(cb))

  // A reconnect must not silently un-pick somebody's ad account.
  check('a reconnect keeps the chosen account, page and dataset',
    /existing\?\.adAccountId/.test(cb) && /existing\?\.crmDatasetId/.test(cb))

  // A person pressing Cancel is not an error.
  check('a cancelled login is handled as a choice, not a failure',
    /'cancelled'/.test(cb))

  // Neither the code nor the token may reach a log.
  check('no token or code is ever logged',
    !/console\.(log|error|warn)\([^)]*(access_token|token|code)/.test(cb))
}

console.log(failures === 0
  ? '\n✅ a realtor clicks Connect, and the connection outlives the afternoon.'
  : `\n❌ ${failures} Meta-OAuth guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
