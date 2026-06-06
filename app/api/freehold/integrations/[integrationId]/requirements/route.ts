// app/api/freehold/integrations/[integrationId]/requirements/route.ts

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
      requirements: details.requirements,
      allMet: details.requirements.every(req => req.isMet),
    },
    evidence: [`Retrieved requirements for ${details.name}`],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
