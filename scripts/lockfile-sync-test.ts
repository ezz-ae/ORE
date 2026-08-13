/**
 * THE LOCKFILE AND package.json AGREE — locked.
 *
 * A dependency was removed from package.json and pnpm-lock.yaml was left
 * alone. Every gate in `pnpm guards` passed, typecheck passed, and
 * `rm -rf .next && pnpm build` passed — because a local build reuses
 * node_modules and never reinstalls.
 *
 * Vercel does not. It runs `pnpm install --frozen-lockfile`, which refuses when
 * the lockfile does not match package.json. Every deployment after that commit
 * failed in about five seconds, on BOTH projects, production and preview — and
 * nothing in the local gauntlet could see it. The site went stale while four
 * gates reported green.
 *
 * So this is the gate for the thing the other gates structurally cannot check:
 * the gauntlet runs against installed packages, and this runs against the two
 * files that decide what gets installed.
 *
 * Pure — reads two files, no install, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), { encoding: 'utf8' })) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const lock = readFileSync(join(root, 'pnpm-lock.yaml'), { encoding: 'utf8' })

/**
 * The root importer block — what pnpm believes this package.json asks for.
 *
 * Read as a slice rather than parsed as YAML: the `packages:` section further
 * down lists every TRANSITIVE dependency too, so a name found there proves
 * nothing about whether we declared it. `postgres` was still in `packages:`
 * as a sub-dependency of something else the whole time.
 */
const importersStart = lock.indexOf('importers:')
const packagesStart = lock.indexOf('\npackages:')
const importers = importersStart >= 0 && packagesStart > importersStart
  ? lock.slice(importersStart, packagesStart)
  : ''

console.log('\n── the two files that decide what gets installed ──')
{
  check('the lockfile has a readable importers section', importers.length > 0, String(importers.length))

  const declared = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]
  check('package.json declares dependencies at all', declared.length > 10, String(declared.length))

  // Every name in package.json must appear in the importer block.
  // Names containing @ or / are single-quoted in the lockfile; plain ones are
  // not. Missing that is how the first version of this guard flagged fifty
  // packages that were present — a guard that cries wolf gets deleted.
  const missing = declared.filter((name) => !new RegExp(`\\n\\s{4,}'?${escape(name)}'?:`).test(importers))
  check('every dependency in package.json is in the lockfile',
    missing.length === 0, missing.join(', '))

  // …and every name in the importer block must be in package.json. THIS is the
  // direction that broke: a package REMOVED from package.json and left in the
  // lockfile, which --frozen-lockfile rejects.
  const declaredSet = new Set(declared)
  const inLock = [...importers.matchAll(/\n {4,}'?([@a-zA-Z0-9][^\s':]*)'?:\n\s+specifier:/g)].map((m) => m[1])
  const stale = inLock.filter((name) => !declaredSet.has(name))
  check('every dependency in the lockfile is still in package.json',
    stale.length === 0, `stale in lockfile: ${stale.join(', ')}`)

  check('the lockfile lists roughly what package.json does',
    inLock.length > 0 && Math.abs(inLock.length - declared.length) <= 2,
    `lock=${inLock.length} pkg=${declared.length}`)
}

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

if (failures > 0) {
  console.error(`\n${failures} lockfile rule(s) broken.`)
  console.error('Run `pnpm install --lockfile-only` and commit pnpm-lock.yaml.')
  process.exit(1)
}
console.log('\npackage.json and pnpm-lock.yaml agree — the deploy will install.\n')
