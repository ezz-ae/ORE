import { query } from '@/lib/db'
import type { EntrestateClient } from '@/lib/entrestate/registry'

// Access-controlled, read-only gateway onto the Entrestate `api.*` data views.
// A client may only read views listed in its `allowed_views`, and only the
// columns in `allowed_columns` (when set). This is the enforcement point for
// the white-label's per-tenant data isolation.

// Defence in depth: a view name is only ever used in SQL if it matches this
// strict shape AND appears in the client's allow-list. No arbitrary identifiers.
const SAFE_VIEW = /^api\.[a-z0-9_]+$/i
const SAFE_COLUMN = /^[a-z0-9_]+$/i
const MAX_ROWS = 500

export class EntrestateAccessError extends Error {
  constructor(message: string) { super(message); this.name = 'EntrestateAccessError' }
}

export interface ViewQueryResult {
  view: string
  clientId: string
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

/**
 * Read a data view on behalf of a client, enforcing view + column access.
 * Throws EntrestateAccessError when the view isn't permitted.
 */
export async function queryClientView(
  client: EntrestateClient,
  view: string,
  opts: { limit?: number } = {},
): Promise<ViewQueryResult> {
  if (!SAFE_VIEW.test(view)) throw new EntrestateAccessError('Invalid view name')
  if (!client.allowedViews.includes(view)) {
    throw new EntrestateAccessError(`View "${view}" is not permitted for client "${client.clientId}"`)
  }
  if (client.isActive === false) throw new EntrestateAccessError('Client is inactive')

  // Column projection: honour the per-view allow-list when present.
  const allowed = client.allowedColumns[view]?.filter((c) => SAFE_COLUMN.test(c)) ?? []
  const projection = allowed.length ? allowed.map((c) => `"${c}"`).join(', ') : '*'

  // A client's rate_limit doubles as its max page size here (capped hard).
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), Math.min(client.rateLimit || 50, MAX_ROWS))

  // `view` and `projection` are validated against strict patterns + the client
  // allow-list above, so this interpolation carries no injection surface.
  const rows = await query<Record<string, unknown>>(`SELECT ${projection} FROM ${view} LIMIT ${limit}`)
  return {
    view,
    clientId: client.clientId,
    columns: rows[0] ? Object.keys(rows[0]) : allowed,
    rows,
    rowCount: rows.length,
  }
}
