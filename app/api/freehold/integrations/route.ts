// app/api/freehold/integrations/route.ts

import { NextResponse } from 'next/server';
import { getAllIntegrations } from '@/lib/freehold/mcp/mock-integrations';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function GET() {
  const integrations = getAllIntegrations();

  const response: McpResponseEnvelope<any> = {
    requestId: crypto.randomUUID(),
    status: 'success',
    data: integrations,
    evidence: [`Retrieved ${integrations.length} integrations`],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
