/**
 * THE WALLET, OVER HTTP. Everybody has one.
 *
 * GET  — your balance, your movements, and the account number somebody would
 *        type to pay you.
 * POST — send Cash to any wallet, record money you have actually paid in, or
 *        record a spend with its receipt.
 *
 * NO ROLE GATE ON THE APP ITSELF. A wallet is not a management feature; a
 * broker holding Cash needs to see it as much as a director does. What IS
 * gated is the bank inside it, and that lives at /api/freehold/bank — a
 * separate route rather than a branch here, so "can this person mint" is
 * answered by the router rather than by an `if` somebody could soften.
 *
 * Every write goes through bank-db, which goes through `postTransfer`, which is
 * still the only function in the system that touches the ledger.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import {
  personId, walletFor, ensureBankWallets, sendCash, recordDeposit, spendCash, walletActivity,
} from '@/lib/freehold/bank-db'
import { listWallets, verifyLedgerChain } from '@/lib/freehold/wallet-db'
import { isValidAmount } from '@/lib/freehold/wallet'
import { SPEND_KINDS, type Actor, type SpendKind, type SpendProof } from '@/lib/freehold/bank'
import { verifyIntent } from '@/lib/freehold/wallet-signing-db'
import { SIGNATURE_REFUSALS, type SignedIntent } from '@/lib/freehold/wallet-signing'
import { MAX_CREDIT_AMOUNT } from '@/lib/freehold/credits-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { user } = auth

  try {
    await ensureBankWallets()
    const walletId = await walletFor(personId(user), user.name || user.email)
    const wallets = await listWallets()
    const mine = wallets.find((w) => w.id === walletId) ?? null
    // The activity feed, not the raw ledger: each row already carries who was
    // on the other side and whether it has cleared. A screen that had to work
    // that out per row would ask the database once per line.
    const activity = await walletActivity(walletId, personId(user), 60)

    // The directory of who can be paid. Account number and name only — a
    // wallet screen has no business telling one broker what another holds.
    const payees = wallets
      .filter((w) => w.id !== walletId && (w.kind === 'broker' || w.kind === 'operations'))
      .map((w) => ({ id: w.id, accountNo: w.accountNo, label: w.label }))

    // The proof, carried with the balance. A verdict a person has to go and
    // ask for is a verdict nobody ever asks for.
    const chain = await verifyLedgerChain().catch(() => null)

    return NextResponse.json({
      chain,
      wallet: mine && {
        id: mine.id, accountNo: mine.accountNo, balance: mine.balance, held: mine.held,
      },
      activity,
      payees,
    })
  } catch (err) {
    // Named, never an empty screen — "no movements" and "we could not read your
    // wallet" look identical to a person and mean opposite things.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read your wallet' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { user } = auth

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const action = String(body.action ?? '')
  const amount = Number(body.amount)
  // Rejected here as well as in the library. A NaN that reaches a balance is
  // silent corruption, and the guard costs nothing.
  if (!isValidAmount(amount) || amount > MAX_CREDIT_AMOUNT) {
    return NextResponse.json({ error: 'badAmount' }, { status: 400 })
  }

  const walletId = await walletFor(personId(user), user.name || user.email)
  const actor: Actor = { userId: personId(user), role: user.role, walletId }

  try {
    if (action === 'send') {
      const to = String(body.toWalletId ?? '').trim()
      if (!to) return NextResponse.json({ error: 'noSuchWallet' }, { status: 400 })

      // ── THE SIGNATURE, CHECKED BEFORE ANYTHING MOVES ───────────────────
      //
      // Once this person has a key, an UNSIGNED send is refused. That rule is
      // the whole scheme: if unsigned still worked, somebody holding a stolen
      // cookie would simply not sign.
      //
      // The intent is rebuilt HERE from the fields the server is actually going
      // to act on, never taken from the client as an object. A client-supplied
      // intent would let the signature cover one destination while the movement
      // used another — the signature would verify and the money would go
      // somewhere else.
      const memo = String(body.memo ?? '')
      const intent: SignedIntent = {
        action: 'send',
        fromWalletId: walletId,
        toWalletId: to,
        amount,
        memo,
        nonce: String(body.nonce ?? ''),
        atMs: Number(body.signedAtMs ?? 0),
      }
      const signed = await verifyIntent({
        userId: personId(user),
        walletId,
        intent,
        signature: body.signature ? String(body.signature) : undefined,
        nowMs: Date.now(),
      })
      if (!signed.ok) {
        return NextResponse.json({ error: signed.refusal, signature: true }, { status: 403 })
      }

      const r = await sendCash({
        actor, toWalletId: to, amount,
        memo: String(body.memo ?? ''),
        // THE NONCE IS THE REFERENCE. The anti-replay record and the ledger's
        // idempotency spine are then the same string rather than two that could
        // disagree about which payment this is — and a retry after a dropped
        // connection still pays once.
        reference: body.nonce
          ? `send:${String(body.nonce)}`
          : body.reference ? `send:${String(body.reference)}` : undefined,
      })
      return r.ok
        ? NextResponse.json({ ok: true, duplicate: r.duplicate ?? false })
        : NextResponse.json({ error: r.refusal }, { status: 400 })
    }

    // ANYONE MAY RECORD MONEY THEY ACTUALLY PAID IN. It creates a claim, not
    // Cash — see bank.ts. The screen says so, because a broker who thinks they
    // have just topped themselves up and cannot launch will file a bug.
    if (action === 'deposit') {
      const ref = String(body.transactionRef ?? '').trim()
      const r = await recordDeposit({ actor, amount, transactionRef: ref, note: String(body.note ?? '') })
      return r.ok
        ? NextResponse.json({ ok: true, lotId: r.lotId ?? null, duplicate: r.duplicate ?? false, state: 'claimed' })
        : NextResponse.json({ error: r.refusal }, { status: 400 })
    }

    if (action === 'spend') {
      const kind = String(body.kind ?? '')
      if (!(SPEND_KINDS as readonly string[]).includes(kind)) {
        return NextResponse.json({ error: 'badKind' }, { status: 400 })
      }
      const proof: SpendProof = {
        kind: kind as SpendKind,
        campaignId: body.campaignId ? String(body.campaignId) : null,
        adAccountId: body.adAccountId ? String(body.adAccountId) : null,
        reference: body.reference ? String(body.reference) : null,
        imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      }
      const r = await spendCash({ actor, amount, proof, note: String(body.note ?? '') })
      return r.ok
        ? NextResponse.json({ ok: true, duplicate: r.duplicate ?? false })
        : NextResponse.json({ error: r.refusal }, { status: 400 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The movement failed' },
      { status: 500 },
    )
  }
}
