// lib/freehold/mcp/registry.ts

import { Tool } from '@/types/freehold-mcp';

const readRoles = ['owner', 'admin', 'marketing', 'sales_manager', 'sales_agent', 'data_manager', 'viewer', 'user', 'agent'] as const;
const managerRoles = ['owner', 'admin', 'marketing'] as const;

export const mcpTools: Tool[] = [
  {
    id: 'server-summary',
    aliases: ['server_summary', 'summary', 'server.status'],
    name: 'Server Summary',
    category: 'server',
    description: 'Returns Freehold private-server health, public data counts, pending tasks and launch status.',
    requiresApproval: false,
    allowedRoles: [...readRoles],
    canWriteExternal: false,
  },
  {
    id: 'integration-summary',
    aliases: ['integration_summary', 'integrations', 'crm_connection_status', 'ads_account_status', 'tracking_status'],
    name: 'Integration Summary',
    category: 'integrations',
    description: 'Returns HubSpot, Meta, Google Ads, WhatsApp, tracking, Neon and Vercel connection status.',
    requiresApproval: false,
    allowedRoles: [...readRoles],
    canWriteExternal: false,
  },
  {
    id: 'launch-blockers',
    aliases: ['launch_blockers', 'requirements', 'what_is_blocking_launch'],
    name: 'Launch Blockers',
    category: 'integrations',
    description: 'Returns launch blockers and operational requirements for ads, CRM, WhatsApp, tracking and domain readiness.',
    requiresApproval: false,
    allowedRoles: [...readRoles],
    canWriteExternal: false,
  },
  {
    id: 'project-data',
    aliases: ['project_data', 'project_search', 'listing_search', 'listings'],
    name: 'Project Data',
    category: 'data',
    description: 'Retrieves live Freehold public project/listing data and counts from freehold_site_projects.',
    requiresApproval: false,
    allowedRoles: [...readRoles],
    canWriteExternal: false,
  },
  {
    id: 'lead-machine-summary',
    aliases: ['lead_machine_summary', 'lead-machine-summary', 'lead_machine'],
    name: 'Lead Machine Summary',
    category: 'lead-machine',
    description: 'Returns Lead Machine readiness metrics mapped from live project and landing data.',
    requiresApproval: false,
    allowedRoles: [...readRoles],
    canWriteExternal: false,
  },
  {
    id: 'inventory-analysis',
    aliases: ['inventory_analysis', 'ad_candidates', 'which_to_advertise', 'inventory_ad_analysis'],
    name: 'Inventory Ad Analysis',
    category: 'lead-machine',
    description: 'Ranks properties by ad opportunity (readiness, ROI, lead momentum, data quality, landing status) and returns top picks, fix-first list and missed opportunities.',
    requiresApproval: false,
    allowedRoles: [...readRoles],
    canWriteExternal: false,
  },
  {
    id: 'lead-machine-campaign',
    aliases: ['lead_machine_campaign', 'create_ad_request', 'create_landing_request'],
    name: 'Lead Machine Campaign',
    category: 'lead-machine',
    description: 'Creates or modifies Lead Machine campaign requests. Approval required.',
    requiresApproval: true,
    allowedRoles: [...managerRoles],
    canWriteExternal: true,
  },
  {
    id: 'crm-hubspot-write',
    aliases: ['crm_hubspot_write', 'hubspot_write'],
    name: 'CRM HubSpot Write',
    category: 'crm',
    description: 'Writes data to HubSpot CRM. Approval required.',
    requiresApproval: true,
    allowedRoles: ['owner', 'admin'],
    canWriteExternal: true,
  },
  {
    id: 'meta-ads-launch',
    aliases: ['meta_ads_launch', 'launch_meta_ads'],
    name: 'Meta Ads Launch',
    category: 'ads',
    description: 'Launches or modifies Meta Ads campaigns. Approval required.',
    requiresApproval: true,
    allowedRoles: ['owner', 'admin', 'marketing'],
    canWriteExternal: true,
  },
  {
    id: 'google-ads-budget',
    aliases: ['google_ads_budget', 'change_google_budget'],
    name: 'Google Ads Budget',
    category: 'ads',
    description: 'Changes Google Ads campaign budgets. Approval required.',
    requiresApproval: true,
    allowedRoles: ['owner', 'admin', 'marketing'],
    canWriteExternal: true,
  },
  {
    id: 'whatsapp-send',
    aliases: ['whatsapp_send', 'send_whatsapp'],
    name: 'WhatsApp Send',
    category: 'messaging',
    description: 'Sends messages via WhatsApp. Approval required.',
    requiresApproval: true,
    allowedRoles: ['owner', 'admin', 'sales_manager'],
    canWriteExternal: true,
  },
];

export const getToolById = (id: string): Tool | undefined => {
  const normalized = id?.trim();
  return mcpTools.find(tool => tool.id === normalized || tool.aliases?.includes(normalized));
};
