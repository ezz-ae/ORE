/**
 * A SOURCE FILE IS TEXT, AND STAYS REVIEWABLE — locked.
 *
 * `app/api/freehold/team/route.ts` carried a single NUL byte, inside a string
 * literal, for months. It cost two different things and neither announced
 * itself:
 *
 *   · POSTGRES TEXT CANNOT CONTAIN NUL. The literal was a sentinel id passed
 *     into `WHERE id = ANY($1::text[])`, so a team leader with no team
 *     assigned got a 500 from the exact branch written to stop them seeing
 *     the whole company. The safe path was the broken one.
 *
 *   · GIT TREATS ANY FILE CONTAINING NUL AS BINARY. That route showed as
 *     `Bin 5939 -> 6820 bytes` in every diff it ever appeared in. No
 *     line-level review, no `git log -p`, no `git log -S`, no blame that
 *     means anything. A file nobody can diff is a file nobody can review,
 *     and that is how one stray byte survived in code people read weekly.
 *
 * The second is the reason this suite exists rather than a one-line fix. A
 * control byte in source is not a style question — it removes the tooling
 * everything else in this repo depends on, silently, on one file at a time.
 *
 * WHAT IS ALLOWED: tab, newline, carriage return, and everything from 0x20 up.
 * Nothing else. Emoji and Arabic and Russian are fine — they are text; this is
 * about CONTROL bytes, not about being English.
 *
 * Pure — reads the working tree, no network. Runs in `pnpm guards`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const ROOTS = ['app', 'lib', 'components', 'scripts', 'src']
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.md']
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])

/** Tab, LF, CR are text. Everything else below 0x20, and 0x7f, is not. */
const isControl = (b: number): boolean =>
  (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f

function walk(dir: string, out: string[]): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    let s: ReturnType<typeof statSync>
    try { s = statSync(full) } catch { continue }
    if (s.isDirectory()) walk(full, out)
    else if (EXTS.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(join(process.cwd(), r), []))

console.log('\n── no source file contains a control byte ──')
{
  check('there are source files to scan at all', files.length > 100, String(files.length))

  const offenders: string[] = []
  for (const f of files) {
    let buf: Buffer
    try { buf = readFileSync(f) } catch { continue }
    for (let i = 0; i < buf.length; i++) {
      if (isControl(buf[i])) {
        // Report the LINE, so the finding is actionable rather than an offset
        // somebody has to go and count to.
        const line = buf.subarray(0, i).toString('utf8').split('\n').length
        offenders.push(`${relative(process.cwd(), f)}:${line} — 0x${buf[i].toString(16).padStart(2, '0')}`)
        break
      }
    }
  }
  check('every source file is plain text', offenders.length === 0,
    offenders.slice(0, 10).join('\n           ') +
    (offenders.length > 10 ? `\n           …and ${offenders.length - 10} more` : '') +
    '\n           a control byte makes git treat the file as BINARY — no diff, no review')

  // THE ONE THAT COST MONEY-ADJACENT BEHAVIOUR, pinned by name so the exact
  // regression cannot come back quietly.
  const team = readFileSync(join(process.cwd(), 'app/api/freehold/team/route.ts'))
  check('the team roster route is text', !team.includes(0x00))
  check('…and its empty-team sentinel is plain ASCII',
    /const NO_TEAM = '__no_team__'/.test(team.toString('utf8')),
    'the sentinel is inline again — a NUL in it would 500 every teamless leader')
  check('…and nothing passes a raw literal into the scope any more',
    !/scopeIds = \['[^']*\\?[u0]/.test(team.toString('utf8')))
}

if (failures > 0) {
  console.error(`\n${failures} source-byte rule(s) broken.`)
  console.error('A file git calls binary is a file nobody can review.')
  process.exit(1)
}
console.log('\nEvery source file is text a person and a diff can both read.\n')
