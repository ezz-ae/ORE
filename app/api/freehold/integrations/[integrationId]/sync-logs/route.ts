// app/api/freehold/integrations/[integrationId]/sync-logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationDetails } from '@/lib/freehold/mcp/mock-integrations';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params;
  const details = getIntegrationDetails(integrationId);

  if (!details) {
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        status: 'error',
        warnings: [`Integration not found: ${integrationId}`],
        generatedAt: new Date().toISOString(),
      } as McpResponseEnvelope<any>,
      { status: 404 }
    );
  }

  const response: McpResponseEnvelope<any> = {
    requestId: crypto.randomUUID(),
    status: 'success',
    data: {
      integrationId: details.id,
      integrationName: details.name,
      syncLogs: details.syncLogs,
      lastSync: details.syncLogs.length > 0 ? details.syncLogs[0].timestamp : null,
    },
    evidence: [`Retrieved sync logs for ${details.name}`],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
