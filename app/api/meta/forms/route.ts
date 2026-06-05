import { NextRequest, NextResponse } from 'next/server'
import { listLeadForms, createLeadForm, MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { CreateLeadFormPayload } from '@/lib/meta/types'

export async function GET() {
  try {
    const forms = await listLeadForms()
    return NextResponse.json({ forms })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
