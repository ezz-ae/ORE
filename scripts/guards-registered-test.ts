/**
 * EVERY SUITE ON DISK ACTUALLY RUNS — locked.
 *
 * `pnpm guards` is one long `&&` chain in package.json, and a suite is only in
 * the gauntlet if somebody remembered to add it to that line. Three suites
 * written this week were not on it:
 *
 *   points-test          the money a broker earns back
 *   click-identity-test  the handle that lets the CRM talk back
 *   creative-decay-test  whether a picture has stopped working
 *
 * They were added, and a concurrent session's edit to package.json wrote the
 * line back without them. Nothing failed. `pnpm guards` printed green and
 * three suites sat on disk doing nothing — which is worse than not having
 * written them, because the green was believed.
 *
 * This is the lockfile failure wearing a different coat: four gates reporting
 * clean while the thing that would have caught the fault was structurally
 * unable to see it. The answer is the same one — a gate for the thing the
 * other gates cannot check.
 *
 * So: the file system is the source of truth. A `*-test.ts` in scripts/ is a
 * guard suite, and if it is not on the guards line this fails and names it.
 *
 * Pure — reads two files, no network. Runs in `pnpm guards`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), { encoding: 'utf8' })) as {
  scripts?: Record<string, string>
}
const guards = pkg.scripts?.guards ?? ''

console.log('\n── the gauntlet and the suites on disk ──')
{
  check('there is a guards script at all', guards.length > 0, String(guards.length))

  const onDisk = readdirSync(join(root, 'scripts'))
    .filter((f) => f.endsWith('-test.ts'))
    .map((f) => f.slice(0, -3))
    .sort()
  check('there are suites to run', onDisk.length > 10, String(onDisk.length))

  const registered = new Set(
    [...guards.matchAll(/scripts\/([A-Za-z0-9-]+-test)\.ts/g)].map((m) => m[1]),
  )

  // THE CHECK THIS FILE EXISTS FOR. A suite nobody runs is worse than one
  // nobody wrote, because the green is believed.
  const missing = onDisk.filter((s) => !registered.has(s))
  check('every suite on disk is on the guards line', missing.length === 0,
    `not running: ${missing.join(', ')}`)

  // …and the other direction. A line that names a file which no longer exists
  // fails the whole gauntlet with a module-not-found, which reads as a broken
  // repository rather than as a stale script entry.
  const diskSet = new Set(onDisk)
  const ghosts = [...registered].filter((s) => !diskSet.has(s))
  check('every suite on the guards line still exists', ghosts.length === 0,
    `named but absent: ${ghosts.join(', ')}`)

  // A suite listed twice runs twice — harmless, but it is always a sign that
  // two people edited the line and one of them did not read it.
  const named = [...guards.matchAll(/scripts\/([A-Za-z0-9-]+-test)\.ts/g)].map((m) => m[1])
  const dupes = named.filter((s, i) => named.indexOf(s) !== i)
  check('no suite is listed twice', dupes.length === 0, [...new Set(dupes)].join(', '))

  console.log(`\n  ${onDisk.length} suites on disk, ${registered.size} on the guards line.`)
}

if (failures > 0) {
  console.error(`\n${failures} registration rule(s) broken.`)
  console.error('Add the suite to the "guards" script in package.json.')
  process.exit(1)
}
console.log('\nEvery guard suite that exists is a guard suite that runs.\n')
