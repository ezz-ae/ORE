import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { createLeadForm, MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { listLeadFormsMerged, registerCreatedForm } from '@/lib/meta/form-registry'
import type { CreateLeadFormPayload } from '@/lib/meta/types'

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    // Meta's list merged with the local registry of platform-created forms —
    // DRAFT forms Meta's list edge omits are fetched by id and appended, so a
    // form created here can never vanish from the list.
    const forms = await listLeadFormsMerged()
    return NextResponse.json({ forms })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ forms: [], demo: true })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const body = (await req.json()) as CreateLeadFormPayload

    const required: (keyof CreateLeadFormPayload)[] = ['name', 'listingId', 'landingUrl', 'questions', 'privacyPolicyUrl']
    for (const field of required) {
      if (!body[field]) return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
    if (!body.questions.length) {
      return NextResponse.json({ error: 'At least one question is required' }, { status: 400 })
    }

    const result = await createLeadForm(body)
    // Best-effort local record of the created form (drafts can be missing
    // from Meta's list edge) — a registry failure must never fail the create.
    await registerCreatedForm(result.id, body.name, __auth.user.email ?? null).catch((e) => {
      console.warn('[meta-forms] form registry insert failed (non-fatal)', e)
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
