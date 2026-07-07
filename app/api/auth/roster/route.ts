import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Login-screen roster — the REAL team, from the database. Public (it powers
 * the sign-in profile picker) but minimal: names, initials and roles only for
 * active accounts that can actually sign in. No ids, no hashes, no phones.
 */
export async function GET() {
  try {
    const rows = await query<{ name: string; email: string; role: string }>(
      `SELECT name, email, role
       FROM freehold_site_users
       WHERE password_hash IS NOT NULL
         AND COALESCE(suspended, false) = false
         AND COALESCE(banned, false) = false
       ORDER BY CASE role
         WHEN 'ceo' THEN 0 WHEN 'director' THEN 1 WHEN 'admin' THEN 2
         WHEN 'sales_manager' THEN 3 WHEN 'marketing' THEN 4 ELSE 5 END, name`,
    )
    const profiles = rows.map((r) => ({
      name: r.name || r.email.split('@')[0],
      email: r.email,
      role: r.role,
      initials: (r.name || r.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
    }))
    return NextResponse.json({ profiles })
  } catch {
    return NextResponse.json({ profiles: [] })
  }
}
