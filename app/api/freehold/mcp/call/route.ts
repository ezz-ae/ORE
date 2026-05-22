// app/api/freehold/mcp/call/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { executeTool, ToolCallRequest } from '@/lib/freehold/mcp/execute-tool';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ToolCallRequest;

      const response = await executeTool(body);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        status: 'error',
        evidence: ['Invalid request'],
        warnings: ['Failed to parse request body'],
        generatedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
}
