/**
 * THE BANK, OVER HTTP. Management only.
 *
 * GET  — what is held and what backs it, the parcels, the withdraw record, who
 *        is sitting on money, and the log.
 * POST — mint, clear or reject a deposit, sign a parcel out, burn one, and run
 *        the one-off re-denomination.
 *
 * Deliberately a SEPARATE ROUTE from /api/freehold/wallet rather than a branch
 * inside it. "May this person mint money" is then answered by which URL they
 * reached, not by an `if` in the middle of a handler that a later refactor
 * could invert without anybody noticing.
 *
 * There is no endpoint that sets a balance. A balance you can assign is the
 * thing this whole ledger replaced.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MGMT_ROLES } from '@/lib/freehold/apps'
import {
  personId, ensureBankWallets, walletFor, listLots, readBacking, listWithdrawals,
  spendAnalysis, bankLog, mintCash, clearDeposit, rejectDeposit, moveFromBank, burnCash,
} from '@/lib/freehold/bank-db'
import { listWallets, auditConservation } from '@/lib/freehold/wallet-db'
import { redenominateToCash, redenominationStatus } from '@/lib/freehold/credits-db'
import { isValidAmount } from '@/lib/freehold/wallet'
import { bankImbalance, type Actor } from '@/lib/freehold/bank'
import { MAX_CREDIT_AMOUNT } from '@/lib/freehold/credits-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  try {
    await ensureBankWallets()
    const [wallets, lots, back, withdrawals, use, log, audit, redenom] = await Promise.all([
      listWallets(), listLots({ limit: 200 }), readBacking(), listWithdrawals({ limit: 120 }),
      spendAnalysis(), bankLog({ limit: 120 }), auditConservation(), redenominationStatus(),
    ])

    const bank = wallets.find((w) => w.kind === 'bank')
    const held = wallets
      .filter((w) => w.kind !== 'treasury')
      .reduce((n, w) => n + w.balance + w.held, 0)
    const burned = log.filter((p) => p.kind === 'burn' && p.direction === 'debit')
      .reduce((n, p) => n + p.amount, 0)
    const withdrawn = withdrawals.reduce((n, w) => n + w.amount, 0)

    return NextResponse.json({
      // THE THREE NUMBERS THAT MUST NEVER BE ADDED TOGETHER. depositedAed is
      // real money; mintedAed is the company's word; claimedAed is neither yet.
      backing: back,
      inBank: bank?.balance ?? 0,
      heldAed: held,
      // Reported so the screen can say how far out the books are rather than
      // just that they are — over a window, so it is honest about its own scope.
      imbalance: bankImbalance({
        issuedAed: back.depositedAed + back.mintedAed,
        burnedAed: burned, withdrawnAed: withdrawn, heldAed: held,
      }),
      lots, withdrawals, use, log, audit, wallets, redenomination: redenom,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read the bank' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res
  const { user } = auth

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const action = String(body.action ?? '')
  const walletId = await walletFor(personId(user), user.name || user.email)
  const actor: Actor = { userId: personId(user), role: user.role, walletId }
  const lotId = String(body.lotId ?? '')

  const said = (r: { ok: boolean; refusal?: string; lotId?: string; duplicate?: boolean }) =>
    r.ok
      ? NextResponse.json({ ok: true, lotId: r.lotId ?? null, duplicate: r.duplicate ?? false })
      : NextResponse.json({ error: r.refusal }, { status: 400 })

  try {
    if (action === 'mint') {
      const amount = Number(body.amount)
      if (!isValidAmount(amount) || amount > MAX_CREDIT_AMOUNT) {
        return NextResponse.json({ error: 'badAmount' }, { status: 400 })
      }
      return said(await mintCash({ actor, amount, note: String(body.note ?? '') }))
    }

    // CLEARING IS WHERE A DEPOSIT BECOMES MONEY. Until this, the claim is a
    // row and nothing more.
    if (action === 'clearDeposit') return said(await clearDeposit({ actor, lotId }))
    if (action === 'rejectDeposit') {
      return said(await rejectDeposit({ actor, lotId, reason: String(body.reason ?? '') }))
    }

    // SIGNING A PARCEL OUT. This is what turns float into a cheque and writes
    // this admin's name on it — from here only they can burn it.
    if (action === 'move') return said(await moveFromBank({ actor, lotId }))

    if (action === 'burn') {
      const amount = Number(body.amount)
      if (!isValidAmount(amount)) return NextResponse.json({ error: 'badAmount' }, { status: 400 })
      return said(await burnCash({ actor, lotId, amount }))
    }

    // THE ONE-OFF RE-DENOMINATION, run by hand and never by a deploy hook. It
    // rewrites what every account is worth, and the person who owns the books
    // decides when the books move.
    if (action === 'redenominate') {
      const r = await redenominateToCash(personId(user))
      return r.ok
        ? NextResponse.json({ ok: true, scaled: r.scaled, alreadyDone: r.alreadyDone, addedCash: r.addedCash })
        : NextResponse.json({ error: r.reason ?? 'error' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The movement failed' },
      { status: 500 },
    )
  }
}
