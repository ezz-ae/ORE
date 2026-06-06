import { NextResponse } from 'next/server'
import { getInventoryProperties } from '@/src/features/freehold-intelligence/data-access'

export async function GET() {
  try {
    const properties = await getInventoryProperties()
    return NextResponse.json({ properties, total: properties.length })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }
}
