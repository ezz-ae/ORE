// app/api/freehold/server-ai/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { executeTool } from '@/lib/freehold/mcp/execute-tool';
import { McpResponseEnvelope, Role } from '@/types/freehold-mcp';

export interface ServerAiChatRequest {
  message: string;
  userRoles?: Role[];
  role?: Role;
}

function inferTool(message: string) {
  const normalized = message.toLowerCase();
  if (/(block|requirement|billing|access|pixel|tracking|launch)/.test(normalized)) return 'launch_blockers';
  if (/(integration|hubspot|crm|meta|google|ads account|whatsapp|vercel|neon)/.test(normalized)) return 'integration_summary';
  if (/(lead machine|landing|ad ready|ready for ads|campaign)/.test(normalized)) return 'lead_machine_summary';
  if (/(project|listing|developer|area)/.test(normalized)) return 'project_search';
  return 'server_summary';
}

function operatorAnswer(tool: string, data: any) {
  if (tool === 'launch_blockers') {
    const count = data?.blockers?.length || 0;
    return `I found ${count} open launch requirement(s). Critical blockers must be cleared before ads, WhatsApp sends, or external writes are allowed.`;
  }
  if (tool === 'integration_summary') {
    return `Integration status is mapped. ${data?.connectedCount || 0}/${data?.total || 0} systems are connected; ${data?.blockedCount || 0} still need access or setup.`;
  }
  if (tool === 'lead_machine_summary') {
    return `Lead Machine is using live Freehold project data: ${data?.totalListings || 0} listings, ${data?.landingPagesReady || 0} landing pages ready, ${data?.blockedByAccess || 0} blockers.`;
  }
  if (tool === 'project_search') {
    return `I pulled live project/listing records from the Freehold public data layer.`;
  }
  return `I reviewed the Freehold private server state and routed your question through the MCP layer.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ServerAiChatRequest;
    const selectedTool = inferTool(body.message || '');
    const toolResponse = await executeTool({ tool: selectedTool, args: { search: body.message, limit: 10 }, userRoles: body.userRoles, role: body.role });

    const response: McpResponseEnvelope<any> = {
      requestId: crypto.randomUUID(),
      layer: 'server-ai',
      status: toolResponse.status === 'error' ? 'partial' : 'success',
      data: {
        answer: operatorAnswer(selectedTool, toolResponse.data),
        routedTool: selectedTool,
        toolResult: toolResponse.data,
        cards: toolResponse.data?.blockers || toolResponse.data?.integrations || toolResponse.data?.projects || [],
      },
      evidence: ['Server AI inferred intent and executed a read-only MCP tool', ...(toolResponse.evidence || [])],
      warnings: toolResponse.warnings || [],
      nextActions: toolResponse.nextActions || [],
      fallbackStatus: toolResponse.fallbackStatus,
      permissionAwareToolAccess: toolResponse.permissionAwareToolAccess,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        layer: 'server-ai',
        status: 'error',
        evidence: ['Invalid request'],
        warnings: ['Failed to parse request body'],
        nextActions: ['Send { "message": "What is blocking launch?" }'],
        generatedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
}
