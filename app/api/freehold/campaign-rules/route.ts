import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listRules, createRule, type RuleInput } from '@/lib/freehold/campaign-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? ''
  const rules = await listRules(auth.user.email, campaignId)
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as RuleInput
  const rule = await createRule(auth.user.email, body)
  if (!rule) return NextResponse.json({ error: 'Invalid rule' }, { status: 400 })
  return NextResponse.json({ rule }, { status: 201 })
}
