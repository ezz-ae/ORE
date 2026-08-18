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
  BANK_WALLET_ID,
} from '@/lib/freehold/bank-db'
import { listWallets, auditConservation } from '@/lib/freehold/wallet-db'
import { listRequestsOfBank, decideCashRequest } from '@/lib/freehold/cash-request-db'
import type { RequestActor } from '@/lib/freehold/cash-request'
import { getUserProfileByEmail } from '@/lib/data'
import { redenominateToCash, redenominationStatus } from '@/lib/freehold/credits-db'
import { isValidAmount } from '@/lib/freehold/wallet'
import { bankImbalance, type Actor } from '@/lib/freehold/bank'
import { MAX_CREDIT_AMOUNT } from '@/lib/freehold/credits-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  const { user } = auth
  try {
    await ensureBankWallets()
    const myWalletId = await walletFor(personId(user), user.name || user.email)
    const [wallets, lots, back, withdrawals, use, log, audit, redenom, requests] = await Promise.all([
      listWallets(), listLots({ limit: 200 }), readBacking(), listWithdrawals({ limit: 120 }),
      spendAnalysis(), bankLog({ limit: 120 }), auditConservation(), redenominationStatus(),
      // THE BANK'S OWN QUEUE. Everything anybody has asked the bank for, still
      // pending at the top. Fails soft: a bank that cannot read its requests is
      // still a bank, and an empty list is honest about what it could load.
      listRequestsOfBank(BANK_WALLET_ID).catch(() => []),
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
      requests, bankWalletId: BANK_WALLET_ID,
      // The signing admin, so the bank screen shows the sentence that gets
      // stored rather than a paraphrase of it — see lib/freehold/signature.ts.
      me: { id: personId(user), name: user.name || user.email, walletId: myWalletId },
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
  const actor: Actor = {
    userId: personId(user), role: user.role, walletId, name: user.name || user.email,
  }
  const requestActor: RequestActor = { userId: personId(user), walletId, isAdmin: true }
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

    // SIGNING A PARCEL OUT, TO A NAMED BENEFICIARY. This is what turns float
    // into a cheque and writes this admin's name on it — from here only they
    // can burn it, however far it travels. The beneficiary may be any wallet
    // including their own; omitting it still means their own, so an admin
    // taking float into their own hands does not have to name themselves.
    if (action === 'move') {
      return said(await moveFromBank({
        actor, lotId, toWalletId: String(body.toWalletId ?? '').trim() || null,
      }))
    }

    // ANSWERING WHAT WAS ASKED OF THE BANK. The same call the wallet route
    // makes — one implementation, so "approved" means the same thing and moves
    // the same money whichever screen it was pressed on.
    if (action === 'decideRequest') {
      const r = await decideCashRequest({
        actor: requestActor,
        actorName: user.name || user.email,
        id: String(body.id ?? ''),
        approve: body.approve === true,
        bankWalletId: BANK_WALLET_ID,
        atMs: Date.now(),
      })
      return r.ok
        ? NextResponse.json({ ok: true, state: r.state })
        : NextResponse.json({ error: r.refusal }, { status: 400 })
    }

    // OPEN A WALLET FOR SOMEBODY.
    //
    // Keyed on the EMAIL, which is the same key `personId` uses everywhere
    // else — so a wallet opened for somebody who has no account yet becomes
    // theirs the moment they sign in with that address. That is the whole
    // reason this is allowed to run ahead of the account: a new joiner can be
    // funded before their first login instead of after it.
    //
    // Idempotent by construction: `walletFor` opens or returns, so pressing it
    // twice cannot give one person two wallets and split their balance.
    if (action === 'createWallet') {
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'badEmail' }, { status: 400 })
      }
      const profile = await getUserProfileByEmail(email).catch(() => null)
      const label = String(body.label ?? '').trim() || profile?.name || email
      const id = await walletFor(email, label)
      const wallet = (await listWallets()).find((w) => w.id === id) ?? null
      // Reported, never hidden: a wallet whose person has no account cannot be
      // opened by them yet, and a screen that did not say so would look as
      // though it had done more than it had.
      return NextResponse.json({ ok: true, wallet, hasAccount: !!profile })
    }

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
