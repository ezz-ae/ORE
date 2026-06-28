import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"

export type ContractStatus = "active" | "expiring" | "expired" | "draft"
export type ContractType = "platform" | "data" | "agency" | "legal" | "service"

export interface Contract {
  id: string
  name: string
  type: ContractType
  counterparty: string
  value: string
  startDate: string | null
  endDate: string | null
  status: ContractStatus
  autoRenew: boolean
  notes: string
  daysLeft: number | null
}

export interface ContractInput {
  name: string
  type?: ContractType
  counterparty?: string
  value?: string
  startDate?: string
  endDate?: string
  autoRenew?: boolean
  notes?: string
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))
const VALID_TYPES: ContractType[] = ["platform", "data", "agency", "legal", "service"]

let ensurePromise: Promise<void> | null = null
const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_contracts (
      id text PRIMARY KEY,
      name text NOT NULL,
      type text DEFAULT 'service',
      counterparty text,
      value text,
      start_date date,
      end_date date,
      status text DEFAULT 'active',
      auto_renew boolean DEFAULT false,
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
  // Seed a realistic starter set once so the page isn't empty on first run.
  const existing = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM freehold_site_contracts`)
  if ((existing[0]?.c || 0) === 0) {
    const seed: Array<[string, ContractType, string, string, string, string, boolean, string]> = [
      ["Meta Business Agreement", "platform", "Meta Platforms Inc.", "AED 25,000 / mo", "2025-01-01", "2026-12-31", true, "Covers all Meta ad products with monthly invoicing."],
      ["Google Ads Terms of Service", "platform", "Google LLC", "AED 18,000 / mo", "2025-01-01", "2026-12-31", true, "Performance Max + Search campaigns."],
      ["DLD Data Feed License", "data", "Dubai Land Department", "AED 12,000 / yr", "2025-03-01", "2027-02-28", false, "Property transaction data; annual renewal."],
      ["Legal Advisory — Real Estate", "legal", "Al Tamimi & Company", "AED 5,000 / mo", "2026-01-01", "2026-12-31", true, ""],
    ]
    for (const [name, type, cp, value, sd, ed, ar, notes] of seed) {
      await query(
        `INSERT INTO freehold_site_contracts (id, name, type, counterparty, value, start_date, end_date, status, auto_renew, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, 'active', $8, $9, now(), now())`,
        [`ctr_${randomUUID()}`, name, type, cp, value, sd, ed, ar, notes],
      )
    }
  }
}
const ensureSchemaOnce = async () => {
  if (!ensurePromise) ensurePromise = ensureSchema().catch((e) => { ensurePromise = null; throw e })
  await ensurePromise
}

const mapRow = (r: Record<string, unknown>): Contract => {
  const end = r.end_date ? String(r.end_date) : null
  let daysLeft: number | null = null
  let status = (str(r.status) || "active") as ContractStatus
  if (end) {
    const ms = new Date(end).getTime() - Date.now()
    daysLeft = Math.round(ms / (24 * 60 * 60 * 1000))
    if (daysLeft < 0) status = "expired"
    else if (daysLeft <= 30 && status === "active") status = "expiring"
  }
  return {
    id: str(r.id),
    name: str(r.name),
    type: (str(r.type) || "service") as ContractType,
    counterparty: str(r.counterparty),
    value: str(r.value),
    startDate: r.start_date ? String(r.start_date) : null,
    endDate: end,
    status,
    autoRenew: Boolean(r.auto_renew),
    notes: str(r.notes),
    daysLeft,
  }
}

const SELECT = `id, name, type, counterparty, value, start_date::text, end_date::text, status, auto_renew, notes`

export async function listContracts(): Promise<Contract[]> {
  try {
    await ensureSchemaOnce()
    const rows = await query<Record<string, unknown>>(`SELECT ${SELECT} FROM freehold_site_contracts ORDER BY end_date ASC NULLS LAST`)
    return rows.map(mapRow)
  } catch (e) {
    console.error("[contracts] list failed", e)
    return []
  }
}

export async function createContract(input: ContractInput): Promise<Contract> {
  await ensureSchemaOnce()
  const id = `ctr_${randomUUID()}`
  const type = VALID_TYPES.includes(input.type as ContractType) ? input.type : "service"
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_contracts (id, name, type, counterparty, value, start_date, end_date, status, auto_renew, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, 'active', $8, $9, now(), now()) RETURNING ${SELECT}`,
    [id, input.name, type, input.counterparty || "", input.value || "", input.startDate || null, input.endDate || null, Boolean(input.autoRenew), input.notes || ""],
  )
  return mapRow(rows[0])
}

/** Renew: extend end date by one year and mark active. */
export async function renewContract(id: string): Promise<Contract | null> {
  await ensureSchemaOnce()
  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_contracts
     SET end_date = (COALESCE(end_date, CURRENT_DATE) + INTERVAL '1 year')::date,
         status = 'active', updated_at = now()
     WHERE id = $1 RETURNING ${SELECT}`,
    [id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}
