/**
 * WHAT EACH AD WAS MADE OF — the record without which nothing can be learned.
 *
 * The lab ranks recipes by what they did. Meta will tell us what an ad DID —
 * spend, impressions, leads, per ad id — and it will never tell us what the ad
 * WAS: which layout family, which argument, which project it was for. Meta
 * stores a picture and some words; the recipe behind them lives only in the
 * moment somebody pressed Create.
 *
 * So it is written down at that moment, or the loop has no memory and the lab
 * is a gallery again. This table is the join: ad id → the recipe, so an ad's
 * result can be attributed to a decision rather than to a picture.
 *
 * TWO RULES:
 *
 *  1. RECORDING NEVER FAILS AN AD. A creative that reached Meta is a real ad
 *     spending real money; losing the note about how it was made is a lost
 *     lesson, not a lost ad. Every write here is best-effort and silent.
 *
 *  2. THE RECIPE IS WRITTEN, NOT INFERRED. Guessing a layout back from a
 *     rendered JPEG is a computer-vision problem with a wrong answer rate, and
 *     a wrong answer here teaches the lab the opposite of the truth. An ad with
 *     no recorded recipe is EXCLUDED from the ranking rather than guessed at —
 *     which is why the lab's history is honest from the day this ships and
 *     silent about everything launched before it.
 */
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import { LAB_LAYOUTS, LAB_ANGLES, type LabLayout, type RecipeResult } from '@/lib/freehold/creative-lab'
import type { CreativeAngle } from '@/lib/meta/types'

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_creative_recipes (
      ad_id        text PRIMARY KEY,
      project_slug text NOT NULL,
      layout       text NOT NULL,
      angle        text NOT NULL,
      palette      int  NOT NULL DEFAULT 0,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_creative_recipes_project ON freehold_creative_recipes (project_slug)`)
}
const ensureOnce = () => dbEnsureOnce('freehold_creative_recipes', ensure)

export interface RecordedRecipe {
  adId: string
  projectSlug: string
  layout: LabLayout
  angle: CreativeAngle
  palette: number
}

/** Note how an ad was made. Best-effort by design — see rule 1. */
export async function recordRecipe(r: RecordedRecipe): Promise<void> {
  if (!r.adId || !r.projectSlug) return
  // A layout or angle outside the walkable lists would poison the ranking with
  // a bucket nothing else can ever join, so it is refused rather than stored.
  if (!LAB_LAYOUTS.includes(r.layout) || !LAB_ANGLES.includes(r.angle)) return
  try {
    await ensureOnce()
    await query(
      `INSERT INTO freehold_creative_recipes (ad_id, project_slug, layout, angle, palette)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ad_id) DO NOTHING`,
      [r.adId, r.projectSlug, r.layout, r.angle, Math.max(0, Math.round(r.palette) || 0)],
    )
  } catch { /* a lost lesson, never a lost ad — see rule 1 */ }
}

/** Every recipe recorded for a project, newest first. */
export async function listRecipes(projectSlug: string): Promise<RecordedRecipe[]> {
  if (!projectSlug) return []
  try {
    await ensureOnce()
    const rows = await query<{ ad_id: string; project_slug: string; layout: string; angle: string; palette: number }>(
      `SELECT ad_id, project_slug, layout, angle, palette
         FROM freehold_creative_recipes
        WHERE project_slug = $1
        ORDER BY created_at DESC
        LIMIT 300`,
      [projectSlug],
    )
    return rows
      .filter((r) => LAB_LAYOUTS.includes(r.layout as LabLayout) && LAB_ANGLES.includes(r.angle as CreativeAngle))
      .map((r) => ({
        adId: r.ad_id, projectSlug: r.project_slug,
        layout: r.layout as LabLayout, angle: r.angle as CreativeAngle,
        palette: Number(r.palette) || 0,
      }))
  } catch { return [] }
}

/**
 * Join a project's recipes to what those ads actually did.
 *
 * An ad with a recipe and NO results is kept with zeros: it ran and delivered
 * nothing measurable yet, which the lab reads as undecided — the honest state.
 * A result with no recipe is DROPPED, because attributing it would mean
 * guessing what the ad was made of, and a wrong guess teaches the opposite of
 * the truth (rule 2).
 */
export function joinRecipeResults(
  recipes: RecordedRecipe[],
  results: Array<{ adId: string; impressions?: number; clicks?: number; leads?: number; spendAED?: number }>,
): RecipeResult[] {
  const byAd = new Map(results.map((r) => [String(r.adId), r]))
  return recipes.map((r) => {
    const m = byAd.get(r.adId)
    return {
      adId: r.adId,
      layout: r.layout,
      angle: r.angle,
      impressions: Number(m?.impressions) || 0,
      clicks: Number(m?.clicks) || 0,
      leads: Number(m?.leads) || 0,
      spendAed: Number(m?.spendAED) || 0,
    }
  })
}
