import { NextRequest, NextResponse } from 'next/server'
import { McpResponseEnvelope } from '@/types/freehold-mcp'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill, isRoleAllowed } from '@/lib/freehold/ai-skills'

type ServerRole = 'owner' | 'admin' | 'marketing' | 'sales_manager' | 'sales_agent' | 'data_manager' | 'viewer'
type ServerTopic =
  | 'sales_team' | 'agent_private' | 'crm' | 'campaigns'
  | 'integrations' | 'security' | 'projects' | 'notebook'
  | 'approvals' | 'server_status'

export interface ServerAiChatRequest {
  message: string
  role?: ServerRole
  accountLevel?: string
  userId?: string
  sessionId?: string
  context?: Record<string, unknown>
  skill?: string
  assignedAgentId?: string
  assignedModules?: string[]
  userRoles?: string[]
}

const ROLE_SCOPES: Record<ServerRole, { label: string; tone: string; allowedTopics: ServerTopic[]; deniedTopics?: ServerTopic[] }> = {
  owner:         { label: 'Owner',         tone: 'executive operating partner',     allowedTopics: ['sales_team', 'agent_private', 'crm', 'campaigns', 'integrations', 'security', 'projects', 'notebook', 'approvals', 'server_status'] },
  admin:         { label: 'Admin',         tone: 'operations controller',           allowedTopics: ['sales_team', 'crm', 'campaigns', 'integrations', 'security', 'projects', 'notebook', 'approvals', 'server_status'] },
  marketing:     { label: 'Marketing',     tone: 'campaign teammate',               allowedTopics: ['campaigns', 'projects', 'notebook', 'approvals', 'integrations'], deniedTopics: ['sales_team', 'agent_private', 'security'] },
  sales_manager: { label: 'Sales Manager', tone: 'sales-floor coach',               allowedTopics: ['sales_team', 'crm', 'projects', 'notebook', 'approvals', 'campaigns'], deniedTopics: ['security', 'integrations'] },
  sales_agent:   { label: 'Sales Agent',   tone: 'deal support teammate',           allowedTopics: ['crm', 'projects', 'notebook', 'campaigns'], deniedTopics: ['sales_team', 'agent_private', 'security', 'integrations', 'approvals'] },
  data_manager:  { label: 'Data Manager',  tone: 'data quality operator',           allowedTopics: ['projects', 'integrations', 'server_status', 'notebook', 'campaigns'], deniedTopics: ['sales_team', 'agent_private', 'crm'] },
  viewer:        { label: 'Viewer',        tone: 'read-only briefing assistant',    allowedTopics: ['projects', 'campaigns', 'server_status'], deniedTopics: ['sales_team', 'agent_private', 'crm', 'integrations', 'security', 'approvals', 'notebook'] },
}

const normalizeRole = (body: ServerAiChatRequest, request: NextRequest): ServerRole => {
  const headerRole = request.headers.get('x-freehold-role') as ServerRole | null
  const role = body.role || headerRole || (body.userRoles?.[0] as ServerRole | undefined) || 'viewer'
  return role in ROLE_SCOPES ? role : 'viewer'
}

const inferTopic = (message: string): ServerTopic => {
  const t = message.toLowerCase()
  if (/agent performance|sales team|team performance|delay by agent|agents?|leaderboard|who is late|salesperson/.test(t)) return 'sales_team'
  if (/other agent|another agent|commission|salary|private note|personal performance/.test(t))                            return 'agent_private'
  if (/lead|crm|hubspot|follow.?up|pipeline|duplicate|wrong number/.test(t))                                             return 'crm'
  if (/ad|campaign|meta|google|landing|creative|lead machine|launch/.test(t))                                            return 'campaigns'
  if (/integration|connect|token|api|whatsapp|pixel|tracking|billing/.test(t))                                           return 'integrations'
  if (/security|permission|access|role|user|audit|auth/.test(t))                                                         return 'security'
  if (/notebook|brochure|offer|pdf|caption|script|message draft/.test(t))                                                return 'notebook'
  if (/approve|approval|review request|pending review/.test(t))                                                          return 'approvals'
  if (/server|status|deploy|vercel|neon|health|domain/.test(t))                                                          return 'server_status'
  return 'projects'
}

const isAllowed = (role: ServerRole, topic: ServerTopic) => {
  const s = ROLE_SCOPES[role]
  return s.allowedTopics.includes(topic) && !s.deniedTopics?.includes(topic)
}

