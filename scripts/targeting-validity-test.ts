/**
 * A FAILED CHECK IS NEVER REPORTED AS A DEAD AUDIENCE — locked.
 *
 * A client screen reported eight core property interests — Property, Real
 * estate investing, Investment, Luxury goods, Apartment renters, Real estate
 * agents, Discount shoppers, Architecture — as retired by Meta, and reported
 * "Job seeking" as renamed to "Beauty".
 *
 * None of it was true. Every one of those interests is live. What had actually
 * happened is that the checker asked the wrong endpoint and had no way to say
 * so:
 *
 *   · it ran `GET /{id}?fields=id,name`, which resolves an id against WHATEVER
 *     object in Meta's graph carries that number. Targeting nodes are not
 *     fetchable that way, so the normal answer is an error — read as "dead" —
 *     and a number that happens to belong to some other object comes back with
 *     that object's name, read as "renamed to Beauty".
 *   · it had two outcomes, valid and not-valid, so every failure OF THE CHECK
 *     was rendered as a failure of the CATALOG, in the most alarming words
 *     available.
 *
 * ── AND THE SAME BLINDNESS WAS SPENDING MONEY ────────────────────────────
 *
 * The launch path shares the problem. `repairTargetingInterests` drops any
 * interest it cannot resolve and used to DELETE a narrowing group left empty —
 * and the narrowing groups are the MUST rules, the real-estate qualifier that
 * rides on every audience this product builds. Losing it does not make an
 * audience slightly broader; it removes the only thing making the audience
 * about property, and the campaign runs BROAD. The sole record was a
 * console.warn.
 *
 * That is the difference between a bad screen and a bad day of leads.
 *
 * Pure — reads source, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENTITY_VERDICTS } from '../lib/meta/client'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const client = code('lib/meta/client.ts')
const route = code('app/api/freehold/ads/audiences/verify-targeting/route.ts')
const page = code('app/freehold-intelligence/integrations/meta/page.tsx')

const between = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from)
  const b = src.indexOf(to)
  if (a < 0 || b < 0 || b <= a) throw new Error(`targeting-validity-test: cannot slice ${from} → ${to}`)
  return src.slice(a, b)
}

console.log('\n── the check asks the targeting vocabulary, not the object graph ──')
{
  const verify = between(client, 'export async function verifyEntityIds', 'export interface CustomAudienceSummary')

  // THE FAULT. A bare GET on a targeting id resolves against any object holding
  // that number — which is how "Job seeking" came back named "Beauty".
  check('the verifier no longer fetches ids as graph objects',
    !/apiFetch<\{ id\?: string; name\?: string \}>\(`\/\$\{id\}`/.test(verify),
    'it is still doing GET /{id}, which reads whatever object owns that number')
  check('…it asks the interest-validity endpoint instead',
    /type', 'adinterestvalid'/.test(verify))
  check('…by id, because the ids are the thing being audited',
    /interest_fbid_list/.test(verify))

  // MATCHING BY NAME IS WHAT MADE A LIVE INTEREST LOOK RENAMED.
  check('answers are matched by id', /const a = byId\.get\(e\.id\)/.test(verify))

  // AND NEVER BY POSITION. This assertion used to REQUIRE the positional
  // fallback `?? answers[i]`, which is how the screen came to report two
  // unrelated interests both renamed to "Beauty": Meta does not always echo
  // the id, and when it does not, every entity fell through to position and
  // was married to somebody else's answer. The guard was pinning the bug.
  check('…and never by position, which manufactures renames',
    !/answers\[i\]/.test(verify),
    'the positional fallback is back — a short or reordered answer array will invent renames')
  check('…and a batch with no ids to match on is unchecked, not aligned by guesswork',
    /if \(byId\.size === 0\)/.test(verify))

  // A PANEL THAT ONLY EVER SAYS "UNKNOWN" IS A PANEL NOBODY READS, and then
  // the one time an interest really is retired, nobody looks. When the batch
  // cannot be matched, each id is asked for alone — one request, one possible
  // answer, so the pairing holds by construction rather than by trusting Meta
  // to have preserved an order.
  check('an unmatchable batch is retried one id at a time',
    /await ask\(\[e\.id\]\)/.test(verify),
    'the whole catalog reports unknown whenever Meta omits the ids')
  check('…and each single answer is the only one its request could have returned',
    /one\[0\] \?\? null/.test(verify))
}

console.log('\n── an unknown is never counted as a live one ──')
{
  // THE CONTRADICTION THAT SHIPPED. The footer subtracted only `renamed`, so
  // the screen printed "Meta could not be asked about 7 of these" and directly
  // beneath it "the other 7 are live and valid" — about the same seven. An
  // unknown reported as good is this panel's original fault wearing a
  // different hat.
  check('the footer excludes the unchecked from the good count',
    /checked - targetingResult\.renamed - \(targetingResult\.unknown \?\? 0\)/.test(page),
    'unchecked entries are still being counted as live and valid')
  check('…and says nothing at all rather than "0 are live"',
    /- \(targetingResult\.unknown \?\? 0\) > 0 &&/.test(page))
}

console.log('\n── "could not check" is its own answer ──')
{
  const verify = between(client, 'export async function verifyEntityIds', 'export interface CustomAudienceSummary')

  check('there is a verdict for not knowing',
    (ENTITY_VERDICTS as readonly string[]).includes('unknown'), ENTITY_VERDICTS.join(','))
  check('every verdict is distinct and walkable',
    new Set(ENTITY_VERDICTS).size === ENTITY_VERDICTS.length && ENTITY_VERDICTS.length === 4)

  // A REQUEST THAT NEVER WORKED must not indict the catalog.
  check('an unreachable Meta marks everything unknown, not dead',
    /return unchecked\('Meta could not be reached'\)/.test(verify))
  // Pins the RULE — a refusal from Meta marks everything unknown — not the
  // line that implements it. The literal `if (json.error) return unchecked(`
  // broke when the request moved into a reusable `ask()`, though who gets
  // called dead did not change.
  check('…and so does an error from Meta',
    /if \(json\.error\) return \{ error:/.test(verify)
      && /if \('error' in batch\) return unchecked\(batch\.error\)/.test(verify))
  check('…and so does a missing answer for one id',
    /'Meta did not answer for this id'/.test(verify))

  // THE COUNTS MUST COME FROM THE VERDICT. Deriving "dead" from `!valid` is
  // exactly how not-checked became retired.
  check('the route counts dead from the verdict, not from !valid',
    /r\.verdict === 'dead'/.test(route) && !/filter\(\(r\) => !r\.valid\)/.test(route))
  check('…and reports the unchecked ones separately', /unknown: unknown\.length/.test(route))

  // …and the screen must show them differently.
  check('the screen lists dead entries by verdict', /r\.verdict === 'dead'/.test(page))
  check('…renamed ones by verdict', /r\.verdict === 'renamed'/.test(page))
  check('…and says plainly when it simply could not ask',
    /pintmeta\.targeting\.unknownHint/.test(page))
}

console.log('\n── a MUST group is never silently emptied ──')
{
  const repair = between(client, 'export async function repairTargetingInterests', 'const PLACEMENT_TARGETING')

  // THE ONE THAT COSTS MONEY. The narrowing groups carry the real-estate
  // qualifier. An audience that loses it is not narrower — it is broad, and a
  // broad property campaign buys a day of rubbish leads.
  check('a group that repair would empty is kept exactly as it was',
    /if \(left === 0\) \{[\s\S]*?return g/.test(repair),
    'an unresolvable qualifier can still be deleted')
  check('…and the old filter that deleted empty groups is gone',
    !/\.filter\(\(g\) => \(g\.interests\?\.length \?\? 0\) \+ \(g\.behaviors\?\.length \?\? 0\) > 0\)/.test(repair),
    'empty groups are still being filtered out silently')
  check('…and it is reported under its own name, not mixed into "dropped"',
    /keptDespiteFailure/.test(repair))

  // A console.warn is how this ran for a day without anybody knowing.
  check('the launch escalates an unvalidatable qualifier to an error',
    /TARGETING QUALIFIER COULD NOT BE VALIDATED/.test(client))
}

console.log('\n── the resolver is keyed on the question, not the answer ──')
{
  const resolve = between(client, 'async function resolveInterestNames', 'export async function validateInterests')

  // THE SILENT DROPPER. The map was keyed on Meta's spelling and looked up with
  // ours; any difference in wording or casing read as "Meta does not recognise
  // this" and removed a live interest from a real launch.
  check('the map is keyed on the name we asked for',
    /names\.forEach\(\(asked, i\)/.test(resolve),
    'it is still keyed only on the name Meta returned')
  check('…with Meta\'s own spelling accepted as well, not instead',
    /also accept a match|byQuery\.set\(String\(d\.name\)/.test(resolve)
      || /for \(const d of answers\)/.test(resolve))
}

if (failures > 0) {
  console.error(`\n${failures} targeting rule(s) broken.`)
  console.error('A check that cannot say "I do not know" reports its own failure as yours.')
  process.exit(1)
}
console.log('\nThe targeting check reports what Meta said, and says so when Meta said nothing.\n')
