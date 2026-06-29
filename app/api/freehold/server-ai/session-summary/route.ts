// app/api/freehold/server-ai/session-summary/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { executeTool } from '@/lib/freehold/mcp/execute-tool';
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge';

// Aggregates owner-level server, integration, and launch-blocker data — restrict
// to operators. Brokers/marketing must never see infra blockers or billing state.
const OPERATOR_ROLES = new Set(['admin', 'ceo', 'director']);

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!OPERATOR_ROLES.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [server, integrations, blockers, leadMachine] = await Promise.all([
    executeTool({ tool: 'server_summary', role: 'owner' }),
    executeTool({ tool: 'integration_summary', role: 'owner' }),
    executeTool({ tool: 'launch_blockers', role: 'owner' }),
    executeTool({ tool: 'lead_machine_summary', role: 'owner' }),
  ]);

  return NextResponse.json({
    requestId: crypto.randomUUID(),
    layer: 'server-ai',
    status: 'success',
    data: {
      period: '24h',
      role: 'owner',
      accountLevel: 'owner',
      summaryText: `Good evening. I reviewed the Freehold private server. There are ${blockers.data?.blockers?.length || 0} open launch requirements and ${leadMachine.data?.totalListings || 0} live listings available for Lead Machine decisions.`,
      server: server.data,
      integrations: integrations.data,
      blockedItems: blockers.data?.blockers || [],
      leadMachine: leadMachine.data,
      recommendedActions: [
        'Connect HubSpot CRM before CRM automation',
        'Resolve Meta billing/access before ad launch',
        'Configure tracking pixels and conversion events',
        'Complete freeholdproperties.ae DNS/SSL setup',
      ],
    },
    evidence: ['Aggregated server_summary, integration_summary, launch_blockers and lead_machine_summary MCP tools'],
    warnings: [...(server.warnings || []), ...(integrations.warnings || []), ...(blockers.warnings || []), ...(leadMachine.warnings || [])],
    nextActions: ['Open Integration Dashboard', 'Clear launch blockers', 'Review Lead Machine matrix'],
    generatedAt: new Date().toISOString(),
  });
}
