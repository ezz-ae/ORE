// app/api/freehold/server-ai/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

type ServerRole = 'owner' | 'admin' | 'marketing' | 'sales_manager' | 'sales_agent' | 'data_manager' | 'viewer';
type ServerTopic =
  | 'sales_team'
  | 'agent_private'
  | 'crm'
  | 'campaigns'
  | 'integrations'
  | 'security'
  | 'projects'
  | 'notebook'
  | 'approvals'
  | 'server_status';

export interface ServerAiChatRequest {
  message: string;
  role?: ServerRole;
  accountLevel?: string;
  userId?: string;
  assignedAgentId?: string;
  assignedModules?: string[];
  userRoles?: string[];
}

const ROLE_SCOPES: Record<ServerRole, { label: string; tone: string; allowedTopics: ServerTopic[]; deniedTopics?: ServerTopic[] }> = {
  owner: {
    label: 'Owner',
    tone: 'executive operating partner',
    allowedTopics: ['sales_team', 'agent_private', 'crm', 'campaigns', 'integrations', 'security', 'projects', 'notebook', 'approvals', 'server_status'],
  },
  admin: {
    label: 'Admin',
    tone: 'operations controller',
    allowedTopics: ['sales_team', 'crm', 'campaigns', 'integrations', 'security', 'projects', 'notebook', 'approvals', 'server_status'],
  },
  marketing: {
    label: 'Marketing',
    tone: 'campaign teammate',
    allowedTopics: ['campaigns', 'projects', 'notebook', 'approvals', 'integrations'],
    deniedTopics: ['sales_team', 'agent_private', 'security'],
  },
  sales_manager: {
    label: 'Sales Manager',
    tone: 'sales-floor coach',
    allowedTopics: ['sales_team', 'crm', 'projects', 'notebook', 'approvals', 'campaigns'],
    deniedTopics: ['security', 'integrations'],
  },
  sales_agent: {
    label: 'Sales Agent',
    tone: 'deal support teammate',
    allowedTopics: ['crm', 'projects', 'notebook', 'campaigns'],
    deniedTopics: ['sales_team', 'agent_private', 'security', 'integrations', 'approvals'],
  },
  data_manager: {
    label: 'Data Manager',
    tone: 'data quality operator',
    allowedTopics: ['projects', 'integrations', 'server_status', 'notebook', 'campaigns'],
    deniedTopics: ['sales_team', 'agent_private', 'crm'],
  },
  viewer: {
    label: 'Viewer',
    tone: 'read-only briefing assistant',
    allowedTopics: ['projects', 'campaigns', 'server_status'],
    deniedTopics: ['sales_team', 'agent_private', 'crm', 'integrations', 'security', 'approvals', 'notebook'],
  },
};

const normalizeRole = (body: ServerAiChatRequest, request: NextRequest): ServerRole => {
  const headerRole = request.headers.get('x-freehold-role') as ServerRole | null;
  const role = body.role || headerRole || (body.userRoles?.[0] as ServerRole | undefined) || 'viewer';
  return role in ROLE_SCOPES ? role : 'viewer';
};

const inferTopic = (message: string): ServerTopic => {
  const text = message.toLowerCase();
  if (/agent performance|sales team|team performance|delay by agent|agents?|leaderboard|who is late|salesperson/.test(text)) return 'sales_team';
  if (/other agent|another agent|commission|salary|private note|personal performance/.test(text)) return 'agent_private';
  if (/lead|crm|hubspot|follow.?up|pipeline|duplicate|wrong number/.test(text)) return 'crm';
  if (/ad|campaign|meta|google|landing|creative|lead machine|launch/.test(text)) return 'campaigns';
  if (/integration|connect|token|api|whatsapp|pixel|tracking|billing/.test(text)) return 'integrations';
  if (/security|permission|access|role|user|audit|auth/.test(text)) return 'security';
  if (/notebook|brochure|offer|pdf|caption|script|message draft/.test(text)) return 'notebook';
  if (/approve|approval|review request|pending review/.test(text)) return 'approvals';
  if (/server|status|deploy|vercel|neon|health|domain/.test(text)) return 'server_status';
  return 'projects';
};

const isAllowed = (role: ServerRole, topic: ServerTopic) => {
  const scope = ROLE_SCOPES[role];
  return scope.allowedTopics.includes(topic) && !scope.deniedTopics?.includes(topic);
};

const safePromptForRole = (role: ServerRole) => {
  switch (role) {
    case 'marketing': return 'Ask me which landing pages, campaign angles, creatives, or ad blockers need action today.';
    case 'sales_manager': return 'Ask me which leads need action, which follow-ups are delayed, or what the team should do next.';
    case 'sales_agent': return 'Ask me about your assigned leads, project scripts, WhatsApp drafts, or approved campaign context.';
    case 'data_manager': return 'Ask me which projects have missing fields, weak media, payment-plan gaps, or readiness issues.';
    case 'viewer': return 'Ask me for approved project, campaign, or public status summaries.';
    default: return 'Ask me what needs attention, what is blocked, or what should be approved next.';
  }
};

