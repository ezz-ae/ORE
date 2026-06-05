import { NextResponse } from 'next/server'
import { listAudiences } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'

export async function GET() {
  try {
    const audiences = await listAudiences()
    return NextResponse.json({ audiences })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ error: e.message, type: 'config' }, { status: 503 })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
