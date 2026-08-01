/**
 * Build-time invariant guards — run in CI after typecheck/i18n (`pnpm guards`).
 *
 * Two invariants, both born from real incidents:
 *
 * 1. COPY RULES. An external documentation pass once described an invented
 *    architecture — "Evidence Stack", "reliance boundary", fabricated metrics
 *    like "36,841" — that never existed in this repo. Reviewers who grep for a
 *    claimed term and find nothing stop trusting the 90% that is real. Those
 *    terms are at zero occurrences today; this guard keeps them at zero, and
 *    keeps the "outcome-trained" claim quarantined to docs/archive (where it
 *    exists only as a warning AGAINST making the claim) until real closed-loop
 *    data exists.
 *
 * 2. AUTH MATRIX. proxy.ts is fail-closed: every /api/* route is private
 *    unless allowlisted, and allowlisted machine endpoints must verify their
 *    OWN secret in-handler (docs/route-auth-matrix.md). The runtime enforces
 *    the private half; nothing enforced the allowlist half — a cron route
 *    added without its CRON_SECRET check, or an allowlist entry pointing at a
 *    deleted route, would ship silently. This guard makes both drift-proof.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = process.cwd()
let failures = 0
const fail = (msg: string) => { failures++; console.error(`✗ ${msg}`) }
const ok = (msg: string) => console.log(`✓ ${msg}`)

// ── 1. Copy rules ─────────────────────────────────────────────────────────────

// Terms from the invented architecture — must never enter the repo.
const FORBIDDEN_TERMS = [
  'Evidence Stack',
  'reliance boundary',
  'L1_CANONICAL',
  'judgment engine',
  'canonical truth',
  'source registry',
  'audit ID',
  '36,841',
  '1,946 assets',
]
// NOT banned: bare "L1"/"L2" as designations — greppable only with false
// positives (cache levels, list markers); the compound forms above cover the
// real risk.
// Allowed ONLY under docs/archive (as historical warnings), never in live copy.
const QUARANTINED_TERMS = ['outcome-trained']

const SCAN_DIRS = ['app', 'lib', 'components', 'src', 'docs']
const SCAN_EXT = new Set(['.ts', '.tsx', '.md', '.mdx'])

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      yield* walk(p)
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      yield p
    }
  }
}

function runCopyRules(): void {
  let hits = 0
  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const file of walk(abs)) {
      const rel = path.relative(ROOT, file)
      const inArchive = rel.startsWith(path.join('docs', 'archive'))
      // This guard file legitimately names the terms it forbids.
      if (rel === path.join('scripts', 'guards.ts')) continue
      const src = fs.readFileSync(file, 'utf-8')
      const lower = src.toLowerCase()
      for (const term of FORBIDDEN_TERMS) {
        if (lower.includes(term.toLowerCase())) { hits++; fail(`copy-rules: forbidden term "${term}" in ${rel}`) }
      }
      if (!inArchive) {
        for (const term of QUARANTINED_TERMS) {
          if (lower.includes(term.toLowerCase())) { hits++; fail(`copy-rules: "${term}" outside docs/archive in ${rel} — the claim stays gated until real closed-loop data exists`) }
        }
      }
    }
  }
  if (hits === 0) ok('copy-rules: no forbidden or unquarantined claim terms')
}

// The guard itself lives in scripts/, outside SCAN_DIRS — noted for clarity.

// ── 2. Auth matrix ────────────────────────────────────────────────────────────

/** Public-allowlist entries that MUST self-defend, and the evidence required
 *  in their handler source. Paths are route files relative to repo root. */
const SELF_DEFENDING: Array<{ route: string; mustMatch: RegExp; why: string }> = [
  { route: 'app/api/auth/bootstrap-admin/route.ts', mustMatch: /SETUP_KEY|setup[-_ ]?key/i, why: 'setup-key gate' },
  { route: 'app/api/whatsapp/webhook/route.ts', mustMatch: /X-Hub-Signature|hub\.verify_token|createHmac/i, why: 'Meta HMAC signature' },
  { route: 'app/api/meta/webhook/route.ts', mustMatch: /X-Hub-Signature|createHmac/i, why: 'Meta HMAC signature' },
  { route: 'app/api/mcp/route.ts', mustMatch: /authorization|bearer/i, why: 'Bearer token gate' },
]

function routeFileFor(apiPath: string): string | null {
  // /api/foo/bar → app/api/foo/bar/route.ts (exact entries only)
  const p = path.join(ROOT, 'app', apiPath.replace(/^\//, ''), 'route.ts')
  return fs.existsSync(p) ? p : null
}

function runAuthMatrix(): void {
  const proxySrc = fs.readFileSync(path.join(ROOT, 'proxy.ts'), 'utf-8')

  // Extract the two allowlists straight from the enforcing source — the doc
  // describes them, but proxy.ts IS the gate, so proxy.ts is what we audit.
  const exact = [...proxySrc.matchAll(/^\s*"(\/api\/[^"]+)",/gm)].map((m) => m[1])
  if (exact.length < 5) { fail('auth-matrix: could not parse PUBLIC allowlist from proxy.ts — guard needs updating'); return }

  // (a) Every EXACT allowlist entry must resolve to a real route file. A
  //     dangling entry is documented attack surface for a route that will be
  //     recreated by someone who doesn't know it's public.
  for (const p of exact) {
    if (p.endsWith('/')) continue
    if (!routeFileFor(p)) fail(`auth-matrix: allowlisted route ${p} has no route.ts — remove it from proxy.ts or restore the handler`)
  }

  // (b) Every cron handler must check CRON_SECRET — /api/cron/ is allowlisted
  //     as a PREFIX, so any new file under it is public the moment it exists.
  const cronDir = path.join(ROOT, 'app', 'api', 'cron')
  if (fs.existsSync(cronDir)) {
    for (const entry of fs.readdirSync(cronDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const rf = path.join(cronDir, entry.name, 'route.ts')
      if (!fs.existsSync(rf)) continue
      const src = fs.readFileSync(rf, 'utf-8')
      if (!/CRON_SECRET/.test(src)) fail(`auth-matrix: app/api/cron/${entry.name}/route.ts does not check CRON_SECRET — it is publicly invokable`)
    }
    ok('auth-matrix: every cron handler checks CRON_SECRET')
  }

  // (c) Sensitive allowlisted endpoints carry their own gate.
  for (const { route, mustMatch, why } of SELF_DEFENDING) {
    const abs = path.join(ROOT, route)
    if (!fs.existsSync(abs)) continue // absence handled by (a) when allowlisted
    const src = fs.readFileSync(abs, 'utf-8')
    if (!mustMatch.test(src)) fail(`auth-matrix: ${route} is public but shows no ${why}`)
  }
  ok('auth-matrix: allowlist entries resolve and self-defending routes carry their gates')
}

runCopyRules()
runAuthMatrix()

if (failures > 0) {
  console.error(`\n${failures} guard failure(s).`)
  process.exit(1)
}
console.log('\nAll guards passed.')
