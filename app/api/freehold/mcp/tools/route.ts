// app/api/freehold/mcp/tools/route.ts

import { NextResponse } from 'next/server';
import { mcpTools } from '@/lib/freehold/mcp/registry';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function GET() {
  const response: McpResponseEnvelope<any[]> = {
    requestId: crypto.randomUUID(),
    layer: 'mcp',
    status: 'success',
    data: mcpTools.map(tool => ({
      id: tool.id,
      aliases: tool.aliases || [],
      name: tool.name,
      category: tool.category,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
      canWriteExternal: tool.canWriteExternal,
      allowedRoles: tool.allowedRoles,
    })),
    evidence: [`Registered ${mcpTools.length} Freehold MCP tools`],
    nextActions: ['Call POST /api/freehold/mcp/call with { "tool": "integration_summary" }'],
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
