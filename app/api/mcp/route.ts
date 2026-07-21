// app/api/mcp/route.ts
//
// ORE as a remote MCP server. The user connects their OWN model (Claude, GPT or
// Gemini) to this endpoint with a personal token and drives the platform from
// their chat. Same Model Context Protocol as the outbound Vercel/GitHub
// connectors — pointed inward. Reads are exposed as direct tools; every write
// funnels through the one `ore_agent` tool, which runs with the token's role and
// stages external writes as gated approval intents (never a blank cheque).
//
// Transport: Streamable HTTP, stateless — the client POSTs JSON-RPC 2.0 and we
// answer with application/json. Auth: `Authorization: Bearer ore_...`.

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiToken } from '@/lib/freehold/api-tokens'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { mcpTools } from '@/lib/freehold/mcp/registry'
import { runPlatformAgent } from '@/lib/freehold/mcp/agent-run'
import type { Role as SessionRole } from '@/lib/freehold/session-types'
import type { Role as McpRole } from '@/types/freehold-mcp'

export const runtime = 'nodejs'

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = { name: 'ORE — Freehold Intelligence', version: '1.0.0' }

// Platform session role → MCP tool-authorization role. Derived from the token's
// stored role, never from anything the caller sends in the request.
const SESSION_TO_MCP: Record<SessionRole, McpRole> = {
  broker: 'sales_agent',
  admin: 'admin',
  sales_manager: 'sales_manager',
  director: 'admin',
  ceo: 'owner',
  marketing: 'marketing',
}

// Per-read-tool input schema (write tools are not exposed directly — see ore_agent).
const READ_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  'server-summary': { type: 'object', properties: {} },
  'integration-summary': { type: 'object', properties: {} },
  'launch-blockers': { type: 'object', properties: {} },
  'project-data': {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text project/listing search.' },
      projectId: { type: 'string', description: 'Fetch one project by id/slug.' },
      limit: { type: 'number', description: 'Max rows (default 20).' },
    },
  },
  'lead-machine-summary': { type: 'object', properties: {} },
  'inventory-analysis': { type: 'object', properties: {} },
}

const AGENT_TOOL = {
  name: 'ore_agent',
  description:
    'Ask the ORE platform agent anything about the business (leads, pipeline, inventory, campaigns, finance, ' +
    'operations) OR instruct it to make a change. Answers are grounded in live system data. Any change to an ' +
    'external system (ads, CRM, WhatsApp) is STAGED for human approval inside the platform — it is never executed ' +
    'directly from chat. Runs with your role, so you only see and act on what your role permits.',
  inputSchema: {
    type: 'object',
    properties: {
      instruction: { type: 'string', description: 'A question about the business, or an instruction to act on.' },
    },
    required: ['instruction'],
  },
}

function toolList() {
  const reads = mcpTools
    .filter((t) => !t.canWriteExternal)
    .map((t) => ({
      name: t.id,
      description: t.description,
      inputSchema: READ_TOOL_SCHEMAS[t.id] ?? { type: 'object', properties: {} },
    }))
  return [AGENT_TOOL, ...reads]
}

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────
const rpcResult = (id: unknown, result: unknown) => NextResponse.json({ jsonrpc: '2.0', id, result })
const rpcError = (id: unknown, code: number, message: string, status = 200) =>
  NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status })

function textContent(value: unknown, isError = false) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }], isError }
}

export async function POST(request: NextRequest) {
  // Bearer auth — the token carries the acting user's role.
  const auth = request.headers.get('authorization') || ''
  const raw = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const principal = await verifyApiToken(raw)
  if (!principal) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized — supply a valid ORE token as a Bearer credential.' } },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="ORE"' } },
    )
  }
  const role = SESSION_TO_MCP[principal.role] ?? 'viewer'

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return rpcError(null, -32700, 'Parse error', 400)
  }

  const { id, method, params } = body
  // Notifications (no id) — acknowledge with 202, no body.
  if (id === undefined || id === null) {
    return new NextResponse(null, { status: 202 })
  }

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: (params?.protocolVersion as string) || PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            'Read tools return live ORE data. Use ore_agent for anything else — questions or changes. ' +
            'Writes to ads/CRM/WhatsApp are staged for human approval in the platform.',
        })

      case 'ping':
        return rpcResult(id, {})

      case 'tools/list':
        return rpcResult(id, { tools: toolList() })

      case 'tools/call': {
        const name = String((params?.name as string) || '')
        const args = (params?.arguments as Record<string, unknown>) || {}

        if (name === 'ore_agent') {
          const instruction = String(args.instruction || '').trim()
          if (!instruction) return rpcResult(id, textContent('Provide an instruction.', true))
          const res = await runPlatformAgent(instruction, role)
          const parts = [res.answer]
          if (res.stagedAction) {
            parts.push(
              `\n— Staged action: ${res.stagedAction.tool} (${res.stagedAction.status}). ` +
              `${res.stagedAction.nextActions.join(' ')}`.trim(),
            )
          }
          return rpcResult(id, textContent(parts.join('\n')))
        }

        // Direct read tool. Write tools are intentionally NOT callable here.
        const tool = mcpTools.find((t) => t.id === name || t.aliases?.includes(name))
        if (!tool) return rpcResult(id, textContent(`Unknown tool: ${name}`, true))
        if (tool.canWriteExternal) {
          return rpcResult(id, textContent('Writes must go through ore_agent, which stages them for approval.', true))
        }
        const res = await executeTool({ toolName: name, userRoles: [role], args })
        if (res.status === 'error') return rpcResult(id, textContent(res.warnings?.join('; ') || 'Tool error', true))
        return rpcResult(id, textContent({ data: res.data, evidence: res.evidence, nextActions: res.nextActions }))
      }

      default:
        return rpcError(id, -32601, `Method not found: ${method}`)
    }
  } catch (err) {
    return rpcError(id, -32603, err instanceof Error ? err.message : 'Internal error')
  }
}

// The stateless server does not offer a server-initiated SSE stream.
export function GET() {
  return NextResponse.json(
    { server: SERVER_INFO, transport: 'streamable-http', note: 'POST JSON-RPC 2.0 with a Bearer ORE token.' },
    { status: 200 },
  )
}
