// lib/freehold/mcp/execute-tool.ts

import { McpResponseEnvelope, Role } from '@/types/freehold-mcp';
import { getToolById } from '@/lib/freehold/mcp/registry';
import { userHasRole, isActionApproved } from '@/lib/freehold/mcp/permissions';
import { getAllIntegrations, getLaunchBlockers } from '@/lib/freehold/mcp/mock-integrations';
import { query } from '@/lib/db';

export interface ToolCallRequest {
  toolName?: string;
  tool?: string;
  name?: string;
  id?: string;
  args?: Record<string, any>;
  parameters?: Record<string, any>;
  input?: Record<string, any>;
  userRoles?: Role[];
  role?: Role;
}

const now = () => new Date().toISOString();

function normalizeToolName(request: ToolCallRequest): string {
  return request.toolName || request.tool || request.name || request.id || '';
}

function normalizeArgs(request: ToolCallRequest): Record<string, any> {
  return request.args || request.parameters || request.input || {};
}

export async function executeTool(request: ToolCallRequest): Promise<McpResponseEnvelope<any>> {
  const requestId = crypto.randomUUID();
  const userRoles = request.userRoles?.length ? request.userRoles : [request.role || 'owner'];
  const requestedToolName = normalizeToolName(request);
  const args = normalizeArgs(request);
  const tool = getToolById(requestedToolName);

  if (!tool) {
    return {
      requestId,
      tool: requestedToolName || undefined,
      layer: 'mcp',
      status: 'error',
      evidence: ['Tool not found in Freehold MCP registry'],
      warnings: [`Unknown tool: ${requestedToolName || 'undefined'}`],
      nextActions: ['Call GET /api/freehold/mcp/tools and retry with a listed id or alias'],
      generatedAt: now(),
    };
  }

  if (!userHasRole(userRoles, tool.allowedRoles)) {
    return {
      requestId,
      tool: tool.id,
      layer: 'mcp',
      status: 'error',
      evidence: ['Permission check failed'],
      warnings: [`User role cannot execute tool: ${tool.name}`],
      nextActions: ['Ask an Owner/Admin to approve access'],
      permissionAwareToolAccess: { requestedRoles: userRoles, allowedRoles: tool.allowedRoles },
      generatedAt: now(),
    };
  }

  if (tool.requiresApproval && !isActionApproved(tool.requiresApproval, userRoles)) {
    return {
      requestId,
      tool: tool.id,
      layer: 'mcp',
      status: 'pendingApproval',
      evidence: ['Approval required before external write'],
      warnings: [`Tool execution requires approval: ${tool.name}`],
      nextActions: ['Create approval request', 'Do not write to HubSpot, ads or WhatsApp until approved'],
      permissionAwareToolAccess: { requestedRoles: userRoles, allowedRoles: tool.allowedRoles, requiresApproval: true },
      generatedAt: now(),
    };
  }

  if (tool.canWriteExternal) {
    return {
      requestId,
      tool: tool.id,
      layer: 'mcp',
      status: 'pendingApproval',
      evidence: ['External write action detected'],
      warnings: [`This action can modify external systems: ${tool.name}`],
      nextActions: ['Confirm intent', 'Request approval', 'Log the approved action before execution'],
      permissionAwareToolAccess: { requestedRoles: userRoles, canWriteExternal: true },
      generatedAt: now(),
    };
  }

  try {
    let result;
    let evidence: string[] = [];
    let warnings: string[] = [];
    let nextActions: string[] = [];
    let fallbackStatus = 'live';

    switch (tool.id) {
      case 'server-summary': {
        result = await getServerSummary();
        evidence = ['Queried freehold_private_dashboard when available'];
        nextActions = ['Review open tasks', 'Resolve custom-domain DNS', 'Connect CRM and ad accounts'];
        break;
      }
      case 'integration-summary': {
        result = await getIntegrationSummary();
        evidence = ['Read integration connection registry or mock fallback'];
        warnings = result.blockedCount > 0 ? [`${result.blockedCount} integration blocker(s) still open`] : [];
        nextActions = ['Connect HubSpot CRM', 'Grant Meta/Google Ads access', 'Configure tracking and WhatsApp'];
        fallbackStatus = result.fallbackStatus;
        break;
      }
      case 'launch-blockers': {
        result = await getLaunchBlockerSummary();
        evidence = ['Read integration requirements or mock launch blockers'];
        warnings = result.criticalCount > 0 ? [`${result.criticalCount} critical launch blocker(s)`] : [];
        nextActions = result.blockers.slice(0, 5).map((blocker: any) => blocker.nextAction || blocker.resolutionSteps?.[0] || blocker.title || blocker.message);
        fallbackStatus = result.fallbackStatus;
        break;
      }
      case 'project-data': {
        result = await getProjectData(args);
        evidence = ['Queried freehold_site_projects'];
        nextActions = ['Use projectId to inspect landing/ad readiness', 'Open Lead Machine matrix for prioritization'];
        break;
      }
      case 'lead-machine-summary': {
        result = await getLeadMachineSummary();
        evidence = ['Mapped Lead Machine metrics from freehold_site_projects and landing tables'];
        nextActions = ['Prioritize listings with active landing pages', 'Resolve blockers before ad launch'];
        break;
      }
      default:
        result = { mock: true, message: `Read-only MCP tool registered: ${tool.name}` };
        fallbackStatus = 'mock';
        evidence = ['Registered tool has no read handler yet'];
        nextActions = ['Implement tool-specific handler'];
    }

    return {
      requestId,
      tool: tool.id,
      layer: 'mcp',
      status: 'success',
      data: result,
      evidence,
      warnings,
      nextActions,
      fallbackStatus,
      permissionAwareToolAccess: { requestedRoles: userRoles, allowedRoles: tool.allowedRoles, canWriteExternal: tool.canWriteExternal },
      generatedAt: now(),
    };
  } catch (error) {
    return {
      requestId,
      tool: tool.id,
      layer: 'mcp',
      status: 'error',
      evidence: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: ['Tool execution failed'],
      nextActions: ['Check Neon connection and route logs'],
      generatedAt: now(),
    };
  }
}

