import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Deal lifecycle:
 *  - pending_step1 : submitted by an agent, awaiting document / KYC verification
 *                    (Sales Manager or Admin)
 *  - pending_step2 : documents verified, awaiting final approval (CEO or Director)
 *  - approved      : fully approved — a confirmed deal that counts toward finance
 *  - rejected      : declined at either step
 *  - closed        : approved + commission fully settled
 */
export type DealStatus =
  | "pending_step1"
  | "pending_step2"
  | "approved"
  | "rejected"
  | "closed"

export type CommissionPaymentStatus = "unpaid" | "partial" | "paid"

export interface DealDocumentChecklist {
  signedBookingForm: boolean
  passport: boolean
  emiratesId: boolean
  developerReceipts: boolean
  kyc: boolean
}

export const EMPTY_DOCUMENTS: DealDocumentChecklist = {
  signedBookingForm: false,
  passport: false,
  emiratesId: false,
  developerReceipts: false,
  kyc: false,
}

export const DOCUMENT_LABELS: Record<keyof DealDocumentChecklist, string> = {
  signedBookingForm: "Signed booking form",
  passport: "Passport",
  emiratesId: "Emirates ID",
  developerReceipts: "Developer receipts",
  kyc: "KYC",
}

export interface Deal {
  id: string
  leadId: string | null
  leadName: string
  clientPhone: string
  clientEmail: string
  projectSlug: string
  projectName: string
  developerName: string
  agentId: string
  agentName: string
  coAgentName: string
  agentSharePct: number
  propertyValueAed: number
  agencyCommissionPct: number
  agencyCommissionAed: number
  referralCommissionPct: number
  referralCommissionAed: number
  cashbackPct: number
  cashbackAed: number
  netCommissionAed: number
  commissionReceivedAed: number
  commissionOutstandingAed: number
  paymentStatus: CommissionPaymentStatus
  status: DealStatus
  documents: DealDocumentChecklist
  step1By: string | null
  step1At: string | null
  step1Notes: string | null
  step2By: string | null
  step2At: string | null
  step2Notes: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  notes: string
  createdBy: string
  createdAt: string | null
  updatedAt: string | null
}

export interface DealInput {
  leadId?: string | null
  leadName: string
  clientPhone?: string
  clientEmail?: string
  projectSlug?: string
  projectName?: string
  developerName?: string
  agentId?: string
  agentName?: string
  propertyValueAed?: number
  agencyCommissionPct?: number
  agencyCommissionAed?: number
  referralCommissionPct?: number
  referralCommissionAed?: number
  cashbackPct?: number
  cashbackAed?: number
  coAgentName?: string
  agentSharePct?: number
  notes?: string
}

export interface FinanceTotals {
  totalDeals: number
  approvedDeals: number
  pendingDeals: number
  totalSalesAed: number
  totalCommissionAed: number
  netCommissionAed: number
  totalPaidAed: number
  totalOutstandingAed: number
}

// ─── Approval role helpers ───────────────────────────────────────────────────

const normRole = (role?: string | null) =>
  String(role || "").trim().toLowerCase().replace(/\s+/g, "_")

/** Step 1 — document & KYC verification. */
export const canVerifyDealDocuments = (role?: string | null) =>
  ["sales_manager", "admin"].includes(normRole(role))

/** Step 2 — final approval. */
export const canFinalApproveDeal = (role?: string | null) =>
  ["ceo", "director"].includes(normRole(role))

/** Management roles may create a deal without going through agent approval. */
export const isManagementRole = (role?: string | null) =>
  ["admin", "ceo", "director", "sales_manager"].includes(normRole(role))

// ─── Math helpers ─────────────────────────────────────────────────────────────

const num = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/** Resolve an AED amount from either an explicit amount or a percentage of base. */
const resolveAmount = (pct: number, amount: number, base: number): number => {
  if (amount > 0) return amount
  if (pct > 0 && base > 0) return (pct / 100) * base
  return 0
}

