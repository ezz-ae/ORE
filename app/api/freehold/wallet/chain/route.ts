/**
 * PROVE THE HISTORY HAS NOT BEEN EDITED.
 *
 * Recomputes every block from its own row and reports the first one that does
 * not add up. That is a different question from "do the balances agree", which
 * the conservation audit already answers and which edited rows would also
 * satisfy — a balance re-derived from tampered rows agrees with the tampered
 * rows.
 *
 * ── OPEN TO EVERY ROLE, DELIBERATELY ─────────────────────────────────────
 *
 * A proof only management can run is not a proof, it is a reassurance. A broker
 * whose Cash lives in this ledger is exactly the person entitled to check that
 * nobody rewrote it, so the verdict — length, head, and where it breaks — is
 * readable by anyone with an account.
 *
 * The BLOCKS are not returned. Every row names two wallets and an amount, and
 * handing one broker the company's entire payment history to verify a number
 * is not a trade anybody asked for. The verdict is the answer; `?full=1`, for
 * management only, returns the rows so somebody can recompute it themselves.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MGMT_ROLES } from '@/lib/freehold/apps'
import { verifyLedgerChain, readChain } from '@/lib/freehold/wallet-db'
import { CHAIN_FORMAT, GENESIS_HASH } from '@/lib/freehold/ledger-chain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  try {
    const verdict = await verifyLedgerChain()

    // The rows, for somebody who wants to do the arithmetic themselves rather
    // than believe ours. Management only — see the header.
    const wantsFull = req.nextUrl.searchParams.get('full') === '1'
    const mayHaveFull = (MGMT_ROLES as readonly string[]).includes(auth.user.role)
    const blocks = wantsFull && mayHaveFull ? await readChain() : undefined

    return NextResponse.json({
      verdict,
      // Published so a client can recompute independently: without the format
      // string and the genesis, an outside verifier would have to guess what
      // was hashed, and a guess that happens to be wrong looks like tampering.
      format: CHAIN_FORMAT,
      genesis: GENESIS_HASH,
      ...(blocks ? { blocks } : {}),
      ...(wantsFull && !mayHaveFull ? { blocksWithheld: true } : {}),
    })
  } catch (err) {
    // NEVER a green verdict on a failed read. "Could not check" and "checked
    // and it is sound" are opposite answers and a screen must not confuse them.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not verify the chain' },
      { status: 500 },
    )
  }
}
