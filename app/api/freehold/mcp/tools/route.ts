// app/api/freehold/mcp/tools/route.ts

import { NextResponse } from 'next/server';
import { mcpTools } from '@/lib/freehold/mcp/registry';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function GET() {
  const response: McpResponseEnvelope<any[]> = {
    requestId: crypto.randomUUID(),
    status: 'success',
    data: mcpTools.map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
      canWriteExternal: tool.canWriteExternal,
    })), // Return a subset of tool info for listing
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