/** Compute the commission breakdown for a deal from its raw inputs. */
export function computeCommission(input: {
  propertyValueAed: number
  agencyCommissionPct: number
  agencyCommissionAed: number
  referralCommissionPct: number
  referralCommissionAed: number
  cashbackPct: number
  cashbackAed: number
}) {
  const propertyValueAed = num(input.propertyValueAed)
  const agencyCommissionPct = num(input.agencyCommissionPct)
  const agencyCommissionAed = resolveAmount(agencyCommissionPct, num(input.agencyCommissionAed), propertyValueAed)
  const referralCommissionPct = num(input.referralCommissionPct)
  const referralCommissionAed = resolveAmount(referralCommissionPct, num(input.referralCommissionAed), agencyCommissionAed)
  const cashbackPct = num(input.cashbackPct)
  const cashbackAed = resolveAmount(cashbackPct, num(input.cashbackAed), propertyValueAed)
  const netCommissionAed = Math.max(0, agencyCommissionAed - referralCommissionAed - cashbackAed)
  return {
    propertyValueAed,
    agencyCommissionPct,
    agencyCommissionAed,
    referralCommissionPct,
    referralCommissionAed,
    cashbackPct,
    cashbackAed,
    netCommissionAed,
  }
}

// ─── Schema ───────────────────────────────────────────────────────────────────

let ensureDealsSchemaPromise: Promise<void> | null = null

const ensureDealsSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_deals (
      id text PRIMARY KEY,
      lead_id text,
      lead_name text,
      client_phone text,
      client_email text,
      project_slug text,
      project_name text,
      developer_name text,
      agent_id text,
      agent_name text,
      co_agent_name text,
      agent_share_pct numeric DEFAULT 100,
      property_value_aed numeric DEFAULT 0,
      agency_commission_pct numeric DEFAULT 0,
      agency_commission_aed numeric DEFAULT 0,
      referral_commission_pct numeric DEFAULT 0,
      referral_commission_aed numeric DEFAULT 0,
      cashback_pct numeric DEFAULT 0,
      cashback_aed numeric DEFAULT 0,
      net_commission_aed numeric DEFAULT 0,
      commission_received_aed numeric DEFAULT 0,
      payment_status text DEFAULT 'unpaid',
      status text DEFAULT 'pending_step1',
      documents jsonb DEFAULT '{}'::jsonb,
      step1_by text,
      step1_at timestamptz,
      step1_notes text,
      step2_by text,
      step2_at timestamptz,
      step2_notes text,
      rejected_by text,
      rejected_at timestamptz,
      rejection_reason text,
      notes text,
      created_by text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
  // Defensive ADD COLUMN for databases where the table predates a column.
  const cols: Array<[string, string]> = [
    ["lead_id", "text"], ["lead_name", "text"], ["client_phone", "text"], ["client_email", "text"],
    ["project_slug", "text"], ["project_name", "text"], ["developer_name", "text"],
    ["agent_id", "text"], ["agent_name", "text"],
    ["co_agent_name", "text"], ["agent_share_pct", "numeric DEFAULT 100"],
    ["property_value_aed", "numeric DEFAULT 0"], ["agency_commission_pct", "numeric DEFAULT 0"],
    ["agency_commission_aed", "numeric DEFAULT 0"], ["referral_commission_pct", "numeric DEFAULT 0"],
    ["referral_commission_aed", "numeric DEFAULT 0"], ["cashback_pct", "numeric DEFAULT 0"],
    ["cashback_aed", "numeric DEFAULT 0"], ["net_commission_aed", "numeric DEFAULT 0"],
    ["commission_received_aed", "numeric DEFAULT 0"], ["payment_status", "text DEFAULT 'unpaid'"],
    ["status", "text DEFAULT 'pending_step1'"], ["documents", "jsonb DEFAULT '{}'::jsonb"],
    ["step1_by", "text"], ["step1_at", "timestamptz"], ["step1_notes", "text"],
    ["step2_by", "text"], ["step2_at", "timestamptz"], ["step2_notes", "text"],
    ["rejected_by", "text"], ["rejected_at", "timestamptz"], ["rejection_reason", "text"],
    ["notes", "text"], ["created_by", "text"],
    ["created_at", "timestamptz DEFAULT now()"], ["updated_at", "timestamptz DEFAULT now()"],
  ]
  for (const [name, type] of cols) {
    await query(`ALTER TABLE freehold_site_deals ADD COLUMN IF NOT EXISTS ${name} ${type}`)
  }
}

