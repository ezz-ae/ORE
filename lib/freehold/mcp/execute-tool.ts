// lib/freehold/mcp/execute-tool.ts

import { McpResponseEnvelope } from '@/types/freehold-mcp';
import { getToolById } from '@/lib/freehold/mcp/registry';
import { userHasRole, isActionApproved } from '@/lib/freehold/mcp/permissions';
import { Role } from '@/types/freehold-mcp';

export interface ToolCallRequest {
  toolName: string;
  args: Record<string, any>;
  userRoles?: Role[];
}

export async function executeTool(request: ToolCallRequest): Promise<McpResponseEnvelope<any>> {
  const requestId = crypto.randomUUID();
  const userRoles = request.userRoles || ['user'];

  const tool = getToolById(request.toolName);

  if (!tool) {
    return {
      requestId,
      status: 'error',
      evidence: ['Tool not found'],
      warnings: [`Unknown tool: ${request.toolName}`],
      generatedAt: new Date().toISOString(),
    };
  }

  // Check if user has allowed roles
  if (!userHasRole(userRoles, tool.allowedRoles)) {
    return {
      requestId,
      status: 'error',
      evidence: ['Insufficient permissions'],
      warnings: [`User does not have permission to execute tool: ${tool.name}`],
      nextActions: ['Contact administrator for access'],
      generatedAt: new Date().toISOString(),
    };
  }

  // Check if approval is required
  if (tool.requiresApproval && !isActionApproved(tool.requiresApproval, userRoles)) {
    return {
      requestId,
      tool: tool.id,
      status: 'pendingApproval',
      evidence: ['Approval required'],
      warnings: [`Tool execution requires admin approval: ${tool.name}`],
      nextActions: ['Request approval from administrator'],
      generatedAt: new Date().toISOString(),
    };
  }

  // Check for external write restrictions
  if (tool.canWriteExternal) {
    return {
      requestId,
      tool: tool.id,
      status: 'pendingApproval',
      evidence: ['External write action detected'],
      warnings: [`This action will modify external systems: ${tool.name}`],
      nextActions: ['Confirm intent and request approval'],
      generatedAt: new Date().toISOString(),
    };
  }

  // Execute the tool
  try {
    let result;
    switch (request.toolName) {
      case 'server-summary':
        result = getMockServerSummary();
        break;
      case 'project-data':
        result = getMockProjectData(request.args);
        break;
      // Add other tool execution cases as needed
      default:
        result = { mock: true, message: `Mock execution of ${tool.name}` };
    }

    return {
      requestId,
      tool: tool.id,
      status: 'success',
      data: result,
      evidence: ['Tool executed successfully'],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      requestId,
      tool: tool.id,
      status: 'error',
      evidence: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: ['Tool execution failed'],
      generatedAt: new Date().toISOString(),
    };
  }
}

function getMockServerSummary() {
  return {
    health: 'healthy',
    uptime: '99.9%',
    lastHealthCheck: new Date().toISOString(),
  };
}

function getMockProjectData(args: Record<string, any>) {
  return {
    projects: [
      { id: 'proj-1', name: 'Downtown Lofts', status: 'active' },
      { id: 'proj-2', name: 'Waterfront Properties', status: 'active' },
    ],
    listings: [
      { id: 'list-1', projectId: 'proj-1', address: '123 Main St', price: 450000 },
      { id: 'list-2', projectId: 'proj-2', address: '456 River Rd', price: 750000 },
    ],
  };
}
