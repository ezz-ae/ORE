/**
 * WHAT THE CHAT IS TOLD TO DO NEXT — derived, never typed once and forgotten.
 *
 * ── THE FAULT THIS ANSWERS TO ────────────────────────────────────────────
 *
 * Every Expert conversation opens by loading a live snapshot of the platform
 * (gatherSystemContext in app/api/freehold/expert/chat/route.ts) and putting
 * it in the model's context. Each slice of that snapshot carries a
 * `nextActions` list. Those lists were STRING LITERALS in execute-tool.ts,
 * written when the platform was a template and never touched again:
 *
 *     integration-summary → ['Connect HubSpot CRM',
 *                            'Grant Meta/Google Ads access',
 *                            'Configure tracking and WhatsApp']
 *     server-summary      → ['Review open tasks',
 *                            'Resolve custom-domain DNS',
 *                            'Connect CRM and ad accounts']
 *
 * Every one of those is false of this account, and the HubSpot line is false
 * in the most embarrassing direction: /api/health reports hubspot connected,
 * so the context was telling the model to go and connect something that was
 * already connected, in the same object as the row saying so. Meta has been
 * connected since 1 Aug 2026 — the audiences it wrote on 3 Sep prove the
 * account was reachable and permissioned. The domain resolved months ago.
 *
 * None of that mattered, because the literals were injected on EVERY turn,
 * ahead of anything the user asked, and the master prompt's first rule is
 * "GROUND EVERYTHING — use the live context". The model obeyed. Asked what to
 * do next, it answered "connect HubSpot" to a business whose HubSpot was
 * connected, whose Meta was connected, and which had 878 leads in the CRM.
 * Asked about integrations, it repeated a fixed list instead of reading the
 * live one sitting beside it in the same object.
 *
 * That is the whole complaint about the chat: not that the model is weak, but
 * that a stale fact was mounted in front of the live one, and the better the
 * model's grounding discipline, the more faithfully it repeated the stale one.
 * A fabrication guard cannot catch it either — the sentence IS in the context,
 * so it reads as grounded.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 * A nextAction naming a specific integration, a specific number or a specific
 * piece of infrastructure must be COMPUTED FROM THE RESULT it accompanies. If
 * the result says nothing is wrong, the list is EMPTY — an empty list is a
 * true statement and a stale suggestion is not. Nothing here may name a vendor
 * that is not in the data passed in.
 *
 * Pure — no env, no network, no clock. Runs in `pnpm guards`.
 */

/** The shape of an integration as the summary tool reports it. */
export interface IntegrationLike {
  id?: string
  name?: string
  category?: string
  status?: string
  description?: string | null
}

/** The states that mean "this is not working right now". Mirrors the
 *  integration registry: anything that is not `connected` needs attention,
 *  and `partial` needs it just as much as `disconnected` — a half-configured
 *  integration is the one that fails silently. */
const NOT_WORKING = new Set(['needs_access', 'not_connected', 'disconnected', 'blocked', 'partial', 'error'])

/** How many suggestions is useful before it becomes a backlog dump. Three:
 *  enough to sequence, few enough that the model leads with the first one
 *  instead of listing everything it was handed. */
export const MAX_NEXT_ACTIONS = 3

/**
 * What to do about the integrations, read off the integrations.
 *
 * The name in the sentence is the name in the row, and only rows in a broken
 * state produce a sentence. So a working integration can never be told to
 * connect itself, and a vendor with no row can never be named at all — there
 * is nothing to name it from. Both properties are what the old literal
 * violated, in both directions at once.
 */
export function integrationActions(integrations: readonly IntegrationLike[]): string[] {
  const broken = integrations.filter((i) => NOT_WORKING.has(String(i.status ?? '').toLowerCase()))
  // NOTHING TO DO IS AN ANSWER. The old list said "Connect HubSpot CRM" to an
  // account whose HubSpot was already connected; an empty array says nothing,
  // which is the accurate thing to say.
  if (broken.length === 0) return []
  return broken.slice(0, MAX_NEXT_ACTIONS).map((i) => {
    const name = String(i.name ?? i.id ?? '').trim() || 'An integration'
    const note = String(i.description ?? '').trim()
    // The note comes from the same live row, so it cannot contradict the name.
    return note ? `${name}: ${note}` : `Connect ${name}`
  })
}

/**
 * What to do about the server, read off the server summary.
 *
 * Only open tasks survive from the old list, and only when there are some.
 * "Resolve custom-domain DNS" and "Connect CRM and ad accounts" were dropped
 * outright: this tool does not read DNS or connections, so it was answering a
 * question it had not asked, in a slice the model treats as authoritative.
 * Integration state has its own tool, and that one now reads live.
 */
export function serverActions(summary: {
  privateServer?: { openTasks?: number; milestonesDone?: number; milestonesTotal?: number } | null
} | null | undefined): string[] {
  const s = summary?.privateServer
  if (!s) return []
  const out: string[] = []
  const open = Number(s.openTasks ?? 0)
  if (Number.isFinite(open) && open > 0) {
    out.push(`Review ${open} open task${open === 1 ? '' : 's'}`)
  }
  const done = Number(s.milestonesDone ?? 0)
  const total = Number(s.milestonesTotal ?? 0)
  if (Number.isFinite(done) && Number.isFinite(total) && total > 0 && done < total) {
    out.push(`Close the remaining ${total - done} of ${total} milestones`)
  }
  return out.slice(0, MAX_NEXT_ACTIONS)
}

/**
 * Where a slice of context actually came from.
 *
 * The old evidence strings said "Read integration connection registry or mock
 * fallback" and "Queried freehold_private_dashboard when available" — an OR
 * and a WHEN, handed to a model that is required to cite its evidence. Told
 * its own evidence might be mock, the honest thing for it to do is distrust
 * everything in the slice; the dishonest thing is to cite the sentence
 * anyway. Neither is a good option, and neither was necessary: the code knows
 * which branch it took.
 */
export function sourceEvidence(source: 'registry' | 'runtime' | 'empty', what: string): string[] {
  switch (source) {
    case 'registry': return [`Read ${what} from the stored registry`]
    case 'runtime': return [`Derived ${what} from live runtime status`]
    // NOT "no data, assume the worst" and NOT a silent empty — the model has
    // to be able to tell "nothing is wrong" from "nothing was read".
    case 'empty': return [`No ${what} was available to read`]
  }
}

/**
 * What to do about the Lead Machine, read off its own counters.
 *
 * The old pair — "Prioritize listings with active landing pages" and "Resolve
 * blockers before ad launch" — is textbook advice with no subject. Rule 7 of
 * the master prompt calls exactly that shape a failure ("NEVER BE A FAQ"), and
 * the context was handing it to the model as a finding.
 */
export function leadMachineActions(summary: {
  missingLandingPages?: number
  pendingLandingReviews?: number
  blockedByAccess?: number
  adsReady?: number
} | null | undefined): string[] {
  if (!summary) return []
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const out: string[] = []
  if (n(summary.missingLandingPages) > 0) {
    out.push(`Build landing pages for ${n(summary.missingLandingPages)} listing(s) that have none`)
  }
  if (n(summary.pendingLandingReviews) > 0) {
    out.push(`Publish ${n(summary.pendingLandingReviews)} landing page(s) still in draft`)
  }
  if (n(summary.blockedByAccess) > 0) {
    out.push(`Clear ${n(summary.blockedByAccess)} access blocker(s) before launching ads`)
  }
  // Everything ready and nothing blocked → say nothing rather than invent work.
  return out.slice(0, MAX_NEXT_ACTIONS)
}