const ensureDealsSchemaOnce = async () => {
  if (!ensureDealsSchemaPromise) {
    ensureDealsSchemaPromise = ensureDealsSchema().catch((error) => {
      ensureDealsSchemaPromise = null
      throw error
    })
  }
  await ensureDealsSchemaPromise
}

// ─── Row mapping ───────────────────────────────────────────────────────────────

type DealRow = Record<string, unknown>

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v))
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v))

const parseDocuments = (v: unknown): DealDocumentChecklist => {
  let raw: Record<string, unknown> = {}
  if (v && typeof v === "object" && !Array.isArray(v)) raw = v as Record<string, unknown>
  else if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v)
      if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>
    } catch { /* ignore */ }
  }
  return {
    signedBookingForm: Boolean(raw.signedBookingForm),
    passport: Boolean(raw.passport),
    emiratesId: Boolean(raw.emiratesId),
    developerReceipts: Boolean(raw.developerReceipts),
    kyc: Boolean(raw.kyc),
  }
}

const mapRow = (row: DealRow): Deal => {
  const agencyCommissionAed = num(row.agency_commission_aed)
  const commissionReceivedAed = num(row.commission_received_aed)
  return {
    id: str(row.id),
    leadId: strOrNull(row.lead_id),
    leadName: str(row.lead_name),
    clientPhone: str(row.client_phone),
    clientEmail: str(row.client_email),
    projectSlug: str(row.project_slug),
    projectName: str(row.project_name),
    developerName: str(row.developer_name),
    agentId: str(row.agent_id),
    agentName: str(row.agent_name),
    coAgentName: str(row.co_agent_name),
    agentSharePct: row.agent_share_pct == null ? 100 : num(row.agent_share_pct),
    propertyValueAed: num(row.property_value_aed),
    agencyCommissionPct: num(row.agency_commission_pct),
    agencyCommissionAed,
    referralCommissionPct: num(row.referral_commission_pct),
    referralCommissionAed: num(row.referral_commission_aed),
    cashbackPct: num(row.cashback_pct),
    cashbackAed: num(row.cashback_aed),
    netCommissionAed: num(row.net_commission_aed),
    commissionReceivedAed,
    commissionOutstandingAed: Math.max(0, agencyCommissionAed - commissionReceivedAed),
    paymentStatus: (str(row.payment_status) || "unpaid") as CommissionPaymentStatus,
    status: (str(row.status) || "pending_step1") as DealStatus,
    documents: parseDocuments(row.documents),
    step1By: strOrNull(row.step1_by),
    step1At: strOrNull(row.step1_at),
    step1Notes: strOrNull(row.step1_notes),
    step2By: strOrNull(row.step2_by),
    step2At: strOrNull(row.step2_at),
    step2Notes: strOrNull(row.step2_notes),
    rejectedBy: strOrNull(row.rejected_by),
    rejectedAt: strOrNull(row.rejected_at),
    rejectionReason: strOrNull(row.rejection_reason),
    notes: str(row.notes),
    createdBy: str(row.created_by),
    createdAt: strOrNull(row.created_at),
    updatedAt: strOrNull(row.updated_at),
  }
}

