import { NextResponse } from 'next/server'
import { listAudiences } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type GoogleAudience, type GoogleAudienceType } from '@/lib/google/types'
import { demoAudiences } from '@/lib/google/demo-data'
import { listLocalEntities, createLocalEntity, removeLocalEntity, localId } from '@/lib/google/local-store'

const KIND = 'audience'
const TYPES: GoogleAudienceType[] = ['CUSTOMER_MATCH', 'IN_MARKET', 'AFFINITY', 'REMARKETING', 'SIMILAR_AUDIENCE', 'COMBINED']

export async function GET() {
  try {
    const audiences = await listAudiences()
    return NextResponse.json({ audiences })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      const local = await listLocalEntities<GoogleAudience>(KIND)
      return NextResponse.json({ audiences: [...local, ...demoAudiences], demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { name?: string; type?: GoogleAudienceType; description?: string } | null
  const name = body?.name?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const type: GoogleAudienceType = body?.type && TYPES.includes(body.type) ? body.type : 'CUSTOMER_MATCH'
  const id = localId('aud')
  const audience: GoogleAudience = {
    id,
    resourceName: `customers/local/audiences/${id}`,
    name,
    type,
    status: 'OPEN',
    size: 0,
    description: body?.description?.trim() || undefined,
  }
  await createLocalEntity(KIND, audience)
  return NextResponse.json({ audience, demo: true }, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  await removeLocalEntity(KIND, id)
  return NextResponse.json({ ok: true })
}
