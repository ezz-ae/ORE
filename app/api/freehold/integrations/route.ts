// app/api/freehold/integrations/route.ts

import { NextResponse } from 'next/server';
import { executeTool } from '@/lib/freehold/mcp/execute-tool';

export async function GET() {
  const response = await executeTool({ tool: 'integration_summary', role: 'owner' });
  return NextResponse.json(response);
}