const SELECT = `
  id, lead_id, lead_name, client_phone, client_email, project_slug, project_name, developer_name,
  agent_id, agent_name, co_agent_name, agent_share_pct, property_value_aed, agency_commission_pct, agency_commission_aed,
  referral_commission_pct, referral_commission_aed, cashback_pct, cashback_aed, net_commission_aed,
  commission_received_aed, payment_status, status, documents,
  step1_by, step1_at::text, step1_notes, step2_by, step2_at::text, step2_notes,
  rejected_by, rejected_at::text, rejection_reason, notes, created_by,
  created_at::text, updated_at::text
`

// ─── Queries ──────────────────────────────────────────────────────────────────

export interface ListDealsOptions {
  agentId?: string
  status?: DealStatus
  limit?: number
}

export async function listDeals(options: ListDealsOptions = {}): Promise<Deal[]> {
  try {
    await ensureDealsSchemaOnce()
    const where: string[] = []
    const params: unknown[] = []
    if (options.agentId) {
      params.push(options.agentId)
      where.push(`agent_id = $${params.length}`)
    }
    if (options.status) {
      params.push(options.status)
      where.push(`status = $${params.length}`)
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
    params.push(Math.max(1, Math.min(options.limit ?? 500, 1000)))
    const rows = await query<DealRow>(
      `SELECT ${SELECT} FROM freehold_site_deals ${whereSql}
       ORDER BY created_at DESC NULLS LAST LIMIT $${params.length}`,
      params,
    )
    return rows.map(mapRow)
  } catch (error) {
    console.error("[deals] listDeals failed", error)
    return []
  }
}

export async function getDealById(id: string): Promise<Deal | null> {
  try {
    await ensureDealsSchemaOnce()
    const rows = await query<DealRow>(
      `SELECT ${SELECT} FROM freehold_site_deals WHERE id = $1 LIMIT 1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    console.error("[deals] getDealById failed", error)
    return null
  }
}

/** Most recent deal linked to a given CRM lead (null if none). Used to enforce
 *  "convert a lead to a deal once". */
export async function getDealByLeadId(leadId: string): Promise<Deal | null> {
  if (!leadId) return null
  try {
    await ensureDealsSchemaOnce()
    const rows = await query<DealRow>(
      `SELECT ${SELECT} FROM freehold_site_deals WHERE lead_id = $1
       ORDER BY created_at DESC NULLS LAST LIMIT 1`,
      [leadId],
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    console.error("[deals] getDealByLeadId failed", error)
    return null
  }
}

export async function createDeal(
  input: DealInput,
  creator: { id: string; name: string; role?: string | null },
): Promise<Deal> {
  await ensureDealsSchemaOnce()
  const id = `deal_${randomUUID()}`
  const commission = computeCommission({
    propertyValueAed: num(input.propertyValueAed),
    agencyCommissionPct: num(input.agencyCommissionPct),
    agencyCommissionAed: num(input.agencyCommissionAed),
    referralCommissionPct: num(input.referralCommissionPct),
    referralCommissionAed: num(input.referralCommissionAed),
    cashbackPct: num(input.cashbackPct),
    cashbackAed: num(input.cashbackAed),
  })

  // Management-created deals are trusted and skip agent approval.
  // Agent (broker) deals enter the 2-step approval queue.
  const status: DealStatus = isManagementRole(creator.role) ? "approved" : "pending_step1"

  const sharePct = input.agentSharePct == null ? 100 : Math.min(100, Math.max(1, num(input.agentSharePct)))

  const rows = await query<DealRow>(
    `INSERT INTO freehold_site_deals (
      id, lead_id, lead_name, client_phone, client_email, project_slug, project_name, developer_name,
      agent_id, agent_name, co_agent_name, agent_share_pct,
      property_value_aed, agency_commission_pct, agency_commission_aed,
      referral_commission_pct, referral_commission_aed, cashback_pct, cashback_aed, net_commission_aed,
      status, notes, created_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now(), now()
    ) RETURNING ${SELECT}`,
    [
      id,
      input.leadId || null,
      input.leadName || "",
      input.clientPhone || "",
      input.clientEmail || "",
      input.projectSlug || "",
      input.projectName || "",
      input.developerName || "",
      input.agentId || creator.id,
      input.agentName || creator.name,
      input.coAgentName || "",
      sharePct,
      commission.propertyValueAed,
      commission.agencyCommissionPct,
      commission.agencyCommissionAed,
      commission.referralCommissionPct,
      commission.referralCommissionAed,
      commission.cashbackPct,
      commission.cashbackAed,
      commission.netCommissionAed,
      status,
      input.notes || "",
      creator.id,
    ],
  )
  return mapRow(rows[0])
}

/** Editable commercial fields (used by management manual edit). */
export async function updateDealFields(id: string, input: DealInput): Promise<Deal | null> {
  await ensureDealsSchemaOnce()
  const existing = await getDealById(id)
  if (!existing) return null

  const commission = computeCommission({
    propertyValueAed: input.propertyValueAed ?? existing.propertyValueAed,
    agencyCommissionPct: input.agencyCommissionPct ?? existing.agencyCommissionPct,
    agencyCommissionAed: input.agencyCommissionAed ?? 0,
    referralCommissionPct: input.referralCommissionPct ?? existing.referralCommissionPct,
    referralCommissionAed: input.referralCommissionAed ?? 0,
    cashbackPct: input.cashbackPct ?? existing.cashbackPct,
    cashbackAed: input.cashbackAed ?? 0,
  })

  const rows = await query<DealRow>(
    `UPDATE freehold_site_deals SET
      lead_name = COALESCE($2, lead_name),
      client_phone = COALESCE($3, client_phone),
      client_email = COALESCE($4, client_email),
      project_slug = COALESCE($5, project_slug),
      project_name = COALESCE($6, project_name),
      developer_name = COALESCE($7, developer_name),
      property_value_aed = $8,
      agency_commission_pct = $9,
      agency_commission_aed = $10,
      referral_commission_pct = $11,
      referral_commission_aed = $12,
      cashback_pct = $13,
      cashback_aed = $14,
      net_commission_aed = $15,
      notes = COALESCE($16, notes),
      co_agent_name = COALESCE($17, co_agent_name),
      agent_share_pct = COALESCE($18, agent_share_pct),
      updated_at = now()
     WHERE id = $1 RETURNING ${SELECT}`,
    [
      id,
      input.leadName ?? null,
      input.clientPhone ?? null,
      input.clientEmail ?? null,
      input.projectSlug ?? null,
      input.projectName ?? null,
      input.developerName ?? null,
      commission.propertyValueAed,
      commission.agencyCommissionPct,
      commission.agencyCommissionAed,
      commission.referralCommissionPct,
      commission.referralCommissionAed,
      commission.cashbackPct,
      commission.cashbackAed,
      commission.netCommissionAed,
      input.notes ?? null,
      input.coAgentName ?? null,
      input.agentSharePct ?? null,
    ],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Step 1 — verify documents / KYC and advance to final approval. */
export async function verifyDealDocuments(
  id: string,
  documents: DealDocumentChecklist,
  reviewer: { name: string },
  notes?: string,
): Promise<Deal | null> {
  await ensureDealsSchemaOnce()
  const rows = await query<DealRow>(
    `UPDATE freehold_site_deals SET
      documents = $2::jsonb,
      status = 'pending_step2',
      step1_by = $3,
      step1_at = now(),
      step1_notes = $4,
      updated_at = now()
     WHERE id = $1 AND status = 'pending_step1' RETURNING ${SELECT}`,
    [id, JSON.stringify(documents), reviewer.name, notes || null],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Step 2 — final approval. */
export async function finalApproveDeal(
  id: string,
  approver: { name: string },
  notes?: string,
): Promise<Deal | null> {
  await ensureDealsSchemaOnce()
  const rows = await query<DealRow>(
    `UPDATE freehold_site_deals SET
      status = 'approved',
      step2_by = $2,
      step2_at = now(),
      step2_notes = $3,
      updated_at = now()
     WHERE id = $1 AND status = 'pending_step2' RETURNING ${SELECT}`,
    [id, approver.name, notes || null],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function rejectDeal(
  id: string,
  reviewer: { name: string },
  reason: string,
): Promise<Deal | null> {
  await ensureDealsSchemaOnce()
  const rows = await query<DealRow>(
    `UPDATE freehold_site_deals SET
      status = 'rejected',
      rejected_by = $2,
      rejected_at = now(),
      rejection_reason = $3,
      updated_at = now()
     WHERE id = $1 AND status IN ('pending_step1', 'pending_step2') RETURNING ${SELECT}`,
    [id, reviewer.name, reason || "No reason given"],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Record a commission payment against an approved deal. */
export async function recordDealPayment(id: string, amountAed: number): Promise<Deal | null> {
  await ensureDealsSchemaOnce()
  const existing = await getDealById(id)
  if (!existing) return null
  const received = Math.max(0, existing.commissionReceivedAed + num(amountAed))
  const paymentStatus: CommissionPaymentStatus =
    received <= 0 ? "unpaid" : received >= existing.agencyCommissionAed ? "paid" : "partial"
  const closeStatus = paymentStatus === "paid" && existing.status === "approved" ? "closed" : existing.status
  const rows = await query<DealRow>(
    `UPDATE freehold_site_deals SET
      commission_received_aed = $2,
      payment_status = $3,
      status = $4,
      updated_at = now()
     WHERE id = $1 RETURNING ${SELECT}`,
    [id, received, paymentStatus, closeStatus],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Aggregated finance totals across approved + closed deals. */
export async function getFinanceTotals(options: { agentId?: string } = {}): Promise<FinanceTotals> {
  try {
    await ensureDealsSchemaOnce()
    const params: unknown[] = []
    let agentFilter = ""
    if (options.agentId) {
      params.push(options.agentId)
      agentFilter = `AND agent_id = $${params.length}`
    }
    const rows = await query<Record<string, unknown>>(
      `SELECT
         COUNT(*)::int AS total_deals,
         COUNT(*) FILTER (WHERE status IN ('approved', 'closed'))::int AS approved_deals,
         COUNT(*) FILTER (WHERE status IN ('pending_step1', 'pending_step2'))::int AS pending_deals,
         COALESCE(SUM(property_value_aed) FILTER (WHERE status IN ('approved', 'closed')), 0) AS total_sales,
         COALESCE(SUM(agency_commission_aed) FILTER (WHERE status IN ('approved', 'closed')), 0) AS total_commission,
         COALESCE(SUM(net_commission_aed) FILTER (WHERE status IN ('approved', 'closed')), 0) AS net_commission,
         COALESCE(SUM(commission_received_aed) FILTER (WHERE status IN ('approved', 'closed')), 0) AS total_paid
       FROM freehold_site_deals
       WHERE 1=1 ${agentFilter}`,
      params,
    )
    const r = rows[0] || {}
    const totalCommission = num(r.total_commission)
    const totalPaid = num(r.total_paid)
    return {
      totalDeals: num(r.total_deals),
      approvedDeals: num(r.approved_deals),
      pendingDeals: num(r.pending_deals),
      totalSalesAed: num(r.total_sales),
      totalCommissionAed: totalCommission,
      netCommissionAed: num(r.net_commission),
      totalPaidAed: totalPaid,
      totalOutstandingAed: Math.max(0, totalCommission - totalPaid),
    }
  } catch (error) {
    console.error("[deals] getFinanceTotals failed", error)
    return {
      totalDeals: 0, approvedDeals: 0, pendingDeals: 0, totalSalesAed: 0,
      totalCommissionAed: 0, netCommissionAed: 0, totalPaidAed: 0, totalOutstandingAed: 0,
    }
  }
}
