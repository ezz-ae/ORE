import { NextRequest, NextResponse } from 'next/server'
import { getFormLeads, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const { formId } = await params
    const leads = await getFormLeads(formId)
    return NextResponse.json({ leads, total: leads.length })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
