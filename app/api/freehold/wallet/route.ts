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
import { MGMT_ROLES } from '@/lib/freehold/apps'
import {
  personId, walletFor, ensureBankWallets, sendCash, recordDeposit, spendCash, walletActivity,
  BANK_WALLET_ID,
} from '@/lib/freehold/bank-db'
import { listWallets, verifyLedgerChain } from '@/lib/freehold/wallet-db'
import { askForCash, cancelRequest, decideCashRequest, listRequestsFor } from '@/lib/freehold/cash-request-db'
import { signaturesFor } from '@/lib/freehold/signature-db'
import { splitRequests, type RequestActor } from '@/lib/freehold/cash-request'
import { walletCommissions } from '@/lib/freehold/deal-payout-db'
import { isValidAmount } from '@/lib/freehold/wallet'
import { SPEND_KINDS, type Actor, type SpendKind, type SpendProof } from '@/lib/freehold/bank'
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

    // EVERY WALLET ON THE SYSTEM, so finding the person you mean is a scroll
    // rather than a hunt for an account number somebody has to send you.
    //
    // It used to list brokers and operations only, which quietly made two
    // ordinary things impossible: paying a manager, and paying money back to
    // the bank. Neither was a decision anybody took — they were a filter
    // written before the bank existed.
    //
    // Account number and name only. A wallet screen has no business telling
    // one broker what another is holding, and the balance is not needed to
    // choose a beneficiary.
    //
    // Own wallet excluded: you cannot transfer to yourself and you cannot ask
    // yourself for money, so offering it would only produce a refusal. The
    // treasury is excluded because it is the ledger's own counterparty for
    // creating and destroying Cash, not an account anybody holds.
    const payees = wallets
      .filter((w) => w.id !== walletId && w.kind !== 'treasury')
      .map((w) => ({ id: w.id, accountNo: w.accountNo, label: w.label, kind: w.kind }))

    // WHO SIGNED EACH ONE. Read in one query for the whole page rather than
    // one per row, and recomputed on read — a signature nobody checks is
    // decoration, and the cheapest moment to check one is the moment somebody
    // is looking at it. A movement with no signature reads as unsigned, never
    // as forged: the two are different facts and the older rows are the first.
    const signatures = await signaturesFor(activity.map((a) => a.id)).catch(() => new Map())
    const signed = activity.map((a) => {
      const sig = signatures.get(a.id)
      return sig
        ? {
            ...a,
            signature: {
              signerName: sig.signerName,
              signerId: sig.signerId,
              beneficiary: sig.beneficiary.label,
              beneficiaryAccount: sig.beneficiary.accountNo,
              statement: sig.statement,
              digest: sig.digest,
              holds: sig.holds,
              authority: sig.authority ?? '',
            },
          }
        : a
    })

    // The proof, carried with the balance. A verdict a person has to go and
    // ask for is a verdict nobody ever asks for.
    const chain = await verifyLedgerChain().catch(() => null)

    // WHAT IS STILL COMING, AND WHEN IT HAS BEEN ARRIVING. A broker could see
    // a commission outstanding on the deal page and had no way to tell when any
    // of it was due — the only part of it they can plan around. Keyed on the
    // broker id the deals are filed under, which for a broker session is not
    // the wallet's own key.
    const brokerId = user.brokerId ?? user.email
    const commissions = await walletCommissions(brokerId).catch(() => [])

    // WHAT IS WAITING ON WHOM. Split server-side by the same pure rule the
    // bank uses, so "can I act on this" is answered once rather than guessed
    // at by a screen — and a pending request between two other people appears
    // in neither list, because a wallet that showed everybody's asks would be
    // publishing who is short of money this month.
    const requestActor: RequestActor = {
      userId: personId(user), walletId, isAdmin: (MGMT_ROLES as readonly string[]).includes(user.role),
    }
    const requests = splitRequests(
      requestActor,
      await listRequestsFor(requestActor).catch(() => []),
      BANK_WALLET_ID,
    )

    return NextResponse.json({
      chain,
      commissions,
      // The signer, so the screen can show the same sentence that gets stored
      // rather than a paraphrase of it. See lib/freehold/signature.ts: what you
      // see and what is recorded have to be built from the same fields.
      me: { id: personId(user), name: user.name || user.email },
      wallet: mine && {
        id: mine.id, accountNo: mine.accountNo, balance: mine.balance, held: mine.held,
      },
      activity: signed,
      payees,
      requests,
      bankWalletId: BANK_WALLET_ID,
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
  //
  // Answering or withdrawing a request carries no amount — the amount is on
  // the row that was already agreed, and re-reading it from the request body
  // would let a caller approve one figure and pay another.
  const CARRIES_NO_AMOUNT = ['decideRequest', 'cancelRequest']
  if (!CARRIES_NO_AMOUNT.includes(action) && (!isValidAmount(amount) || amount > MAX_CREDIT_AMOUNT)) {
    return NextResponse.json({ error: 'badAmount' }, { status: 400 })
  }

  const walletId = await walletFor(personId(user), user.name || user.email)
  const actor: Actor = {
    userId: personId(user), role: user.role, walletId, name: user.name || user.email,
  }
  const requestActor: RequestActor = {
    userId: personId(user), walletId, isAdmin: (MGMT_ROLES as readonly string[]).includes(user.role),
  }

  try {
    if (action === 'send') {
      const to = String(body.toWalletId ?? '').trim()
      if (!to) return NextResponse.json({ error: 'noSuchWallet' }, { status: 400 })

      const r = await sendCash({
        actor, toWalletId: to, amount,
        memo: String(body.memo ?? ''),
        // The client supplies the key, so a retry after a dropped connection
        // pays once. Without it, "did that go through?" becomes "send it again".
        reference: body.reference ? `send:${String(body.reference)}` : undefined,
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

    // ── ASKING, WHICH MOVES NOTHING ────────────────────────────────────────
    //
    // A request is a row, not a movement. It becomes money only when the
    // person being asked signs — see lib/freehold/cash-request.ts for why
    // nobody can be asked to pay a third party.
    if (action === 'requestCash') {
      const askedOf = String(body.askedOfWalletId ?? '').trim()
      const r = await askForCash({
        actor: requestActor, askedOfWalletId: askedOf, amount,
        reason: String(body.reason ?? ''),
      })
      return r.ok
        ? NextResponse.json({ ok: true, id: r.id, state: r.state })
        : NextResponse.json({ error: r.refusal }, { status: 400 })
    }

    if (action === 'cancelRequest') {
      const r = await cancelRequest({ actor: requestActor, id: String(body.id ?? '') })
      return r.ok
        ? NextResponse.json({ ok: true, state: r.state })
        : NextResponse.json({ error: r.refusal }, { status: 400 })
    }

    // ANSWERING ONE IS THE TRANSFER. Reachable from a plain wallet because a
    // request asked of a broker is answered by that broker — routing it
    // through the bank route would make it management-only, which is the one
    // thing "any wallet to any wallet" must not become.
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
        ? NextResponse.json({ ok: true, state: r.state, duplicate: r.duplicate ?? false })
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
