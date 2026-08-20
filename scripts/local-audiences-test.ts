/**
 * THE LOCAL AUDIENCES — measured before they are trusted, and never selected
 * on origin. Locked.
 *
 * Two rules, and this account has paid real money to learn both.
 *
 * ── ONE: A GATE IS ONLY A GATE IF IT NARROWS ─────────────────────────────
 *
 * Every earlier defence in this product was a rule about how an audience is
 * BUILT, and each was correct and each was bypassed — by a saved spec that
 * predated the fix, by a `mass: true` flag nobody read, by an interest id that
 * meant something else. A campaign advertised 2.7M-3.2M, spent AED 27,873 and
 * returned almost nothing worth calling; the same ad set rebuilt by hand around
 * `Penthouse apartment` came out at 728k.
 *
 * So the check moved to the finished article: ask Meta what the assembled
 * audience actually reaches, and refuse to store one that comes back wider than
 * the ceiling. That is the only check that cannot be routed around, because it
 * asks about the audience that will run rather than about the intent behind it.
 *
 * ── TWO: THIS IS HOUSING, AND ORIGIN IS NOT A TARGETING FIELD ────────────
 *
 * The suggestion arrives constantly and always reasonably — "exclude
 * Expatriates (All)", "exclude Away from hometown", "exclude Away from family",
 * "exclude people who just arrived". They are the same segment in four
 * costumes: Meta guessing that somebody's family lives in another country.
 *
 * Meta ALLOWS it in this market — Housing is only a Special Ad Category in the
 * US and Canada — so this is a decision this product takes rather than a
 * platform rule it passes on. Which is exactly why it has to be a guard: a
 * house rule that lives only in somebody's memory is a rule that lasts until
 * the first bad week.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LOCAL_AUDIENCES, LOCAL_AUDIENCE_KEYS, PROPERTY_SIGNALS,
  GATE_MIN, GATE_MAX, GATE_SIZE_CEILING, REACH_CEILING, REACH_FLOOR,
  BUILD_REFUSALS, REACH_VERDICTS,
  tooWideForGate, chooseGate, reachVerdict, isForbiddenSegment,
} from '../lib/freehold/local-audiences'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const sized = (name: string, upper?: number) => ({ id: `i_${name}`, name, audienceUpper: upper })

console.log('\n── origin is never a targeting field here ──')
{
  // ALL FOUR COSTUMES OF THE SAME SEGMENT. Each was suggested in turn, each
  // with a reasonable-sounding aim, and each is Meta guessing at migration.
  const suggested = [
    'Expatriates (All)',
    'Expats - India',
    'Expats - United Kingdom',
    'Away from hometown',
    'Away from family',
    'Lives abroad',
    'Home country',
    'Nationality',
  ]
  for (const name of suggested) {
    check(`"${name}" is refused`, isForbiddenSegment(name),
      'an origin proxy can enter the targeting')
  }

  // …AND THE ORDINARY VOCABULARY IS UNTOUCHED. A refusal that also blocks
  // legitimate segments gets switched off within a week.
  for (const name of ['Penthouse apartment', 'Real estate investing', 'Luxury real estate', 'Villa', 'Mortgage loan']) {
    check(`"${name}" is not caught by the refusal`, !isForbiddenSegment(name),
      'the refusal is eating real property signals')
  }

  // ENFORCED AT THE DOOR, not in whoever is reviewing the list. Passing one in
  // deliberately must not get it through.
  const db = code('lib/freehold/local-audiences-db.ts')
  check('the resolver drops a forbidden segment even when it was passed in',
    /if \(isForbiddenSegment\(hit\.name\)\) \{ refused\.push/.test(db),
    'an operator-supplied origin segment would reach the spec')
  check('…and says so rather than dropping it silently',
    /refused: string\[\]/.test(db) && /refused\.push\(hit\.name\)/.test(db),
    'a refusal nobody can see is a thing that mysteriously did not happen')

  // The reason is stated honestly: Meta allows it, we do not.
  const pure = readFileSync(join(process.cwd(), 'lib/freehold/local-audiences.ts'), 'utf8')
  check('the module says plainly that Meta permits this and we do not',
    /META ALLOWS IT HERE/.test(pure),
    'the refusal is being passed off as somebody else\'s policy')
}

console.log('\n── no interest id is written from memory ──')
{
  const pure = readFileSync(join(process.cwd(), 'lib/freehold/local-audiences.ts'), 'utf8')
  // AN ID TYPED FROM A SCREEN is how this product once reported two live
  // interests as renamed to "Beauty". The gate is names; Meta resolves them.
  check('the signal list holds names, not numeric ids',
    !/\b600\d{10}\b/.test(pure),
    'a hand-copied interest id is in the file — it either fails or means something else')
  check('every signal is a non-empty name', PROPERTY_SIGNALS.every((n) => n.trim().length > 2))

  const db = code('lib/freehold/local-audiences-db.ts')
  check('resolution is an EXACT name match, never Meta\'s fuzzy first hit',
    /h\.name\.trim\(\)\.toLowerCase\(\) === name\.trim\(\)\.toLowerCase\(\)/.test(db),
    'a near miss would put a different audience behind the name we asked for')
  check('…and an unresolvable name is reported, not guessed at',
    /missing\.push\(name\)/.test(db))
}

console.log('\n── Meta\'s own size band decides what may narrow ──')
{
  check('an oversized interest is refused from the gate',
    tooWideForGate(sized('Property', GATE_SIZE_CEILING + 1)))
  check('…and a specific one is not',
    !tooWideForGate(sized('Penthouse apartment', 5_000_000)))
  // AN ABSENT NUMBER IS NOT EVIDENCE OF A BIG ONE. Refusing everything
  // unmeasured would empty the gate the day Meta changes a response shape.
  check('an unmeasured interest is allowed through', !tooWideForGate(sized('Villa')))

  // THE ORDER IS THE FIX. Drop the oversized ones BEFORE counting, or a gate of
  // three that is really one usable signal ships as though it were narrow.
  const thin = chooseGate([
    sized('Penthouse apartment', 5_000_000),
    sized('Property', GATE_SIZE_CEILING * 3),
    sized('Investment', GATE_SIZE_CEILING * 3),
  ])
  check('a gate padded with mass interests is refused as thin, not shipped',
    thin.refusal === 'thinGate', String(thin.refusal))
  check('…and names what was dropped', thin.dropped.map((d) => d.name).join(',') === 'Property,Investment',
    thin.dropped.map((d) => d.name).join(','))

  const none = chooseGate([sized('Property', GATE_SIZE_CEILING * 3)])
  check('nothing usable at all is refused outright', none.refusal === 'noGate')

  const good = chooseGate([
    sized('Penthouse apartment', 5_000_000),
    sized('Luxury real estate', 9_000_000),
    sized('Real estate investing', 200_000_000),
    sized('Villa', 8_000_000),
  ])
  check('a real gate passes', good.refusal === null)
  check('…and is capped, because every extra OR member only widens it',
    good.gate.length === GATE_MAX, String(good.gate.length))
  check('the floor is below the cap', GATE_MIN < GATE_MAX)
}

console.log('\n── the finished audience is measured, and refused if it is the market ──')
{
  check('the audience that cost AED 27,873 would be refused',
    reachVerdict({ lower: 2_200_000, upper: 2_500_000 }) === 'tooWide')
  check('…and the hand-built one that worked would pass',
    reachVerdict({ lower: 728_200, upper: 856_800 }) === 'good')
  check('an audience too small to absorb a budget is refused too',
    reachVerdict({ lower: 1_000, upper: 5_000 }) === 'tooNarrow')

  // "WE COULD NOT CHECK" AND "IT IS NARROW" ARE DIFFERENT FACTS, and this
  // account has already paid for the difference.
  check('an unmeasurable audience is unknown, never good',
    reachVerdict(null) === 'unknown' && reachVerdict({ lower: 0, upper: 0 }) === 'unknown')

  const db = code('lib/freehold/local-audiences-db.ts')
  check('only a good verdict is ever stored',
    /if \(verdict !== 'good'\) \{[\s\S]{0,220}continue/.test(db),
    'an unmeasured or oversized audience can still be saved')
  check('nothing is stored unless somebody asked for it',
    /if \(input\.dryRun !== false\) \{ built\.push\(base\); continue \}/.test(db),
    'audiences would appear in the list without anybody choosing them')
  check('the same audience is never opened twice',
    /existing\.find\(\(a\) => a\.name === name\)/.test(db),
    'two audiences with one name would split which gets attached')
}

console.log('\n── local means resident, and the set stays small ──')
{
  const db = code('lib/freehold/local-audiences-db.ts')
  // THE HONEST VERSION of "only locals": where somebody LIVES, which Meta
  // actually knows — not where they or their family are from, which it guesses.
  check('the spec targets people who LIVE there', /locationTypes: \['home'\]/.test(db),
    'the audience would include tourists and people passing through')
  check('the gate rides in the narrowing group, not only in the base',
    /narrowing: \[\{ interests: gate\.map\(asEntity\) \}\]/.test(db),
    'the qualifier would be lost by any path that rebuilds the spec from parts')
  check('the standard exclusions are applied', /standardExclusions\(\)/.test(db))
  check('the country list is read from the shared table, not typed again',
    /RESIDENCY_COUNTRIES\.resident/.test(db))

  check('there are exactly three, one per creative language',
    LOCAL_AUDIENCES.length === 3 && LOCAL_AUDIENCE_KEYS.length === 3)
  check('…and their languages are distinct',
    new Set(LOCAL_AUDIENCES.map((a) => a.language)).size === 3)
  check('…and every one is an adult band Meta will deliver',
    LOCAL_AUDIENCES.every((a) => a.ageMin >= 25 && a.ageMax <= 65 && a.ageMin < a.ageMax))
}

console.log('\n── every refusal and verdict has a sentence ──')
{
  const en = code('lib/i18n/dictionaries/lm_audiences.ts')
  for (const v of REACH_VERDICTS) {
    check(`"${v}" is sayable`, new RegExp(`'local\\.verdict\\.${v}'`).test(en),
      'a verdict would render as its own key')
  }
  check('every build refusal is walkable', BUILD_REFUSALS.length === 6)
  check('the refused-on-principle line is on the screen',
    /'local\.refused'/.test(en),
    'a segment refused on principle would vanish without explanation')
  check('…and it names residence rather than origin as the alternative',
    /where people live, never by where they are from/.test(en))
  check('the thresholds are stated, not magic', REACH_CEILING > REACH_FLOOR && REACH_FLOOR > 0)
}

if (failures > 0) {
  console.error(`\n${failures} local-audience rule(s) broken.`)
  console.error('A gate that does not narrow is the market with a label on it.')
  process.exit(1)
}
console.log('\nThree local audiences, measured before they are trusted, chosen by language and behaviour.\n')
