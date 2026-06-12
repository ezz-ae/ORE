// app/api/freehold/integrations/[integrationId]/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge';
import { getIntegrationDetails } from '@/lib/freehold/mcp/mock-integrations';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = await verifySession(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
