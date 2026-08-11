/**
 * THE LAB, FOR ONE PROJECT — uniform, history, next.
 *
 * Everything on this response is derived from two real sources and nothing
 * else: the project's OWN ROW (which decides what its ads may look like and
 * may claim) and what its ads actually did (which decides what to make next).
 * There is no model in this path and no default that fills a missing fact —
 * a project with no price gets a uniform that cannot make a price ad, and the
 * screen says why.
 *
 * WHY THE HISTORY CAN BE EMPTY ON A PROJECT THAT HAS RUN ADS. The recipe
 * behind an ad is written at the moment it is created (creative-recipes), and
 * nothing recorded it before that existed. Guessing a layout back from a
 * rendered JPEG would teach the lab the opposite of the truth as often as not,
 * so ads launched before the recipe table are absent rather than invented.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { getAccountAdInsights, isMetaConfigured } from '@/lib/meta/client'
import { listRecipes, joinRecipeResults } from '@/lib/freehold/creative-recipes'
import { uniformFor, rankRecipes, nextRecipe, type ProjectFacts } from '@/lib/freehold/creative-lab'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const slug = String(req.nextUrl.searchParams.get('project') ?? '').trim()
  if (!slug) return NextResponse.json({ error: 'Pick a project.' }, { status: 400 })

  const p = await getInventoryPropertyBySlug(slug).catch(() => null)
  if (!p) return NextResponse.json({ error: 'That project is not in the inventory.' }, { status: 404 })

  const facts: ProjectFacts = {
    slug,
    name: p.name,
    startingPriceAED: p.startingPriceAED,
    paymentPlan: p.paymentPlan,
    handoverYear: p.handoverYear,
    // `roi` is the inventory's rental-yield column. Named once here rather
    // than at three call sites, so the lab's rule reads as the rule it is.
    rentalYieldPct: typeof p.roi === 'number' ? p.roi : null,
    // The inventory row does not carry golden-visa eligibility, and a price
    // threshold is NOT the same thing — eligibility is a legal status with
    // conditions this row cannot see. Absent means the angle is withheld,
    // which is the honest outcome until a real field exists.
    goldenVisaEligible: null,
    area: p.area,
    bedrooms: p.bedrooms,
  }

  const uniform = uniformFor(facts)
  const recipes = await listRecipes(slug)

  // No Meta connection is not an error here: the uniform is real without it,
  // and the history is simply unmeasured.
  const insights = (await isMetaConfigured()) ? await getAccountAdInsights() : new Map()
  const history = joinRecipeResults(
    recipes,
    recipes.map((r) => ({ adId: r.adId, ...(insights.get(r.adId) ?? {}) })),
  )
  const ranked = rankRecipes(history)

  return NextResponse.json({
    project: { slug, name: p.name, heroImage: p.heroImage, area: p.area },
    facts,
    uniform,
    ranked,
    next: nextRecipe(uniform, ranked),
    // How many ads carry a recipe at all — the screen distinguishes "this
    // project has run nothing" from "it ran ads before the lab could watch".
    recorded: recipes.length,
  })
}
