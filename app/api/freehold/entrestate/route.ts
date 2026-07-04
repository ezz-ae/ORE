import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { listClients, getClientConfig, getClientConnectors } from '@/lib/entrestate/registry'
import { queryClientView, EntrestateAccessError } from '@/lib/entrestate/gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Read-only window onto the Entrestate multi-tenant data platform.
// - GET                       → list registered clients (tenants) + their views
// - GET ?client=gc            → one client's config + wired connectors
// - GET ?client=gc&view=api.listings_feed&limit=20 → that client's scoped data
// Management-gated; the gateway enforces per-client view/column access.
export async function GET(req: NextRequest) {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client')?.trim()
  const view = searchParams.get('view')?.trim()
  const limit = Number(searchParams.get('limit') ?? 25)

  // Directory of all tenants.
  if (!clientId) {
    const clients = await listClients()
    return NextResponse.json({
      clients: clients.map((c) => ({
        clientId: c.clientId, clientName: c.clientName, tier: c.tier,
        rateLimit: c.rateLimit, isActive: c.isActive, allowedViews: c.allowedViews,
      })),
    })
  }

  const client = await getClientConfig(clientId)
  if (!client) return NextResponse.json({ error: 'Unknown client' }, { status: 404 })

  // One client's config + connectors.
  if (!view) {
    const connectors = await getClientConnectors(clientId)
    return NextResponse.json({
      client: {
        clientId: client.clientId, clientName: client.clientName, tier: client.tier,
        rateLimit: client.rateLimit, allowedViews: client.allowedViews,
      },
      connectors,
    })
  }

  // Scoped data read.
  try {
    const result = await queryClientView(client, view, { limit })
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof EntrestateAccessError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Data read failed' }, { status: 500 })
  }
}
