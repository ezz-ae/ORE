// app/api/freehold/integrations/launch-blockers/route.ts

import { NextResponse } from 'next/server';
import { getLaunchBlockers } from '@/lib/freehold/mcp/mock-integrations';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

export async function GET() {
  const blockers = getLaunchBlockers();
  const criticalBlockers = blockers.filter(b => b.severity === 'critical');

  const response: McpResponseEnvelope<any> = {
    requestId: crypto.randomUUID(),
    status: criticalBlockers.length === 0 ? 'success' : 'error',
    data: {
      blockers: blockers,
      criticalCount: criticalBlockers.length,
      warningCount: blockers.filter(b => b.severity === 'warning').length,
      canLaunch: criticalBlockers.length === 0,
    },
    evidence: [
      `Found ${blockers.length} launch blocker(s)`,
      `Critical: ${criticalBlockers.length}`,
    ],
    warnings: criticalBlockers.length > 0 ? [`Cannot launch: ${criticalBlockers.length} critical issue(s)`] : [],
    nextActions: blockers.map(b => b.resolutionSteps[0]),
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
