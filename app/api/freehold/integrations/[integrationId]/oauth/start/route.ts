// app/api/freehold/integrations/[integrationId]/oauth/start/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getIntegration } from '@/lib/freehold/mcp/mock-integrations';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params;
  const integration = getIntegration(integrationId);

  if (!integration) {
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

  // Mock OAuth initiation - in production, this would redirect to the OAuth provider
  const mockOAuthUrl = `https://mock-oauth.${integrationId}.com/authorize?client_id=freehold&redirect_uri=http://localhost:3000/api/freehold/integrations/${integrationId}/oauth/callback`;

  const response: McpResponseEnvelope<any> = {
    requestId: crypto.randomUUID(),
    status: 'success',
    data: {
      integrationId: integration.id,
      integrationName: integration.name,
      authUrl: mockOAuthUrl,
      message: `OAuth flow initiated for ${integration.name}. In a real implementation, you would be redirected to the OAuth provider.`,
    },
    evidence: [`OAuth flow started for ${integration.name}`],
    nextActions: [`Redirect user to OAuth provider`, `Complete authorization`, `Handle callback`],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
