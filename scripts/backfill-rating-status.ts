/**
 * MOVE THE LEADS THAT WERE ALREADY RATED — from a terminal.
 *
 * The work is in `applyRatingStatuses` (lib/freehold/crm-write.ts), beside the
 * live write, and the confirm-gated chat tool `crm_apply_rating_statuses` runs
 * the SAME function. This script is the second door, for someone who would
 * rather type than ask.
 *
 * Two doors, one rule. A maintenance job that re-expresses its logic in SQL
 * disagrees with the live path the first time either changes, and the
 * disagreement shows up as leads in states nothing else can produce.
 *
 *   pnpm backfill:rating-status            # prints what it would do
 *   pnpm backfill:rating-status -- --apply # writes
 *
 * Exits 2 — distinct from failure — when no database is configured. That
 * distinction is load-bearing for the reason db-smoke.ts states: `query()`
 * returns [] with no database, so a script printing "0 leads moved" would be
 * reporting a success it had not achieved.
 */
import { applyRatingStatuses } from '../lib/freehold/crm-write'

const APPLY = process.argv.includes('--apply')

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL — refusing to report on a database that is not there.')
    return 2
  }

  // Runs as the account owner: this is a maintenance job with no session
  // behind it, and the function refuses a broker outright.
  const r = await applyRatingStatuses(
    { email: 'system', role: 'ceo', brokerId: null },
    { apply: APPLY },
  )
  if (!r.ok) {
    console.error(r.error)
    return 1
  }

  const { rated, moves, total, moved, failed } = r.plan
  console.log(`\n${rated} rated lead(s) on file.`)
  console.log(`${total} would move; ${rated - total} stay where they are.\n`)
  for (const m of moves) {
    console.log(`  ${String(m.count).padStart(6)}  ${m.from} \u2192 ${m.to}`)
  }
  if (!APPLY) {
    console.log('\nDry run — nothing was written. Re-run with --apply to make these moves.')
    return 0
  }
  console.log(`\n${moved ?? 0} moved${failed ? `, ${failed} failed` : ''}.`)
  return (failed ?? 0) > 0 ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => { console.error(err); process.exit(1) })
