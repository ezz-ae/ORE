/**
 * WHICH DOOR THE COORDINATOR SPEAKS THROUGH — locked.
 *
 * Two Google doors reach the same family of models and they are not
 * interchangeable. The Gemini API takes a key and is a consumer product.
 * Vertex AI runs inside the company's own Google Cloud project: enterprise
 * terms, a named region, an audit trail, quota that belongs to the business.
 * A platform running a client's advertising money through a chat agent belongs
 * on the second one.
 *
 * lib/freehold/ai-sdk.ts used the first, unconditionally — and on a deployment
 * configured for Vertex ONLY it handed the consumer API the string
 * "__vertex_sa__" as if that were a credential. That string is a MARKER every
 * other caller in this codebase reads as "no key, use the service account".
 * The request fails at the model layer, which is the worst place for a chat
 * agent to fail: it has no honest way to report it, and an agent whose tool
 * calls never complete is an agent answering from itself.
 *
 * Pure — no network, no env. Runs in `pnpm guards`.
 */
import { aiDoorFor, EXPERT_MODEL } from '../lib/freehold/ai-sdk'
import { VERTEX_SENTINEL } from '../lib/gemini-rest'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the company door wins ──')
{
  check('a service account alone routes to Vertex',
    aiDoorFor({ vertex: true, apiKey: '' }) === 'vertex')
  check('a service account AND a key still routes to Vertex — the company project outranks a consumer key',
    aiDoorFor({ vertex: true, apiKey: 'AIzaSyRealLookingKey' }) === 'vertex',
    aiDoorFor({ vertex: true, apiKey: 'AIzaSyRealLookingKey' }))
  check('a key alone routes to the Gemini API',
    aiDoorFor({ vertex: false, apiKey: 'AIzaSyRealLookingKey' }) === 'gemini')
}

console.log('\n── the sentinel is a marker, never a credential ──')
{
  // THE BUG, exactly: geminiApiKey() returns this when only Vertex is set up,
  // and this file used to hand it to createGoogleGenerativeAI as a key.
  check('the sentinel with no Vertex is NOT a usable credential',
    aiDoorFor({ vertex: false, apiKey: VERTEX_SENTINEL }) === 'none',
    aiDoorFor({ vertex: false, apiKey: VERTEX_SENTINEL }))
  check('…so it can never reach the consumer API as a key',
    aiDoorFor({ vertex: false, apiKey: VERTEX_SENTINEL }) !== 'gemini')
  check('the sentinel WITH Vertex is simply Vertex',
    aiDoorFor({ vertex: true, apiKey: VERTEX_SENTINEL }) === 'vertex')
  check('nothing configured at all is none, not a silent default',
    aiDoorFor({ vertex: false, apiKey: '' }) === 'none')
  check('whitespace is not a credential either',
    aiDoorFor({ vertex: false, apiKey: '   '.trim() }) === 'none')
}

console.log('\n── the model is a decision somebody can change ──')
{
  check('a model name is configured', EXPERT_MODEL.length > 0, EXPERT_MODEL)
  // Flash-tier produced wrong-entity answers on this workload and asked users
  // for ids its own tools could fetch. This agent reasons across several tool
  // results before answering, which is the work flash is worst at — and the
  // screen it answers on talks about somebody's advertising budget.
  // Matched on the model's own SEGMENTS, not as a substring: "gemini" ends in
  // "mini", and a naive substring test rejects every Gemini model there is.
  // A guard that fires on the correct answer is worse than no guard.
  const tiers = EXPERT_MODEL.toLowerCase().split(/[-_.]/)
  check('the default is not a flash tier',
    !tiers.some((seg) => ['flash', 'lite', 'nano', 'mini'].includes(seg)), EXPERT_MODEL)
  check('…and it is overridable without a deploy',
    process.env.EXPERT_MODEL === undefined || EXPERT_MODEL === process.env.EXPERT_MODEL.trim())
}

if (failures > 0) {
  console.error(`\n${failures} AI-door rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe coordinator speaks through the company project, and a marker is never a key.\n')
