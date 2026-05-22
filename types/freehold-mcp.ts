// types/freehold-mcp.ts

export type Role = 'admin' | 'user' | 'agent'; // Example roles, extend as needed

export interface Tool {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  allowedRoles: Role[];
  canWriteExternal: boolean;
  // Add other tool-specific properties as needed
}

export interface McpResponseEnvelope<T> {
  requestId: string;
  tool?: string;
  layer?: string;
  status: 'success' | 'error' | 'pendingApproval';
  data?: T;
  evidence?: string[];
  warnings?: string[];
  nextActions?: string[];
  generatedAt: string;
}

export interface IntegrationStatusCard {
  type: 'IntegrationStatusCard';
  integrationId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'pending';
  lastSync?: string;
  details?: string;
  connectUrl?: string;
}

export interface LaunchBlockerCard {
  type: 'LaunchBlockerCard';
  blockerId: string;
  message: string;
  resolutionSteps: string[];
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
  data: Record<string, any>; // Flexible for various matrix data
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