const restrictedReply = (role: ServerRole, topic: ServerTopic) => {
  const scope = ROLE_SCOPES[role];
  return {
    answer: `I can't show that at ${scope.label} access level. I can answer inside your assigned scope, but ${topic.replace('_', ' ')} requires Owner/Admin approval or a higher role.`,
    cardType: 'permission_guard',
    allowedScope: scope.allowedTopics,
    restrictedTopic: topic,
    nextBestSafeQuestion: safePromptForRole(role),
  };
};

const buildOperationalAnswer = (role: ServerRole, topic: ServerTopic, message: string) => {
  const scope = ROLE_SCOPES[role];
  const opener = `I'm answering as the Freehold private server AI for ${scope.label}. This is internal operator guidance, not public sales copy.`;

  if (topic === 'sales_team') {
    return {
      answer: `${opener} Focus the team on delayed high-intent follow-ups first, then new assignments. Do not expose one agent's private notes to another agent; managers see team-level coaching and assignment risk only.`,
      cardType: 'sales_coaching',
      cards: [
        { title: 'Priority', body: 'Call overdue high-intent leads before adding new lead volume.', severity: 'high' },
        { title: 'Manager view', body: 'Show team queues, delays, and coaching actions. Hide private peer notes from agents.', severity: 'medium' },
      ],
    };
  }

  if (topic === 'crm') {
    const agentScoped = role === 'sales_agent';
    return {
      answer: `${opener} ${agentScoped ? 'I will only use your assigned leads and approved campaign context.' : 'Review hot leads, duplicate risks, source quality, and next-best-actions.'}`,
      cardType: 'crm_alerts',
      cards: [
        { title: agentScoped ? 'Your assigned queue' : 'CRM queue', body: agentScoped ? 'Prioritize your own overdue follow-ups and ask for a message draft.' : 'Prioritize high-intent leads and duplicate-risk cleanup.', severity: 'high' },
      ],
    };
  }

  if (topic === 'campaigns') {
    return {
      answer: `${opener} Lead Machine should show landing readiness, ad blockers, creative gaps, approvals, and the next operational action — not a public project pitch.`,
      cardType: 'lead_machine',
      cards: [
        { title: 'Launch blockers', body: 'Clear billing/access/tracking before paid launch.', severity: 'critical' },
        { title: 'Next action', body: 'Approve landing or create an ad request only when requirements are complete.', severity: 'high' },
      ],
    };
  }

  if (topic === 'integrations') {
    return {
      answer: `${opener} Integration guidance is operational: connect HubSpot, Meta Ads, Google Ads, WhatsApp, tracking, Neon, and Vercel without exposing secrets or tokens.`,
      cardType: 'integration_status',
      cards: [
        { title: 'Safety rule', body: 'No HubSpot writes, ad launches, budget changes, or WhatsApp sends without explicit approval.', severity: 'critical' },
      ],
    };
  }

  if (topic === 'security') {
    return {
      answer: `${opener} Permission boundaries must be enforced before answering: Owner/Admin can inspect system access; role users only see their module scope.`,
      cardType: 'security_guard',
      cards: [{ title: 'RBAC', body: 'Every answer should be filtered by role, assigned modules, and ownership.', severity: 'critical' }],
    };
  }

  if (topic === 'notebook') {
    return {
      answer: `${opener} Notebook output should help the team create sales assets, scripts, offers, brochures, PDFs, captions, and comparison notes using only permitted project/lead context.`,
      cardType: 'notebook_output',
      cards: [{ title: 'Safe generation', body: 'Use project context and role permissions before generating or attaching outputs.', severity: 'medium' }],
    };
  }

  return {
    answer: `${opener} I'll treat this as an internal project/data question. I can give readiness, data quality, missing fields, positioning, and next sales action — but not public visitor lead-capture copy.`,
    cardType: 'project_ops',
    cards: [{ title: 'Operator mode', body: 'Use verified project data, readiness scores, blockers, and assigned next action.', severity: 'medium' }],
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ServerAiChatRequest;
    const message = body.message || '';
    const role = normalizeRole(body, request);
    const topic = inferTopic(message);
    const allowed = isAllowed(role, topic);

    const response: McpResponseEnvelope<any> = {
      requestId: crypto.randomUUID(),
      layer: 'server-ai',
      status: 'success',
      data: allowed ? buildOperationalAnswer(role, topic, message) : restrictedReply(role, topic),
      evidence: [
        'Server AI used private-server persona, not public visitor persona',
        `Role: ${role}`,
        `Detected topic: ${topic}`,
        `Permission: ${allowed ? 'allowed' : 'restricted'}`,
      ],
      warnings: allowed ? [] : [`Restricted answer blocked for role ${role}`],
      nextActions: allowed
        ? ['Return structured operational cards', 'Keep answer inside role scope', 'Require approval before external writes']
        : ['Ask an Owner/Admin for access', safePromptForRole(role)],
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        layer: 'server-ai',
        status: 'error',
        evidence: ['Invalid request'],
        warnings: ['Failed to parse request body'],
        nextActions: ['Send { "message": "What is blocking launch?" }'],
        generatedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
}
