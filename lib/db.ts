import { Pool, type QueryResultRow } from "pg"

const rawConnectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
const schema = process.env.DB_SCHEMA || "public"

const getConnectionString = () => {
  if (!rawConnectionString) {
    throw new Error("Missing NEON_DATABASE_URL or DATABASE_URL environment variable")
  }
  return rawConnectionString.includes("sslmode=")
    ? rawConnectionString.replace(/sslmode=[^&]+/, "sslmode=verify-full")
    : `${rawConnectionString}${rawConnectionString.includes("?") ? "&" : "?"}sslmode=verify-full`
}

const globalForPool = globalThis as unknown as { pgPool?: Pool }

function getPool(): Pool {
  if (globalForPool.pgPool) return globalForPool.pgPool

  const pool = new Pool({
    connectionString: getConnectionString()
  })

  pool.on('connect', (client) => {
    // This is safe because 'schema' is from a trusted environment variable
    client.query(`SET search_path TO '${schema}'`)
  })

  if (process.env.NODE_ENV !== "production") {
    globalForPool.pgPool = pool
  }
  return pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  if (!rawConnectionString) return [] as T[]
  const result = await getPool().query<T>(text, params)
  return result.rows
}

/** A single-connection query bound to an open transaction. */
export type TxQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<T[]>

/**
 * Run `fn` inside a single BEGIN/COMMIT transaction on one pooled connection,
 * so `SELECT ... FOR UPDATE` row locks hold for the whole callback. Rolls back
 * (and rethrows) on any error. Throws if no database is configured — callers
 * that must stay non-fatal should wrap this in their own try/catch.
 */
export async function withTransaction<T>(fn: (q: TxQuery) => Promise<T>): Promise<T> {
  if (!rawConnectionString) {
    throw new Error("Missing NEON_DATABASE_URL or DATABASE_URL environment variable")
  }
  const client = await getPool().connect()
  const scoped: TxQuery = async (text, params = []) => (await client.query(text, params)).rows as never
  try {
    await client.query("BEGIN")
    const out = await fn(scoped)
    await client.query("COMMIT")
    return out
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
