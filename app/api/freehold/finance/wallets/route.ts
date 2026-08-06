/**
 * The bank, over HTTP.
 *
 * GET  — the position, the wallets, the recent ledger and the audit.
 * POST — issue coin, or transfer between two accounts by number.
 *
 * Every write goes through `postTransfer`, which is the only function in the
 * system that touches the ledger. There is deliberately no endpoint that sets
 * a balance: a balance you can assign is the thing this replaced.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MGMT_ROLES } from '@/lib/freehold/apps'
import { OWNER_ROLES } from '@/lib/freehold/session-types'
import {
  listWallets, listPostings, getPosition, auditConservation,
  openWallet, postTransfer, getWalletByAccountNo,
} from '@/lib/freehold/wallet-db'
import { isValidAmount, parseAccountNo } from '@/lib/freehold/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The house accounts. Opened on first read so the dashboard is never empty. */
async function ensureHouseWallets() {
  await openWallet({ id: 'w_treasury', kind: 'treasury', label: 'Treasury' })
  await openWallet({ id: 'w_operations', kind: 'operations', label: 'Operations' })
  await openWallet({ id: 'w_lead_machine', kind: 'lead_machine', label: 'Lead Machine' })
}

export async function GET() {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res
  try {
    await ensureHouseWallets()
    const [wallets, postings, position, audit] = await Promise.all([
      listWallets(), listPostings({ limit: 60 }), getPosition(), auditConservation(),
    ])
    return NextResponse.json({ wallets, postings, position, audit })
  } catch (err) {
    // Named, never an empty dashboard that reads as "no money".
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read the ledger' },
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
  const amount = Number(body.amount)
  if (!isValidAmount(amount)) {
    return NextResponse.json({ error: 'Amount must be a whole number of coins above zero' }, { status: 400 })
  }
  const memo = String(body.memo ?? '').slice(0, 200)

  // Issuing is creating money. That is the owner's act alone — the same rule
  // as deletion, and for the same reason: it is the one thing that cannot be
  // undone by another transfer.
  if (action === 'issue') {
    if (!OWNER_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Only the owner account may issue coin' }, { status: 403 })
    }
    await ensureHouseWallets()
    const res = await postTransfer({
      reference: `issue:${Date.now()}:${user.email}`,
      kind: 'issue', amount, fromWalletId: 'w_treasury', toWalletId: 'w_operations',
      memo: memo || 'Issued', actor: user.email,
    })
    return res.ok
      ? NextResponse.json({ ok: true, transferId: res.transferId })
      : NextResponse.json({ error: res.refusal }, { status: 400 })
  }

  if (action === 'transfer') {
    const toAcc = String(body.toAccountNo ?? '').trim().toUpperCase()
    if (!parseAccountNo(toAcc)) {
      // Rejected on the check digit, before any money moves — a mistyped
      // number must not become a transfer to a wallet that happens to exist.
      return NextResponse.json({ error: 'That account number is not valid' }, { status: 400 })
    }
    const to = await getWalletByAccountNo(toAcc)
    if (!to) return NextResponse.json({ error: 'No wallet has that account number' }, { status: 404 })

    const fromId = String(body.fromWalletId ?? 'w_operations')
    const res = await postTransfer({
      reference: `transfer:${Date.now()}:${user.email}`,
      kind: 'transfer', amount, fromWalletId: fromId, toWalletId: to.id,
      memo: memo || `To ${to.label}`, actor: user.email,
    })
    if (res.ok) return NextResponse.json({ ok: true, transferId: res.transferId, to: to.label })
    const status = res.refusal === 'insufficient_funds' ? 409 : 400
    return NextResponse.json({ error: res.refusal }, { status })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