async function getServerSummary() {
  const rows = await query<any>('SELECT * FROM freehold_private_dashboard LIMIT 1');
  if (rows[0]) {
    return {
      health: 'operational',
      publicData: {
        totalProjects: Number(rows[0].total_projects || 0),
        totalDevelopers: Number(rows[0].total_developers || 0),
        totalAreas: Number(rows[0].total_areas || 0),
      },
      privateServer: {
        activeUsers: Number(rows[0].active_users || 0),
        milestonesDone: Number(rows[0].milestones_done || 0),
        milestonesTotal: Number(rows[0].milestones_total || 0),
        openTasks: Number(rows[0].open_tasks || 0),
        auditEvents24h: Number(rows[0].audit_events_24h || 0),
      },
    };
  }
  return { health: 'fallback', publicData: { totalProjects: 0 }, privateServer: { openTasks: 0 } };
}

async function getIntegrationSummary() {
  const rows = await query<any>('SELECT * FROM freehold_integration_connections ORDER BY category, name');
  if (rows.length) {
    const connectedCount = rows.filter(row => row.status === 'connected').length;
    const blockedCount = rows.filter(row => ['needs_access', 'not_connected', 'blocked'].includes(row.status)).length;
    return { fallbackStatus: 'live', total: rows.length, connectedCount, blockedCount, integrations: rows };
  }
  const integrations = getAllIntegrations();
  return { fallbackStatus: 'mock', total: integrations.length, connectedCount: integrations.filter(i => i.status === 'connected').length, blockedCount: integrations.filter(i => i.status !== 'connected').length, integrations };
}

