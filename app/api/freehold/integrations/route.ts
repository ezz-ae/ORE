// app/api/freehold/integrations/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { executeTool } from '@/lib/freehold/mcp/execute-tool';
import type { Role } from '@/types/freehold-mcp';
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Session-gated, and the role comes from the real session — no hardcoded
  // 'owner' privilege on an open endpoint.
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const response = await executeTool({ tool: 'integration_summary', role: (user.role ?? 'viewer') as unknown as Role });
  return NextResponse.json(response);
}
