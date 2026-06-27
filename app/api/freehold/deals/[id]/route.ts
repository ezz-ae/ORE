import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import {
  getDealById,
  updateDealFields,
  verifyDealDocuments,
  finalApproveDeal,
  rejectDeal,
  recordDealPayment,
  canVerifyDealDocuments,
  canFinalApproveDeal,
  isManagementRole,
  EMPTY_DOCUMENTS,
  type DealDocumentChecklist,
} from "@/lib/deals"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const sessionId = (user: { brokerId?: string; email: string }) => user.brokerId || user.email

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const deal = await getDealById(id)
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 })

  // Brokers may only read their own deals.
  if (!isManagementRole(user.role) && deal.agentId !== sessionId(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return NextResponse.json({ deal })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = String(body.action || "update")
  const existing = await getDealById(id)
  if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 })

  try {
    switch (action) {
      // ── Step 1: document & KYC verification (Sales Manager / Admin) ──────────
      case "verify_documents": {
        if (!canVerifyDealDocuments(user.role)) {
          return NextResponse.json({ error: "Only Sales Manager or Admin can verify documents" }, { status: 403 })
        }
        const docs: DealDocumentChecklist = { ...EMPTY_DOCUMENTS, ...(body.documents as object || {}) }
        const required = Object.values(docs).every(Boolean)
        if (!required) {
          return NextResponse.json({ error: "All documents must be verified before advancing" }, { status: 400 })
        }
        const deal = await verifyDealDocuments(id, docs, { name: user.name }, String(body.notes || ""))
        if (!deal) return NextResponse.json({ error: "Deal is not awaiting document verification" }, { status: 409 })
        return NextResponse.json({ deal })
      }

      // ── Step 2: final approval (CEO / Director) ─────────────────────────────
      case "final_approve": {
        if (!canFinalApproveDeal(user.role)) {
          return NextResponse.json({ error: "Only CEO or Director can give final approval" }, { status: 403 })
        }
        const deal = await finalApproveDeal(id, { name: user.name }, String(body.notes || ""))
        if (!deal) return NextResponse.json({ error: "Deal is not awaiting final approval" }, { status: 409 })
        return NextResponse.json({ deal })
      }

      // ── Reject at either step ───────────────────────────────────────────────
      case "reject": {
        if (!canVerifyDealDocuments(user.role) && !canFinalApproveDeal(user.role)) {
          return NextResponse.json({ error: "Not authorized to reject deals" }, { status: 403 })
        }
        const deal = await rejectDeal(id, { name: user.name }, String(body.reason || ""))
        if (!deal) return NextResponse.json({ error: "Deal cannot be rejected in its current state" }, { status: 409 })
        return NextResponse.json({ deal })
      }

      // ── Record a commission payment (management only) ───────────────────────
      case "record_payment": {
        if (!isManagementRole(user.role)) {
          return NextResponse.json({ error: "Only management can record payments" }, { status: 403 })
        }
        const amount = Number(body.amountAed)
        if (!Number.isFinite(amount) || amount === 0) {
          return NextResponse.json({ error: "A non-zero amount is required" }, { status: 400 })
        }
        const deal = await recordDealPayment(id, amount)
        return NextResponse.json({ deal })
      }

      // ── Edit commercial fields (management only) ────────────────────────────
      case "update":
      default: {
        if (!isManagementRole(user.role)) {
          return NextResponse.json({ error: "Only management can edit deals" }, { status: 403 })
        }
        const numOrUndef = (v: unknown) => (v === undefined || v === null ? undefined : Number(v))
        const strOrUndef = (v: unknown) => (typeof v === "string" ? v : undefined)
        const deal = await updateDealFields(id, {
          leadName: strOrUndef(body.leadName) ?? existing.leadName,
          clientPhone: strOrUndef(body.clientPhone),
          clientEmail: strOrUndef(body.clientEmail),
          projectSlug: strOrUndef(body.projectSlug),
          projectName: strOrUndef(body.projectName),
          developerName: strOrUndef(body.developerName),
          propertyValueAed: numOrUndef(body.propertyValueAed),
          agencyCommissionPct: numOrUndef(body.agencyCommissionPct),
          agencyCommissionAed: numOrUndef(body.agencyCommissionAed),
          referralCommissionPct: numOrUndef(body.referralCommissionPct),
          referralCommissionAed: numOrUndef(body.referralCommissionAed),
          cashbackPct: numOrUndef(body.cashbackPct),
          cashbackAed: numOrUndef(body.cashbackAed),
          notes: strOrUndef(body.notes),
        })
        return NextResponse.json({ deal })
      }
    }
  } catch (error) {
    console.error("[deals] PATCH failed", error)
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 })
  }
}
