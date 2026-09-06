/**
 * ONE CHANGE RE-SKINS THE WHOLE PRODUCT — locked.
 *
 * "we need a perfect way to get any hardcoded brand name all in a one change
 *  in trial — no hard coding color or brand."
 *
 * The mechanism already existed and was quietly opted out of. `--color-gold`
 * is injected at runtime from the brand accent (app/layout.tsx), so every
 * `bg-gold`, `text-gold` and `border-gold/30` reskins for free. But 87 places
 * had written the literal `#D4AF37` instead — as `text-[#D4AF37]`, as an SVG
 * `stroke`, as a colour map value — and every one of those stays gold forever
 * however many env vars a trial sets.
 *
 * A re-skin that is 90% correct is worse than none: the tenant sees their own
 * colour beside somebody else's on the same screen, and concludes the product
 * is somebody else's with their name pasted on.
 *
 * ── WHERE THE HEX IS STILL ALLOWED, AND ONLY THERE ───────────────────────
 *
 * Exactly three files define what the colour is when nobody has chosen one.
 * That is not duplication — it is the default, and a default has to be
 * written down somewhere. Everywhere else, the literal is a bug.
 *
 * ── AND THE NAME IS THE SAME PROBLEM ─────────────────────────────────────
 *
 * `BRAND.company` drives every visible mention of the company. A hardcoded
 * "Freehold" in a page title or a button is a sentence a tenant cannot change,
 * and it is the single most visible way a white-labelled product gives itself
 * away.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ROOT = process.cwd()
const SEARCH_DIRS = ['app', 'components', 'lib', 'src']

/**
 * The only files allowed to contain the literal accent.
 *
 * Each one answers "what colour when nobody has chosen?" — brand.ts for the
 * product, whitelabel/config.ts for a white-label instance, tenancy/store.ts
 * for a tenant with no accent set. Adding a fourth means adding a fourth
 * answer to the same question.
 */
const ACCENT_DEFAULT_FILES = new Set([
  'lib/freehold/brand.ts',
  'lib/whitelabel/config.ts',
  'lib/tenancy/store.ts',
])

/**
 * Files allowed to carry the literal company name.
 *
 * brand.ts holds the default. The rest are places where the string is not a
 * label at all — a database table prefix, an import path, a historical note in
 * a comment — and renaming those would rename infrastructure rather than a
 * brand.
 */
const NAME_ALLOWED_PREFIX = ['lib/freehold/', 'src/features/freehold-intelligence/']

/**
 * ── "FREEHOLD" IS TWO DIFFERENT WORDS IN THIS CODEBASE ───────────────────
 *
 * One is the company. The other is the OWNERSHIP CATEGORY — freehold versus
 * leasehold — which is a fact about a property in this market and has nothing
 * to do with who is selling it.
 *
 *     {area.freehold ? "Freehold" : "Leasehold"}
 *     "Freehold title, no rental income tax"
 *     features: ["Freehold area recommendations", …]
 *
 * The client's name is a pun on the legal term, which is why a find-and-
 * replace is not just unhelpful here, it is destructive: a re-skinned tenant
 * would ship a filter reading "Acme vs Leasehold" and a property page
 * claiming "Acme title".
 *
 * So these files are exempt for a stated reason, not because they were hard.
 * The test is: would a tenant with another name want this word changed? If the
 * sentence is about ownership, no.
 */
const OWNERSHIP_TERM_FILES = new Set([
  'app/areas/[slug]/page.tsx',            // Freehold / Leasehold on the area card
  'app/projects/[slug]/page.tsx',         // ownership row + badge
  'app/properties/[id]/page.tsx',         // ownership badge
  'components/area-card.tsx',             // ownership chip
  'components/property-filters.tsx',      // "freehold only" filter
  'app/services/page.tsx',                // "Freehold area recommendations"
  'app/tools/page.tsx',                   // rebrand-aware public name + ownership copy
  'app/about/page.tsx',                   // rebrand-aware legal entity
  'app/page.tsx',                         // "Freehold shortlist under AED 2M" — ownership
  'app/api/google/ads/generate/route.ts', // ad copy about freehold title
  'app/freehold-intelligence/lead-machine/google/campaigns/new/page.tsx', // same
])

