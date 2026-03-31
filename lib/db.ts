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
