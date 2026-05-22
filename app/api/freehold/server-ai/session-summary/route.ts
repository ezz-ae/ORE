// app/api/freehold/server-ai/session-summary/route.ts

import { NextResponse } from 'next/server';
import { executeTool } from '@/lib/freehold/mcp/execute-tool';

export async function GET() {
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