const ACCENT = /#[Dd]4[Aa][Ff]37/
/** The company name as a WORD, not as part of an identifier: `freehold_site_leads`,
 *  `@/lib/freehold/...` and `freehold-intelligence` are structure, not branding. */
const NAME_WORD = /(?<![\w/_-])Freehold(?![\w/_-])/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full)
  }
  return out
}

const files = SEARCH_DIRS
  .filter((d) => { try { return statSync(join(ROOT, d)).isDirectory() } catch { return false } })
  .flatMap((d) => walk(join(ROOT, d)))
  .map((f) => relative(ROOT, f))

/** Source with comments removed — a rule must not be broken by the sentence
 *  explaining it, and every one of these files documents its own colour. */
const code = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

console.log('\n── the accent lives in one place ──')
{
  const offenders = files
    .filter((f) => !ACCENT_DEFAULT_FILES.has(f) && f !== 'app/globals.css')
    .filter((f) => ACCENT.test(code(f)))

  check('no file hardcodes the accent colour',
    offenders.length === 0,
    offenders.slice(0, 8).join(', ') + (offenders.length > 8 ? ` (+${offenders.length - 8})` : ''))

  // The defaults must still exist — a rule that passes because the colour was
  // deleted entirely is not the rule anybody wanted.
  for (const f of ACCENT_DEFAULT_FILES) {
    check(`${f} still defines the default`, ACCENT.test(readFileSync(join(ROOT, f), 'utf8')))
  }

  // THE MECHANISM ITSELF. Everything above is pointless if the token is not
  // actually driven by the brand at runtime.
  const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8')
  check('the token is injected from the brand accent at runtime',
    /--color-gold:\$\{[^}]*accent\}/.test(layout), 'the re-skin never reaches the page')
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
  check('…and bg-gold / text-gold resolve to it',
    /@theme\s*\{[^}]*--color-gold:/.test(css))
}

console.log('\n── and so does the name ──')
{
  const offenders = files
    .filter((f) => !NAME_ALLOWED_PREFIX.some((p) => f.startsWith(p)))
    .filter((f) => !OWNERSHIP_TERM_FILES.has(f))
    .filter((f) => NAME_WORD.test(code(f)))

  check('no file hardcodes the company name',
    offenders.length === 0,
    offenders.slice(0, 8).join(', ') + (offenders.length > 8 ? ` (+${offenders.length - 8})` : ''))

  const brand = readFileSync(join(ROOT, 'lib/freehold/brand.ts'), 'utf8')
  check('the name comes from the environment, with a default',
    /NEXT_PUBLIC_BRAND_COMPANY/.test(brand) && /company:/.test(brand))

  // The exemption list must stay honest: a file that no longer mentions the
  // word should not keep a permanent pass, or the list becomes a place to
  // hide a real hardcode behind an old reason.
  const stale = [...OWNERSHIP_TERM_FILES].filter((f) => {
    try { return !NAME_WORD.test(code(f)) } catch { return true }
  })
  check('no file is exempt for a reason that no longer applies',
    stale.length === 0, stale.join(', '))

  // AND THE LEGAL TERM MUST SURVIVE. A "fix" that renamed ownership to the
  // tenant's brand would ship "Acme vs Leasehold" — worse than the problem.
  const areas = readFileSync(join(ROOT, 'app/areas/[slug]/page.tsx'), 'utf8')
  check('freehold-versus-leasehold is still the ownership word, not the brand',
    areas.includes('Freehold') && areas.includes('Leasehold'))
}

console.log('\n── one env var changes each of them ──')
{
  const brand = readFileSync(join(ROOT, 'lib/freehold/brand.ts'), 'utf8')
  for (const key of ['NEXT_PUBLIC_BRAND_COMPANY', 'NEXT_PUBLIC_BRAND_ACCENT', 'NEXT_PUBLIC_BRAND_DOMAIN']) {
    check(`${key} is read`, brand.includes(key))
  }
}

console.log(failures === 0
  ? '\n✅ one accent, one name, one place each — a trial re-skins completely.'
  : `\n❌ ${failures} brand-purity rule(s) broken`)
process.exit(failures === 0 ? 0 : 1)
