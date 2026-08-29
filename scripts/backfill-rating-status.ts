/**
 * MOVE THE LEADS THAT WERE ALREADY RATED.
 *
 * `statusForRating` makes a rating advance a lead — but only from the moment
 * it shipped. Every lead rated before that is still sitting where it was, so
 * an account whose team has rated for months sees the new rule do nothing at
 * all and reasonably concludes it does not work. The follow-up queue, the team
 * metrics and the CRM funnel keep reading 'new'.
 *
 * This walks the history once and applies the SAME rule to it. The rule is
 * imported, never re-expressed in SQL: a backfill that encodes its own copy of
 * the logic is a backfill that disagrees with the live path the first time
 * either changes, and the disagreement shows up as leads in states nothing
 * else can produce.
 *
 * ── IT IS A DECISION, NOT A DEPLOY STEP ──────────────────────────────────
 *
 * Restatusing thousands of leads changes what every queue and every report
 * says about a business, and doing that automatically on deploy is how a team
 * arrives one morning to a CRM that reorganised itself overnight. So it is a
 * script somebody runs, it prints what it WOULD do and changes nothing unless
 * told `--apply`, and every move it makes writes an activity row saying the
 * status was derived from the rating rather than set by a person.
 *
 *   pnpm backfill:rating-status            # dry run — prints, writes nothing
 *   pnpm backfill:rating-status -- --apply # writes
 *
 * Exits 2 — distinct from failure — when no database is configured, so a
 * caller can tell "skipped" from "broken". See scripts/db-smoke.ts for why
 * that distinction is load-bearing here: `query()` returns [] with no database,
 * and a script that printed "0 leads moved" would be reporting success it had
 * not achieved.
 */
import { randomUUID } from 'node:crypto'
import { query } from '../lib/db'
import { statusForRating } from '../lib/freehold/rating-status'

const APPLY = process.argv.includes('--apply')

type Row = { id: string; status: string | null; value_rating: number | null; name: string | null }

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL — refusing to report on a database that is not there.')
    return 2
  }

  let rows: Row[]
  try {
    rows = await query<Row>(
      `SELECT id, status, value_rating, name
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND value_rating IS NOT NULL`,
    )
  } catch (err) {
    console.error('Could not read the leads:', err instanceof Error ? err.message : err)
    return 1
  }

  // The rule decides. Anything it returns null for is left exactly as it is —
  // low ratings, the middle band, lost leads, and everything already at or
  // past qualified.
  const moves = rows
    .map((r) => ({ row: r, to: statusForRating(r.value_rating, r.status) }))
    .filter((m): m is { row: Row; to: NonNullable<ReturnType<typeof statusForRating>> } => m.to !== null)

  console.log(`\n${rows.length} rated lead(s) on file.`)
  console.log(`${moves.length} would move; ${rows.length - moves.length} stay where they are.\n`)

  if (moves.length === 0) {
    console.log('Nothing to do.')
    return 0
  }

  const byFrom = new Map<string, number>()
  for (const m of moves) {
    const k = `${m.row.status ?? '(none)'} → ${m.to}`
    byFrom.set(k, (byFrom.get(k) ?? 0) + 1)
  }
  for (const [k, n] of [...byFrom.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${k}`)
  }

  if (!APPLY) {
    console.log('\nDry run — nothing was written. Re-run with --apply to make these moves.')
    return 0
  }

  let moved = 0
  let failed = 0
  for (const m of moves) {
    try {
      // Guarded on the status we READ, so a lead somebody moved while this was
      // running is left alone rather than dragged back.
      const res = await query<{ id: string }>(
        `UPDATE freehold_site_leads
            SET status = $2, updated_at = now()
          WHERE id = $1 AND status IS NOT DISTINCT FROM $3
        RETURNING id`,
        [m.row.id, m.to, m.row.status],
      )
      if (res.length === 0) continue
      moved++
      // The timeline says what happened and that no person did it. A status
      // that changed with no entry beside it is a lead that moved by itself.
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, 'stage', $3, 'system')`,
        [
          randomUUID(),
          m.row.id,
          `Stage changed to ${m.to} — derived from the existing rating of ${m.row.value_rating}/10 (backfill)`,
        ],
      ).catch(() => { /* the move is the point; a missing note is visible as a gap */ })
    } catch (err) {
      failed++
      console.error(`  ! ${m.row.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\n${moved} moved${failed ? `, ${failed} failed` : ''}.`)
  return failed > 0 ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => { console.error(err); process.exit(1) })
