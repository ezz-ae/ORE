/**
 * THE NAMES THIS WORKSPACE ACTUALLY HOLDS.
 *
 * The entity guard in answer-grounding.ts can only refuse a name it can check.
 * It read its list of real campaigns from `context.campaigns` — which the
 * CALLING PAGE puts there. The ads screens send it; the inventory screen,
 * the CRM, the finance screens and everything else send nothing.
 *
 * The guard is written to stay silent when it has no list, and that rule is
 * right: an accusation with nothing behind it is its own kind of lie. But the
 * consequence was that on most of the product the check returned "nothing to
 * compare against" and the log recorded a clean answer. It was not clean. From
 * the inventory screen, unchecked:
 *
 *   "Saad Aldbsaoy shows high intent… a specific property, Volta Towers…
 *    Originated from 'Volta_Towers_DXB_Leads_2024' campaign… Assigned to
 *    Aya Al-Masri."
 *
 * None of those four things exist. The guard had been in place for weeks.
 *
 * So the lists are gathered HERE, on the server, on every turn — never from
 * whatever the open page happened to pass down. A guard whose reach depends on
 * which screen the user is standing on is not a guard.
 *
 * ── EVERY LIST IS ALL-OR-NOTHING ─────────────────────────────────────────
 *
 * A read that fails returns an EMPTY list, and an empty list means that kind is
 * not checked at all this turn. It must never return a partial one. A truncated
 * list of projects would make the guard call a real property invented and tell
 * the user their own inventory does not exist, which is a worse failure than
 * the one it is here to catch — so the project read has no LIMIT, and the
 * campaign read takes Meta's full page or nothing.
 */
import { query } from '@/lib/db'
import { listCampaigns } from '@/lib/meta/client'
import type { EntityKind } from '@/lib/freehold/answer-grounding'

export type KnownNames = Partial<Record<EntityKind, string[]>>

const names = (rows: Array<{ name?: unknown }>): string[] =>
  rows.map((r) => String(r?.name ?? '').trim()).filter(Boolean)

/**
 * Every project in the inventory, by name.
 *
 * No LIMIT, deliberately — see the all-or-nothing rule above. This is the same
 * table `getInventoryPropertiesFromDB` reads, asked for one column.
 */
async function projectNames(): Promise<string[]> {
  try {
    return names(await query<{ name: string }>(
      `SELECT name FROM freehold_site_projects WHERE name IS NOT NULL AND name <> ''`,
    ))
  } catch { return [] }
}

/** Everyone with an account, by name — the people an answer can assign work to. */
async function personNames(): Promise<string[]> {
  try {
    return names(await query<{ name: string }>(
      `SELECT name FROM freehold_site_users WHERE name IS NOT NULL AND name <> ''`,
    ))
  } catch { return [] }
}

/**
 * Campaign names from the ad account.
 *
 * Meta is the only source — there is no local campaigns table — so this is a
 * network call on the chat path. It is worth one: the campaign half of the
 * transcript above went unchecked for exactly the want of this list, and a
 * failure returns [] and simply leaves campaigns unchecked, as before.
 */
async function campaignNames(): Promise<string[]> {
  try {
    return names(await listCampaigns())
  } catch { return [] }
}

/**
 * The lists, gathered in parallel and never allowed to fail the turn.
 *
 * `fromContext` is merged in rather than replaced: a page that already knows
 * its campaigns (the ads screens pass them down) contributes them, and a name
 * present in either source counts as real. Union, never intersection — the
 * cost of missing a real name is a false accusation.
 */
export async function gatherKnownNames(fromContext: KnownNames = {}): Promise<KnownNames> {
  const [projects, people, campaigns] = await Promise.all([
    projectNames(), personNames(), campaignNames(),
  ])
  const merge = (a: readonly string[] = [], b: readonly string[] = []) =>
    [...new Set([...a, ...b].map((s) => s.trim()).filter(Boolean))]
  return {
    campaign: merge(fromContext.campaign, campaigns),
    project: merge(fromContext.project, projects),
    person: merge(fromContext.person, people),
  }
}
