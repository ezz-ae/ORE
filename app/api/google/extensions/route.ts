import { NextResponse } from 'next/server'
import { listExtensions } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'
import { demoExtensions } from '@/lib/google/demo-data'

export async function GET() {
  try {
    const extensions = await listExtensions()
    return NextResponse.json({ extensions })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ extensions: demoExtensions, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
