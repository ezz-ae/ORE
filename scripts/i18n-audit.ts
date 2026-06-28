/**
 * i18n audit — catches the i18n defects that tsc and `next build` cannot:
 *   1. Used-but-undefined: every literal t('key') used in app/ + components/
 *      must resolve in the merged English dictionary (else users see raw keys).
 *   2. Locale parity: every dictionary file must define the SAME key set in
 *      en / ar / ru (a key missing in a locale silently falls back to English).
 *
 * Run: `pnpm i18n`  (exits non-zero on any issue, so it's CI-friendly).
 *
 * Notes: only LITERAL t('…') keys are checked for (1) — dynamically built keys
 * (e.g. t(`analytics.stage.${x}`)) are intentionally skipped, since their bases
 * are covered by parity. Both dictionary styles are supported:
 *   `const en: Dict = { … }`  and  `export const x: Record<Locale, Dict> = { en: { … } }`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DICT_DIR = 'lib/i18n/dictionaries'
const CORE = 'lib/i18n/dictionaries.ts'
const SCAN_DIRS = ['app', 'components']

/** Extract the {...} body of a named locale block, supporting both dict styles. */
function localeBody(src: string, loc: 'en' | 'ar' | 'ru'): string | null {
  const patterns = [
    new RegExp(`const ${loc}\\s*:\\s*Dict\\s*=\\s*\\{`),
    new RegExp(`\\n\\s*${loc}\\s*:\\s*\\{`),
  ]
  for (const re of patterns) {
    const m = re.exec(src)
    if (!m) continue
    let i = m.index + m[0].length - 1
    let depth = 0
    const start = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (depth === 0) break }
    }
    return src.slice(start, i)
  }
  return null
}

function keysOf(body: string): Set<string> {
  const out = new Set<string>()
  for (const m of body.matchAll(/['"]([a-zA-Z0-9_.]+)['"]\s*:/g)) out.add(m[1])
  return out
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out) }
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

// ── collect dictionary files ────────────────────────────────────────────────
const dictFiles = [CORE, ...readdirSync(DICT_DIR).filter((f) => f.endsWith('.ts')).map((f) => join(DICT_DIR, f))]

const enMerged = new Set<string>()
let parityIssues = 0

for (const file of dictFiles) {
  const src = readFileSync(file, 'utf8')
  const en = localeBody(src, 'en'), ar = localeBody(src, 'ar'), ru = localeBody(src, 'ru')
  if (!en || !ar || !ru) continue // not a 3-locale dict file (e.g. languages.ts)
  const ek = keysOf(en), ak = keysOf(ar), rk = keysOf(ru)
  ek.forEach((k) => enMerged.add(k))
  const missAr = [...ek].filter((k) => !ak.has(k))
  const missRu = [...ek].filter((k) => !rk.has(k))
  const extraAr = [...ak].filter((k) => !ek.has(k))
  const extraRu = [...rk].filter((k) => !ek.has(k))
  const n = missAr.length + missRu.length + extraAr.length + extraRu.length
  if (n > 0) {
    parityIssues += n
    console.error(`✗ parity ${file}  en=${ek.size} ar=${ak.size} ru=${rk.size}`)
    if (missAr.length) console.error(`    missing in AR: ${missAr.slice(0, 30).join(', ')}`)
    if (missRu.length) console.error(`    missing in RU: ${missRu.slice(0, 30).join(', ')}`)
    if (extraAr.length) console.error(`    AR-only: ${extraAr.slice(0, 30).join(', ')}`)
    if (extraRu.length) console.error(`    RU-only: ${extraRu.slice(0, 30).join(', ')}`)
  }
}

// ── collect literal t('…') keys used in source ───────────────────────────────
const used = new Set<string>()
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/[^a-zA-Z0-9_]t\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) used.add(m[1])
  }
}
const undefinedKeys = [...used].filter((k) => k.includes('.') && !enMerged.has(k)).sort()

console.log(`\ni18n audit — ${dictFiles.length} dict files, ${enMerged.size} EN keys, ${used.size} literal t() keys used`)
if (undefinedKeys.length) {
  console.error(`\n✗ ${undefinedKeys.length} used key(s) missing from the English dictionary (would render raw):`)
  for (const k of undefinedKeys) console.error(`    ${k}`)
}

const ok = parityIssues === 0 && undefinedKeys.length === 0
console.log(ok
  ? '\n✅ i18n audit passed — full EN/AR/RU parity, all used keys resolve.'
  : `\n❌ i18n audit failed — parity issues: ${parityIssues}, undefined used keys: ${undefinedKeys.length}.`)
process.exit(ok ? 0 : 1)
