import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import type { GenerateCreativePayload } from '@/lib/meta/types'
import { buildVariants, geminiCreatives } from '@/lib/meta/creative-gen'

export async function POST(req: NextRequest) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const body = (await req.json()) as GenerateCreativePayload

    const required: (keyof GenerateCreativePayload)[] = ['listingId', 'listingName', 'area', 'developer', 'angle', 'tone', 'cta']
    for (const field of required) {
      if (!body[field]) return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
    }

    const ai = await geminiCreatives(body)
    const variants = ai ?? buildVariants(body)
    return NextResponse.json({ variants, source: ai ? 'gemini' : 'template' })
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
