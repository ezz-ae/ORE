import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import type { Role } from '@/lib/freehold/session-types'
import {
  listCustomConversions, createCustomConversion, MetaApiError, MetaConfigError,
} from '@/lib/meta/client'

// Mirrors proxy.ts's ADS_ROLES gate on /api/meta/* writes.
const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

// Meta's own enum for custom_event_type. Anything outside it is rejected here
// with a clear message rather than sent to Graph to fail obscurely.
const CUSTOM_EVENT_TYPES = new Set([
  'ADD_PAYMENT_INFO', 'ADD_TO_CART', 'ADD_TO_WISHLIST', 'COMPLETE_REGISTRATION',
  'CONTENT_VIEW', 'CONTACT', 'CUSTOMIZE_PRODUCT', 'DONATE', 'FIND_LOCATION',
  'INITIATED_CHECKOUT', 'LEAD', 'PURCHASE', 'SCHEDULE', 'SEARCH', 'START_TRIAL',
  'SUBMIT_APPLICATION', 'SUBSCRIBE', 'OTHER',
])

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const conversions = await listCustomConversions()
    return NextResponse.json({ conversions })
  } catch (err) {
    // Not connected is not an empty account — say which env var is missing.
    if (err instanceof MetaConfigError)
      return NextResponse.json({ conversions: [], configError: err.message })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const __auth = await requireSession(WRITE_ROLES)
  if ('res' in __auth) return __auth.res
  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name            = typeof body.name === 'string' ? body.name.trim() : ''
  const eventSourceId   = typeof body.eventSourceId === 'string' ? body.eventSourceId.trim() : ''
  const customEventType = typeof body.customEventType === 'string' ? body.customEventType.trim() : ''
  const rule            = typeof body.rule === 'string' ? body.rule.trim() : ''
  const description     = typeof body.description === 'string' ? body.description.trim() : ''

  if (!name)          return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
  if (!eventSourceId) return NextResponse.json({ error: 'Missing required field: eventSourceId' }, { status: 400 })
  if (!rule)          return NextResponse.json({ error: 'Missing required field: rule' }, { status: 400 })
  if (!CUSTOM_EVENT_TYPES.has(customEventType))
    return NextResponse.json({ error: `Unsupported custom_event_type: ${customEventType || '(empty)'}` }, { status: 400 })
  // Graph wants the rule as a JSON string; catching malformed JSON here keeps
  // the failure legible instead of arriving as an opaque Graph error.
  try { JSON.parse(rule) } catch {
    return NextResponse.json({ error: 'rule must be a JSON string' }, { status: 400 })
  }

  try {
    const created = await createCustomConversion({
      name, eventSourceId, customEventType, rule,
      ...(description ? { description } : {}),
    })
    return NextResponse.json({ conversion: created }, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
