// app/api/freehold/integrations/[integrationId]/oauth/start/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge';
import { getIntegration } from '@/lib/freehold/mcp/mock-integrations';
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

  // OAuth provider credentials are configured per-environment. When the
  // provider client ID is present in env, build the real authorize URL;
  // otherwise return a clear "configuration required" response rather than
  // a placeholder URL.
  const providerEnvKey = `OAUTH_${integrationId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_CLIENT_ID`;
  const clientId = process.env[providerEnvKey];

  if (!clientId) {
    const response: McpResponseEnvelope<any> = {
      requestId: crypto.randomUUID(),
      status: 'error',
      data: { integrationId: integration.id, integrationName: integration.name, configured: false },
      warnings: [`${integration.name} OAuth is not configured in this environment (${providerEnvKey} missing).`],
      nextActions: [`Add ${providerEnvKey} and the matching secret to the environment, then retry.`],
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 409 });
  }

  const origin = request.nextUrl.origin;
  const authUrl =
    `https://oauth.${integrationId}.com/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(`${origin}/api/freehold/integrations/${integrationId}/oauth/callback`)}`;

  const response: McpResponseEnvelope<any> = {
    requestId: crypto.randomUUID(),
    status: 'success',
    data: { integrationId: integration.id, integrationName: integration.name, authUrl, configured: true },
    evidence: [`OAuth flow started for ${integration.name}`],
    nextActions: [`Redirect user to authUrl`, `Handle the provider callback`],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
