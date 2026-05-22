// lib/freehold/mcp/registry.ts

import { Tool, Role } from '@/types/freehold-mcp';

export const mcpTools: Tool[] = [
  {
    id: 'server-summary',
    name: 'Server Summary',
    description: 'Provides a summary of the servers health and status.',
    requiresApproval: false,
    allowedRoles: ['admin', 'user', 'agent'],
    canWriteExternal: false,
  },
  {
    id: 'project-data',
    name: 'Project Data',
    description: 'Retrieves data related to projects and listings.',
    requiresApproval: false,
    allowedRoles: ['admin', 'user', 'agent'],
    canWriteExternal: false,
  },
  {
    id: 'lead-machine-campaign',
    name: 'Lead Machine Campaign',
    description: 'Manages Lead Machine campaigns.',
    requiresApproval: true,
    allowedRoles: ['admin'],
    canWriteExternal: true,
  },
  {
    id: 'crm-hubspot-write',
    name: 'CRM HubSpot Write',
    description: 'Writes data to HubSpot CRM.',
    requiresApproval: true,
    allowedRoles: ['admin'],
    canWriteExternal: true,
  },
  {
    id: 'meta-ads-launch',
    name: 'Meta Ads Launch',
    description: 'Launches or modifies Meta Ads campaigns.',
    requiresApproval: true,
    allowedRoles: ['admin'],
    canWriteExternal: true,
  },
  {
    id: 'google-ads-budget',
    name: 'Google Ads Budget',
    description: 'Changes Google Ads campaign budgets.',
    requiresApproval: true,
    allowedRoles: ['admin'],
    canWriteExternal: true,
  },
  {
    id: 'whatsapp-send',
    name: 'WhatsApp Send',
    description: 'Sends messages via WhatsApp.',
    requiresApproval: true,
    allowedRoles: ['admin'],
    canWriteExternal: true,
  },
  // Add other mock tools as needed based on the brief
];

export const getToolById = (id: string): Tool | undefined => {
  return mcpTools.find(tool => tool.id === id);
};
