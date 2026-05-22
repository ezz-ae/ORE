// app/api/freehold/integrations/launch-blockers/route.ts

import { NextResponse } from 'next/server';
import { executeTool } from '@/lib/freehold/mcp/execute-tool';

export async function GET() {
  const response = await executeTool({ tool: 'launch_blockers', role: 'owner' });
  return NextResponse.json(response);
}
