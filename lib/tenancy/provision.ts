/**
 * Tenant schema provisioning — what happens right after createTenant().
 *
 * Philosophy: the app already creates its tables lazily (ensureOnce-keyed
 * CREATE TABLE IF NOT EXISTS on first use), so a fresh tenant schema fills
 * itself as the tenant works. Provisioning therefore only does the part lazy
 * DDL cannot: seed the tenant's PRIVATE copy of the shared market catalogue,
 * so their very first screen shows a live inventory they can edit and import
 * into without ever touching the shared rows.
 *
 * Read-only platform content (area profiles, developer profiles, blog) is NOT
 * copied — tenant requests read it from the shared schema via the search_path
 * fallback, so platform updates propagate to every tenant instantly. The line:
 * content tenants can WRITE is copied (private); content they only READ is
 * shared (fallback).
 */

import { query, runWithDefaultSchema, DEFAULT_SCHEMA } from '@/lib/db'

/** Catalogue tables a tenant gets a private, editable copy of at signup. */
const CATALOG_COPY_TABLES = [
  'freehold_site_projects',
  'freehold_site_project_profiles',
]

const SAFE_IDENT = /^[a-z0-9_]{1,63}$/

/**
 * Copy the shared catalogue into `schemaName`. Idempotent: tables already
 * present in the tenant schema are left untouched; catalogue tables missing
 * from the shared schema (e.g. an unseeded fresh database) are skipped.
 * Runs pinned to the default schema so it can see both sides.
 */
export async function provisionTenantSchema(schemaName: string): Promise<void> {
  if (!SAFE_IDENT.test(schemaName) || !SAFE_IDENT.test(DEFAULT_SCHEMA)) return
  await runWithDefaultSchema(async () => {
    for (const table of CATALOG_COPY_TABLES) {
      if (!SAFE_IDENT.test(table)) continue
      const [src] = await query<{ reg: string | null }>(
        `SELECT to_regclass($1)::text AS reg`,
        [`${DEFAULT_SCHEMA}.${table}`],
      )
      if (!src?.reg) continue // shared side not seeded — nothing to copy
      const [dst] = await query<{ reg: string | null }>(
        `SELECT to_regclass($1)::text AS reg`,
        [`${schemaName}.${table}`],
      )
      if (dst?.reg) continue // already provisioned — never clobber tenant data
      // Identifiers are validated against SAFE_IDENT above, so quoting them
      // into DDL is safe. LIKE INCLUDING ALL carries defaults, constraints
      // and indexes; the row copy runs in the same implicit transaction per
      // statement and the whole loop is idempotent on retry.
      await query(`CREATE TABLE "${schemaName}"."${table}" (LIKE "${DEFAULT_SCHEMA}"."${table}" INCLUDING ALL)`)
      await query(`INSERT INTO "${schemaName}"."${table}" SELECT * FROM "${DEFAULT_SCHEMA}"."${table}"`)
    }
  })
}
