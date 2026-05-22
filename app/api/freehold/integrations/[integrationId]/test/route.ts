// app/api/freehold/integrations/[integrationId]/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationDetails } from '@/lib/freehold/mcp/mock-integrations';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  const integrationId = params.integrationId;
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

  // Mock test response
  const unmetRequirements = details.requirements.filter(req => !req.isMet);
  const canTest = unmetRequirements.length === 0;

  const response: McpResponseEnvelope<any> = {
    requestId: crypto.randomUUID(),
    status: canTest ? 'success' : 'error',
    data: {
      integrationId: details.id,
      integrationName: details.name,
      testResult: canTest ? 'passed' : 'failed',
      message: canTest
        ? `Successfully connected to ${details.name}`
        : `Cannot test: ${unmetRequirements.length} requirement(s) not met`,
      unmetRequirements: unmetRequirements.map(req => req.name),
    },
    evidence: canTest
      ? [`Test connection successful for ${details.name}`]
      : [`Test failed: missing requirements`],
    warnings: canTest ? [] : [`Please configure all required fields before testing`],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
