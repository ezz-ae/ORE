import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { appendTurn, getConversation } from '@/lib/freehold/notebook-conversations'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { buildNotebookContext, type NotebookSources, type NotebookUpload } from '@/lib/freehold/notebook-context'
import { BRAND } from '@/lib/freehold/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cap AI usage per user so a runaway loop can't drain credits.
  const rl = await checkRateLimit(`notebook-chat:${user.email}`, { limit: 40, windowSec: 60 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down for a moment.', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const body = await request.json().catch(() => ({})) as {
    message?: string
    conversationId?: string
    sources?: NotebookSources
    uploads?: NotebookUpload[]
    /** One-off generator calls: grounded like chat, but not saved as a thread turn. */
    ephemeral?: boolean
  }
  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const conversationId = body.conversationId ?? `notebook-${crypto.randomUUID()}`
  // The client-supplied role parameter is GONE (S0.5): it mirrored the exact
  // pre-lockdown bug pattern. The envelope echoes the SESSION role only.
  const role = user.role

  const systemPrompt = `You are the ${BRAND.company} Notebook AI — a private research and drafting assistant for the ${BRAND.company} team.

You help with: property research, brochure drafts, market summaries, WhatsApp message templates, and investment narratives for Dubai real estate.

Rules:
- Only use facts explicitly provided in the conversation or the workspace-sources block below. Do not invent project names, prices, handover dates, or yields.
- If asked for verified project data and no sources are attached, respond: "I don't have live project data in this session — tick 'Live Projects' in the Sources panel."
- When drafting copy, mark any unfilled detail as [VERIFY BEFORE SENDING].
- Keep responses focused and professional.`

  // Ground the answer in the sources the user selected in the left panel.
  // The message drives project retrieval (matching projects' llm_context);
  // the session role scopes the pipeline (brokers see their own book only).
  const sourceContext = await buildNotebookContext(body.sources, body.uploads ?? [], user.email, {
    message,
    role: user.role,
    brokerId: user.brokerId ?? user.email,
  })

  // Thread memory: replay the conversation's stored turns so the model
  // actually remembers this thread. The sessionId is scoped per user AND per
  // conversation — never the shared anonymous bucket, which would bleed one
  // user's turns into another's context on a warm instance.
  let history: Array<{ role: 'user' | 'model'; text: string }> | undefined
  if (body.conversationId) {
    const stored = await getConversation(body.conversationId, user.email, user.role)
    if (stored?.messages.length) {
      history = stored.messages.slice(-20).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        text: m.content,
      })).filter((h) => h.text)
    }
  }

  try {
    const answer = await queryServerAgent(message, {
      systemPrompt: systemPrompt + sourceContext,
      sessionId: `notebook-${user.email}-${conversationId}`,
      history,
    })
    // Persist the turn so the thread is real and reloadable (best-effort).
    // Generator calls are ephemeral — they ground the same way but must not
    // pollute the user's conversation threads.
    const savedId = body.ephemeral === true
      ? conversationId
      : await appendTurn(conversationId, user.email, message, answer)
    return NextResponse.json({
      conversationId: savedId,
      role,
      prompt: message,
      answer,
      cards: [],
      source: 'ai',
    })
  } catch {
    // `unavailable` lets the client render its TRANSLATED offline message —
    // a hardcoded English sentence here would leak into AR/RU threads.
    return NextResponse.json({
      conversationId,
      role,
      prompt: message,
      answer: '',
      unavailable: true,
      cards: [],
      source: 'fallback',
    })
  }
}
