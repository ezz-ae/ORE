import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const properties = await getInventoryPropertiesFromDB()
  if (properties.length === 0) {
    return NextResponse.json({ properties: [], source: 'db_empty' })
  }
  return NextResponse.json({ properties, source: 'db' })
}
