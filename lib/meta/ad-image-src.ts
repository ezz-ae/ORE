/**
 * What to put in an <img> for an ad's picture.
 *
 * An ad image has two handles and neither one alone is enough:
 *
 *   • the URL — instant, but often unusable. A blob: URL made from the file
 *     just picked lives only as long as the page that made it, so a reloaded
 *     wizard (or the same draft resumed on a phone) holds a dead link. And
 *     Meta's own adimages CDN URL is not reliably loadable in a plain <img>
 *     from our origin at all — that is the blank frame under a picture that
 *     uploaded perfectly well.
 *
 *   • the hash — durable, and the thing that actually launches, but not
 *     something a browser can render on its own.
 *
 * /api/meta/adimages/<hash> closes the gap: the server fetches the bytes from
 * Meta, where no browser hotlink rule applies, and serves them from our own
 * origin. So a local preview wins while you work (no round trip), and the hash
 * carries it everywhere else.
 *
 * Pure + client-safe — no Meta or DB imports.
 */
export function adImageSrc(url?: string | null, hash?: string | null): string {
  const u = (url ?? '').trim()
  const h = (hash ?? '').trim()
  // A blob:/data: URL is the picture already in this browser's hands.
  const isLocal = u.startsWith('blob:') || u.startsWith('data:')
  if (u && (isLocal || !h)) return u
  if (h) return `/api/meta/adimages/${encodeURIComponent(h)}`
  return u
}
