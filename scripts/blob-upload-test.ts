/**
 * A client upload route answers two callers, and only one of them is a person.
 *
 *   'blob.generate-client-token' — the BROWSER asking to start an upload. It
 *                                  carries the session cookie and MUST be
 *                                  authenticated: an open token endpoint lets
 *                                  anyone write to our storage.
 *   'blob.upload-completed'      — VERCEL BLOB reporting the bytes landed. A
 *                                  server-to-server call with no cookie and no
 *                                  way to get one.
 *
 * Gating both on a session answers the completion callback with 401 forever.
 * The transfer itself succeeds — bytes go browser → Blob and never touch the
 * function — so nothing looks broken except the one thing the person is
 * watching: the flow never closes and the screen sits at "uploading" with
 * nothing left to upload.
 *
 * `handleUpload` verifies Blob's own signature on that callback, which is a
 * stronger credential than a cookie and the only one it can carry.
 *
 * Pure source assertions — no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Every route that signs client-upload tokens. */
const ROUTES = [
  'app/api/freehold/drive/upload-video/route.ts',
  'app/api/freehold/drive/upload-brochure/route.ts',
  'app/api/freehold/cloud/upload/route.ts',
]

console.log('\n── the completion callback is never answered with a 401 ──')
for (const f of ROUTES) {
  const src = readFileSync(f, 'utf8')
  const post = src.slice(src.indexOf('export async function POST'))
  const name = f.split('/').slice(-2)[0]

  check(`${name}: the caller is identified before anything is refused`,
    post.indexOf('body.type ===') < post.indexOf('requireSession'),
    'requireSession runs before the request type is known — the Blob callback gets a 401')

  check(`${name}: only the browser's token request is gated`,
    /const fromBrowser = body\.type === 'blob\.generate-client-token'/.test(post),
    'the two callers are not distinguished')

  check(`${name}: …and it IS gated — an open token endpoint is writable by anyone`,
    /if \(fromBrowser\) \{[\s\S]{0,120}requireSession\(\)/.test(post),
    'the browser path can mint upload tokens without a session')

  check(`${name}: the token still records who asked for it`,
    /tokenPayload: JSON\.stringify\(\{ email: uploader \}\)/.test(post),
    'the upload is no longer attributable')
}

console.log('\n── the preflight still needs a session ──')
for (const f of ROUTES) {
  const src = readFileSync(f, 'utf8')
  const get = src.includes('export async function GET') ? src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST')) : ''
  if (!get) { ok(`${f.split('/').slice(-2)[0]}: no GET to protect`); continue }
  check(`${f.split('/').slice(-2)[0]}: the capability check is authenticated`,
    /requireSession\(\)/.test(get), 'anyone can probe our storage configuration')
}

if (failures > 0) {
  console.error(`\n${failures} upload rule(s) broken.`)
  process.exit(1)
}
console.log('\nUploads can finish.\n')
