import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'

// Lightweight fixed-window rate limiter backed by Postgres, so the limit is
// shared across all serverless instances (an in-memory counter would reset per
// instance and per cold start, giving almost no protection). Used to cap the
// expensive AI endpoints — a runaway client or a stuck retry loop can't drain
// credits without tripping this.
//
// Fail-open: if the limiter itself errors (e.g. transient DB blip) the request
// is allowed. A limiter must never take the product down.

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_rate_limits (
      bucket_key   text PRIMARY KEY,
      count        integer NOT NULL DEFAULT 0,
      window_start timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('freehold_site_rate_limits', ensure)

/**
 * Count one hit against `key` and report whether it's within `limit` per
 * `windowSec`. The window resets atomically once it has elapsed, so this is a
 * fixed-window counter — simple, correct under concurrency (single UPSERT), and
 * good enough to stop abuse without the machinery of a sliding log.
 */
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const { limit, windowSec } = opts
  try {
    await ensureOnce()
    const rows = await query<{ count: number; window_start: string }>(
      `INSERT INTO freehold_site_rate_limits (bucket_key, count, window_start)
       VALUES ($1, 1, now())
       ON CONFLICT (bucket_key) DO UPDATE SET
         count = CASE
           WHEN freehold_site_rate_limits.window_start < now() - make_interval(secs => $2)
           THEN 1 ELSE freehold_site_rate_limits.count + 1 END,
         window_start = CASE
           WHEN freehold_site_rate_limits.window_start < now() - make_interval(secs => $2)
           THEN now() ELSE freehold_site_rate_limits.window_start END
       RETURNING count, window_start::text`,
      [key, windowSec],
    )
    const count = Number(rows[0]?.count ?? 1)
    const startedAt = rows[0]?.window_start ? new Date(rows[0].window_start).getTime() : Date.now()
    const elapsed = Math.max(0, (Date.now() - startedAt) / 1000)
    const retryAfterSec = Math.max(1, Math.ceil(windowSec - elapsed))
    return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec }
  } catch {
    // Fail open — never block a real user because the limiter had a hiccup.
    return { ok: true, remaining: limit, retryAfterSec: 0 }
  }
}
