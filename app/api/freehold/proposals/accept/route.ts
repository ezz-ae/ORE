/**
 * ACCEPT PERFORMS THE CHANGE. It does not record an intention to.
 *
 * A proposal with an Accept button that files a note is worse than a sentence
 * that explained the problem: the sentence left the reader knowing they still
 * had work to do, while the button leaves them believing it is handled. The
 * budget keeps draining behind a green tick, and the next proposal is
 * disbelieved for good reason.
 *
 * So this route does the work against live Meta, confirms it by reading the ad
 * set back, and answers with what META now holds — never with what we asked
 * for. `dropPlacement` refuses to write blind, refuses to leave an ad set with
 * no placements (Meta reads that as permission to choose, which means Audience
 * Network), and fails loudly if the qualifier, the exclusions, the languages
 * or the Advantage opt-out moved along with the placement.
 *
 * Every outcome is written to the authority log — including the failures,
 * because "we tried this on your account and it did not work" is exactly the
 * thing a person needs to be able to find later.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { dropPlacement } from '@/lib/meta/client'
import { logAuthority } from '@/lib/freehold/authority-db'
import { PROPOSAL_KINDS, type ProposalKind } from '@/lib/freehold/proposal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES = [...MANAGEMENT_ROLES, 'marketing'] as const

export async function POST(req: NextRequest) {
  const auth = await requireSession([...ROLES])
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string; adSetId?: string; placement?: string
  }
  const kind = String(body.kind ?? '') as ProposalKind
  const adSetId = String(body.adSetId ?? '').trim()
  const placement = String(body.placement ?? '').trim()

  if (!(PROPOSAL_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: 'Unknown proposal kind' }, { status: 400 })
  }
  // `notYet` has no Accept by construction. Reaching here means a client sent
  // one anyway, and honouring it would move money on evidence the product has
  // already said it cannot stand behind.
  if (kind === 'notYet') {
    return NextResponse.json(
      { error: 'This proposal has no Accept — the evidence does not support acting yet.' },
      { status: 409 },
    )
  }
  if (!adSetId || !placement) {
    return NextResponse.json({ error: 'adSetId and placement are required' }, { status: 400 })
  }

  const outcome = await dropPlacement(adSetId, placement)

  await logAuthority({
    actorEmail: auth.user.email,
    actorRole: auth.user.role,
    action: 'campaign.edit',
    targetType: 'campaign',
    targetId: adSetId,
    decision: {
      allowed: outcome.ok,
      reason: outcome.ok ? 'management' : 'insufficient_role',
    },
    detail: outcome.ok
      ? `dropped ${placement}; ad set now runs ${outcome.placements.join(', ')}`
      : `FAILED to drop ${placement}: ${outcome.reason} — ${outcome.detail}`,
  })

  if (!outcome.ok) {
    // 502 rather than 500: the request was fine, the platform did not do it.
    // The state the caller stores is `failed`, never `done`.
    return NextResponse.json({
      ok: false, state: 'failed', reason: outcome.reason, detail: outcome.detail,
    }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    state: 'done',
    // Read back from Meta after the write. This is what the ad set holds now,
    // not an echo of the request.
    placements: outcome.placements,
  })
}
