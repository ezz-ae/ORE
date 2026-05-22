// lib/freehold/mcp/mock-integrations.ts

export interface Integration {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'pending';
  description: string;
  logo?: string;
  lastSync?: string;
  syncStatus?: 'success' | 'failed' | 'in_progress';
}

export interface IntegrationDetails extends Integration {
  requirements: Requirement[];
  syncLogs: SyncLog[];
  configuration?: Record<string, any>;
}

export interface Requirement {
  id: string;
  name: string;
  description: string;
  isMet: boolean;
  severity: 'required' | 'optional';
}

export interface SyncLog {
  id: string;
  timestamp: string;
  status: 'success' | 'failed';
  message: string;
  recordsProcessed?: number;
}

export interface LaunchBlocker {
  id: string;
  integrationId: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  resolutionSteps: string[];
}

export const mockIntegrations: Integration[] = [
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    status: 'disconnected',
    description: 'Connect to HubSpot for CRM management',
    lastSync: undefined,
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    status: 'disconnected',
    description: 'Manage Meta Ads campaigns',
    lastSync: undefined,
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    status: 'disconnected',
    description: 'Manage Google Ads campaigns',
    lastSync: undefined,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    status: 'disconnected',
    description: 'Send WhatsApp messages',
    lastSync: undefined,
  },
  {
    id: 'tracking',
    name: 'Tracking & Pixels',
    status: 'disconnected',
    description: 'Setup conversion pixels and tracking',
    lastSync: undefined,
  },
  {
    id: 'neon',
    name: 'Neon Database',
    status: 'pending',
    description: 'Database health and monitoring',
    lastSync: new Date(Date.now() - 3600000).toISOString(),
    syncStatus: 'in_progress',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    status: 'pending',
    description: 'Deployment and monitoring',
    lastSync: new Date(Date.now() - 7200000).toISOString(),
    syncStatus: 'success',
  },
];

export const mockIntegrationDetails: Record<string, IntegrationDetails> = {
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot CRM',
    status: 'disconnected',
    description: 'Connect to HubSpot for CRM management',
    requirements: [
      {
        id: 'hs-api-key',
        name: 'HubSpot API Key',
        description: 'Valid HubSpot API key required',
        isMet: false,
        severity: 'required',
      },
      {
        id: 'hs-scope-contacts',
        name: 'Contacts Scope',
        description: 'Read and write contacts access',
        isMet: false,
        severity: 'required',
      },
      {
        id: 'hs-scope-companies',
        name: 'Companies Scope',
        description: 'Read and write companies access',
        isMet: false,
        severity: 'optional',
      },
    ],
    syncLogs: [
      {
        id: 'sync-1',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        status: 'failed',
        message: 'Connection failed: Invalid credentials',
        recordsProcessed: 0,
      },
    ],
  },
  'meta-ads': {
    id: 'meta-ads',
    name: 'Meta Ads',
    status: 'disconnected',
    description: 'Manage Meta Ads campaigns',
    requirements: [
      {
        id: 'meta-app-id',
        name: 'App ID',
        description: 'Facebook/Meta App ID',
        isMet: false,
        severity: 'required',
      },
      {
        id: 'meta-token',
        name: 'Access Token',
        description: 'Valid access token',
        isMet: false,
        severity: 'required',
      },
    ],
    syncLogs: [],
  },
  'google-ads': {
    id: 'google-ads',
    name: 'Google Ads',
    status: 'disconnected',
    description: 'Manage Google Ads campaigns',
    requirements: [
      {
        id: 'ga-customer-id',
        name: 'Customer ID',
        description: 'Google Ads Customer ID',
        isMet: false,
        severity: 'required',
      },
      {
        id: 'ga-token',
        name: 'OAuth Token',
        description: 'Valid OAuth token',
        isMet: false,
        severity: 'required',
      },
    ],
    syncLogs: [],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    status: 'disconnected',
    description: 'Send WhatsApp messages',
    requirements: [
      {
        id: 'wa-business-account',
        name: 'Business Account',
        description: 'WhatsApp Business Account',
        isMet: false,
        severity: 'required',
      },
      {
        id: 'wa-token',
        name: 'Access Token',
        description: 'Valid access token',
        isMet: false,
        severity: 'required',
      },
    ],
    syncLogs: [],
  },
  tracking: {
    id: 'tracking',
    name: 'Tracking & Pixels',
    status: 'disconnected',
    description: 'Setup conversion pixels and tracking',
    requirements: [
      {
        id: 'track-pixel-code',
        name: 'Pixel Code',
        description: 'Tracking pixel code installed',
        isMet: false,
        severity: 'required',
      },
    ],
    syncLogs: [],
  },
  neon: {
    id: 'neon',
    name: 'Neon Database',
    status: 'pending',
    description: 'Database health and monitoring',
    requirements: [
      {
        id: 'neon-connection',
        name: 'Database Connection',
        description: 'Active database connection',
        isMet: true,
        severity: 'required',
      },
      {
        id: 'neon-credentials',
        name: 'Valid Credentials',
        description: 'Database credentials are valid',
        isMet: true,
        severity: 'required',
      },
    ],
    syncLogs: [
      {
        id: 'sync-neon-1',
        timestamp: new Date().toISOString(),
        status: 'success',
        message: 'Connection verified',
        recordsProcessed: 1500,
      },
    ],
  },
  vercel: {
    id: 'vercel',
    name: 'Vercel',
    status: 'pending',
    description: 'Deployment and monitoring',
    requirements: [
      {
        id: 'vercel-project',
        name: 'Project Linked',
        description: 'Vercel project is linked',
        isMet: true,
        severity: 'required',
      },
      {
        id: 'vercel-token',
        name: 'API Token',
        description: 'Valid API token',
        isMet: true,
        severity: 'required',
      },
    ],
    syncLogs: [
      {
        id: 'sync-vercel-1',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        status: 'success',
        message: 'Deployment verified',
        recordsProcessed: 2,
      },
    ],
  },
};

export const mockLaunchBlockers: LaunchBlocker[] = [
  {
    id: 'blocker-1',
    integrationId: 'hubspot',
    message: 'HubSpot CRM is not connected',
    severity: 'critical',
    resolutionSteps: [
      'Navigate to Integration Dashboard',
      'Click "Connect HubSpot"',
      'Authorize Freehold to access HubSpot',
      'Configure required scopes',
    ],
  },
  {
    id: 'blocker-2',
    integrationId: 'meta-ads',
    message: 'Meta Ads integration is required for campaign launching',
    severity: 'critical',
    resolutionSteps: [
      'Navigate to Integration Dashboard',
      'Click "Connect Meta Ads"',
      'Select your Meta Business Account',
      'Grant necessary permissions',
    ],
  },
  {
    id: 'blocker-3',
    integrationId: 'tracking',
    message: 'Tracking pixels are not configured',
    severity: 'warning',
    resolutionSteps: [
      'Copy the tracking pixel code from Integration Dashboard',
      'Install pixel in your website header',
      'Test pixel with the provided test tool',
    ],
  },
];

export function getIntegration(id: string): Integration | undefined {
  return mockIntegrations.find(int => int.id === id);
}

export function getIntegrationDetails(id: string): IntegrationDetails | undefined {
  return mockIntegrationDetails[id];
}

export function getAllIntegrations(): Integration[] {
  return mockIntegrations;
}

export function getLaunchBlockers(): LaunchBlocker[] {
  return mockLaunchBlockers;
}