async function getLaunchBlockerSummary() {
  const rows = await query<any>("SELECT * FROM freehold_integration_requirements WHERE status NOT IN ('done', 'closed', 'resolved') ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, due_date NULLS LAST");
  if (rows.length) {
    return {
      fallbackStatus: 'live',
      blockers: rows,
      criticalCount: rows.filter(row => row.severity === 'critical').length,
      warningCount: rows.filter(row => ['high', 'medium'].includes(row.severity)).length,
      canLaunch: rows.filter(row => row.severity === 'critical').length === 0,
    };
  }
  const blockers = getLaunchBlockers();
  return { fallbackStatus: 'mock', blockers, criticalCount: blockers.filter(b => b.severity === 'critical').length, warningCount: blockers.filter(b => b.severity === 'warning').length, canLaunch: blockers.filter(b => b.severity === 'critical').length === 0 };
}

async function getProjectData(args: Record<string, any>) {
  const limit = Math.min(Number(args.limit || 20), 100);
  const search = args.search ? `%${String(args.search)}%` : null;
  const rows = await query<any>(`
    SELECT id, slug, name, area, developer_name AS developer, hero_image AS image_url,
           price_from_aed AS starting_price,
           COALESCE(payload->>'payment_plan', payload->>'paymentPlan') AS payment_plan,
           handover_date AS handover,
           area_type AS property_type
    FROM freehold_site_projects
    WHERE ($1::text IS NULL OR name ILIKE $1 OR area ILIKE $1 OR developer_name ILIKE $1)
    ORDER BY updated_at DESC NULLS LAST, name ASC
    LIMIT $2
  `, [search, limit]);
  const counts = await query<any>('SELECT COUNT(*)::int AS total_projects, COUNT(DISTINCT developer_name)::int AS total_developers, COUNT(DISTINCT area)::int AS total_areas FROM freehold_site_projects');
  return { counts: counts[0] || {}, projects: rows };
}

async function getLeadMachineSummary() {
  const rows = await query<any>(`
    WITH project_counts AS (
      SELECT COUNT(*)::int AS total_listings FROM freehold_site_projects
    ), landing_counts AS (
      SELECT COUNT(DISTINCT project_slug)::int AS landing_pages_total,
             COUNT(DISTINCT project_slug) FILTER (WHERE COALESCE(status, publish_status, '') NOT ILIKE '%draft%')::int AS landing_pages_ready,
             COUNT(DISTINCT project_slug) FILTER (WHERE COALESCE(status, publish_status, '') ILIKE '%draft%')::int AS landing_pages_draft
      FROM freehold_site_project_landing_pages
    ), requirements AS (
      SELECT COUNT(*)::int AS blocked
      FROM freehold_integration_requirements
      WHERE status NOT IN ('done', 'closed', 'resolved')
    )
    SELECT project_counts.total_listings,
           COALESCE(landing_counts.landing_pages_total, 0)::int AS landing_pages_total,
           COALESCE(landing_counts.landing_pages_ready, 0)::int AS landing_pages_ready,
           COALESCE(landing_counts.landing_pages_draft, 0)::int AS landing_pages_draft,
           GREATEST(project_counts.total_listings - COALESCE(landing_counts.landing_pages_total, 0), 0)::int AS missing_landing_pages,
           COALESCE(landing_counts.landing_pages_ready, 0)::int AS ads_ready,
           COALESCE(requirements.blocked, 0)::int AS blocked_by_access
    FROM project_counts, landing_counts, requirements
  `);
  const row = rows[0] || { total_listings: 0, landing_pages_ready: 0, missing_landing_pages: 0, ads_ready: 0, blocked_by_access: 0 };
  return {
    totalListings: Number(row.total_listings),
    landingPagesReady: Number(row.landing_pages_ready),
    missingLandingPages: Number(row.missing_landing_pages),
    adsReady: Number(row.ads_ready),
    pendingAdRequests: 0,
    pendingLandingReviews: Number(row.landing_pages_draft || 0),
    blockedByAccess: Number(row.blocked_by_access),
    missingData: Number(row.missing_landing_pages),
    approvedForLaunch: Number(row.ads_ready),
    aiRecommendedActions: Math.min(Number(row.blocked_by_access) + 3, 10),
  };
}
