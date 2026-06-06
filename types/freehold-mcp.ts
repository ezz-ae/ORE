// types/freehold-mcp.ts

export type Role = 'owner' | 'admin' | 'marketing' | 'sales_manager' | 'sales_agent' | 'data_manager' | 'viewer' | 'user' | 'agent';

export interface Tool {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  allowedRoles: Role[];
  canWriteExternal: boolean;
  aliases?: string[];
  category?: string;
}

export interface McpResponseEnvelope<T> {
  requestId: string;
  tool?: string;
  layer?: string;
  status: 'success' | 'partial' | 'error' | 'pendingApproval';
  data?: T;
  evidence?: string[];
  warnings?: string[];
  nextActions?: string[];
  fallbackStatus?: string;
  permissionAwareToolAccess?: Record<string, unknown>;
  generatedAt: string;
}

export interface IntegrationStatusCard {
  type: 'IntegrationStatusCard';
  integrationId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'pending' | 'partial' | 'needs_access' | 'not_connected';
  lastSync?: string;
  details?: string;
  connectUrl?: string;
}

export interface LaunchBlockerCard {
  type: 'LaunchBlockerCard';
  blockerId: string;
  message: string;
  resolutionSteps: string[];
  severity?: 'critical' | 'warning' | 'info';
}

export interface RequirementCard {
  type: 'RequirementCard';
  requirementId: string;
  description: string;
  isMet: boolean;
  actionRequired?: string;
}

export interface CrmAlertCard {
  type: 'CrmAlertCard';
  alertId: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  link?: string;
}

export interface LeadMachineCard {
  type: 'LeadMachineCard';
  campaignId: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  performanceSummary: string;
  manageUrl: string;
}

export interface MatrixCard {
  type: 'MatrixCard';
  title: string;
  data: Record<string, any>;
  visualizationType?: 'table' | 'chart';
}

export interface EvidenceCard {
  type: 'EvidenceCard';
  evidenceId: string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  link?: string;
}

export type McpCard = IntegrationStatusCard | LaunchBlockerCard | RequirementCard | CrmAlertCard | LeadMachineCard | MatrixCard | EvidenceCard;