const safePromptForRole = (role: ServerRole) => {
  switch (role) {
    case 'marketing':     return 'Ask me which landing pages, campaign angles, creatives, or ad blockers need action today.'
    case 'sales_manager': return 'Ask me which leads need action, which follow-ups are delayed, or what the team should do next.'
    case 'sales_agent':   return 'Ask me about your assigned leads, project scripts, WhatsApp drafts, or approved campaign context.'
    case 'data_manager':  return 'Ask me which projects have missing fields, weak media, payment-plan gaps, or readiness issues.'
    case 'viewer':        return 'Ask me for approved project, campaign, or public status summaries.'
    default:              return 'Ask me what needs attention, what is blocked, or what should be approved next.'
  }
}

const restrictedReply = (role: ServerRole, topic: ServerTopic) => {
  const scope = ROLE_SCOPES[role]
  return {
    answer: `I can't show that at ${scope.label} access level. I can answer inside your assigned scope, but ${topic.replace('_', ' ')} requires Owner/Admin approval or a higher role.`,
    cardType: 'permission_guard',
    allowedScope: scope.allowedTopics,
    restrictedTopic: topic,
    nextBestSafeQuestion: safePromptForRole(role),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body     = await request.json() as ServerAiChatRequest
    const message  = body.message || ''
    const role     = normalizeRole(body, request)
    const scope    = ROLE_SCOPES[role]
    const sessionId = body.sessionId ?? `sai-${crypto.randomUUID()}`

    // ── Skill path: a page explicitly selected a specialist (web_designer, etc.) ──
    const skill = getSkill(body.skill)
    if (body.skill && !skill) {
      return NextResponse.json(
        { layer: 'server-ai', status: 'error', data: { answer: `Unknown skill: ${body.skill}` }, generatedAt: new Date().toISOString() },
        { status: 400 },
      )
    }

    let data: Record<string, unknown>
    let topic: ServerTopic = inferTopic(message)
    let allowed: boolean

    if (skill) {
      // Skill is an explicit specialist scope; RBAC is enforced per-skill.
      allowed = isRoleAllowed(skill, role)
      if (allowed) {
        const answer = await queryServerAgent(message, {
          sessionId,
          context: body.context,
          systemPrompt: skill.systemPrompt,
        })
        data = { answer, skill: skill.id, cardType: skill.id, cards: [] }
      } else {
        data = {
          answer: `The ${skill.label} skill isn't available at ${scope.label} access level.`,
          cardType: 'permission_guard',
          restrictedSkill: skill.id,
        }
      }
    } else {
      // Default path: role + inferred topic scope.
      allowed = isAllowed(role, topic)
      if (allowed) {
        const roleSystemPrompt = `You are the private Freehold Intelligence Server AI for the ${scope.label} role (${scope.tone}).

Your allowed scope: ${scope.allowedTopics.join(', ')}.
Topic of this query: ${topic}.

Freehold is a premium Dubai real estate company in UAE. Answer concisely and directly.
Be operational — give specific next actions, message drafts, or data insights.
When drafting messages, write them ready-to-send with no placeholders.
Keep answers under 200 words unless more detail is requested.`

        const answer = await queryServerAgent(message, {
          sessionId,
          context: body.context,
          systemPrompt: roleSystemPrompt,
        })

        data = { answer, cardType: topic, cards: [] }
      } else {
        data = restrictedReply(role, topic)
      }
    }

    const response: McpResponseEnvelope<typeof data> = {
      requestId: crypto.randomUUID(),
      layer: 'server-ai',
      status: 'success',
      data,
      evidence: [`Role: ${role}`, skill ? `Skill: ${skill.id}` : `Topic: ${topic}`, `Permission: ${allowed ? 'allowed' : 'restricted'}`],
      warnings: allowed ? [] : [`Restricted answer blocked for role ${role}`],
      nextActions: allowed
        ? ['Return structured operational cards', 'Keep answer inside scope']
        : ['Ask an Owner/Admin for access', safePromptForRole(role)],
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        layer: 'server-ai',
        status: 'error',
        data: { answer: `Server AI error: ${msg}` },
        evidence: ['Request processing failed'],
        warnings: [msg],
        nextActions: ['Check VERTEX_AI_SERVICE_ACCOUNT_JSON environment variable'],
        generatedAt: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
