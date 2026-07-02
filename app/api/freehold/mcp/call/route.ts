// app/api/freehold/mcp/call/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { executeTool, ToolCallRequest } from '@/lib/freehold/mcp/execute-tool';
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge';
import type { Role as SessionRole } from '@/lib/freehold/session-types';
import type { Role as McpRole } from '@/types/freehold-mcp';

// Session role → MCP tool-authorization role. Derived server-side from the
// verified session so a client can NEVER escalate by putting role/userRoles in
// the request body (that was the pre-P0 hole: body role defaulted to 'owner').
const SESSION_TO_MCP: Record<SessionRole, McpRole> = {
  broker: 'sales_agent',
  admin: 'admin',
  sales_manager: 'sales_manager',
  director: 'admin',
  ceo: 'owner',
  marketing: 'marketing',
};

export async function POST(request: NextRequest) {
  try {
    const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ToolCallRequest;
    // Ignore any client-supplied identity/role; roles come only from the session.
    const { role: _ignoredRole, userRoles: _ignoredRoles, ...safeBody } = body;
    const response = await executeTool({
      ...safeBody,
      userRoles: [SESSION_TO_MCP[user.role] ?? 'viewer'],
    });
    return NextResponse.json(response, { status: response.status === 'error' ? 400 : 200 });
  } catch {
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        layer: 'mcp',
        status: 'error',
        evidence: ['Invalid request'],
        warnings: ['Failed to parse request body'],
        nextActions: ['Send JSON body with tool/toolName/name and optional args'],
        generatedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
}
