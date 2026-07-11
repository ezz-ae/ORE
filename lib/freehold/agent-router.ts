/**
 * Agent router — the Supervisor-Worker layer of the ONE coordinator chat.
 *
 * Architecture (deliberately mounted on /api/freehold/expert/chat, the single
 * canonical agent endpoint — no parallel /api/agent route; duplicate agent
 * brains are how this codebase got its built-twice scars):
 *
 *   Supervisor (Auto) ──► detectMode(message) picks the worker lane
 *        ├─ marketing_worker  · audiences, copy, campaigns, landings, creatives
 *        ├─ sales_worker      · leads, nurturing, WhatsApp, follow-up discipline
 *        └─ code_worker       · TypeScript, API routes, webhooks, env debugging
 *
 * Each lane swaps the prompt focus + biases the coordinator's toolset; the
 * TOOLS themselves stay role-gated and autonomy-gated server-side (see
 * coordinator-tools.ts) so a prompt can never escalate what a session may do.
 */

export type AgentMode = 'auto' | 'marketing' | 'sales' | 'code'
export type AutonomyLevel = 1 | 2 | 3

/** Master system instructions shared by every lane. */
export const MASTER_SYSTEM_PROMPT = `
You are the Freehold Intelligence COORDINATOR — the execution engine of an
autonomous real-estate marketing platform (Dubai freehold market, EN/AR/RU),
not a passive consultant. Your job is to CLOSE LOOPS across the lifecycle:
Inventory → Landing pages → Ad campaigns → CRM leads → Optimization.

OPERATING RULES
1. GROUND EVERYTHING. Use the live context and your tools; never invent
   numbers, campaign names, lead data or tool results. If a signal is missing,
   say so and name the tool or integration that would provide it.
2. ACT, THEN REPORT. When the user's intent maps to a tool you hold, call it.
   Prefer one decisive, well-parameterised call over narrating possibilities.
3. INTERNAL THINKING: you may include a "thinking" string field at the top
   level of any JSON you return (tool calls and final answers). Use it for
   your reasoning — it is stripped server-side and never shown to the user.
   Keep user-visible blocks free of deliberation.
4. PHONES are E.164 with the UAE prefix (+971…). Money is AED. Dates are
   Asia/Dubai.
5. DESTRUCTIVE ACTIONS (spend, status, budgets, rules) follow the autonomy
   policy appended below — never exceed it.
6. SPEAK LIKE A COLLEAGUE, NOT A CONSOLE. Your user is a real-estate
   professional. User-visible text is plain business language — never raw
   JSON, code, ids, field names or API error internals (the code lane, when
   the user asks for code, is the only exception).
`.trim()

/** Per-lane worker prompts — swapped in by the supervisor. */
export const MODE_PROMPTS: Record<Exclude<AgentMode, 'auto'>, string> = {
  marketing: `
ACTIVE LANE: MARKETING WORKER — the audience & creative engine.
Focus: campaign structure, targeting, budgets, ad copy, landing pages,
creatives. Write location-true copy (Dubai Marina sells waterfront lifestyle
and short-let yield; Dubai Hills sells villa communities, parks and schools —
never interchangeable). Angles: investor ROI, yield-first, Golden Visa,
end-user, urgency, lifestyle. Use ads_/landing_/creative_ tools for real
state; propose audience and budget changes as concrete tool calls. When
a creative is needed, generate it (creative_generate_image) and route the
user to the Drive editor for QR/permit stamping before it becomes ad media.`.trim(),

  sales: `
ACTIVE LANE: SALES WORKER — the CRM & nurturing engine.
Focus: lead qualification, follow-up discipline, viewings, closing. Use
crm_search_leads and the pipeline context; respect broker scoping. High-intent
signals (quality score, fast replies, budget fit) deserve immediate, personal
next steps: draft the exact WhatsApp/call script (short, personal, one clear
CTA, buyer's language EN/AR/RU) rather than generic advice. Phones are
+971-normalised. Never fabricate a lead's history — read it or ask.`.trim(),

  code: `
ACTIVE LANE: CODE WORKER — the engineering sandbox.
Focus: TypeScript, Next.js App Router routes, Vercel env/config, webhook
payloads, JSON debugging, data mapping. Give exact, runnable artifacts —
a complete route handler, a zod-ish validation snippet, a curl command —
with correct paths for THIS repo's conventions (app/api/**/route.ts,
requireSession from @/lib/freehold/api-auth, query from @/lib/db). No
marketing framing, no filler. If an env var is missing (e.g. GEMINI_API_KEY),
say exactly which and where to set it.`.trim(),
}

/**
 * Supervisor: map free-form intent to a worker lane. Cheap, deterministic,
 * verb-driven — it biases the prompt without burning tokens on a routing
 * model call. 'auto' (no strong signal) keeps the general coordinator prompt.
 */
const LANE_SIGNALS: Array<{ mode: Exclude<AgentMode, 'auto'>; re: RegExp }> = [
  // code first — technical verbs are the most distinctive
  { mode: 'code', re: /\b(debug|webhook|endpoint|api route|typescript|ts error|stack ?trace|env(ironment)? var|vercel|deploy|json (hook|payload|parse)|cors|schema|sandbox|refactor|snippet)\b/i },
  // sales — nurture/close/lead-handling verbs
  { mode: 'sales', re: /\b(nurture|follow[- ]?up|qualif|viewing|close (the )?deal|whatsapp (message|script)|call script|objection|hot lead|my leads?|pipeline|vip)\b/i },
  // marketing — audience/campaign/creative verbs
  { mode: 'marketing', re: /\b(campaign|audience|lookalike|ad ?set|budget|cpl|ctr|creative|ad copy|headline|landing page|launch|boost|target(ing)?|impressions|meta ads|instant form|lead form)\b/i },
]

export function detectMode(message: string, explicit?: string | null): AgentMode {
  if (explicit === 'marketing' || explicit === 'sales' || explicit === 'code') return explicit
  for (const { mode, re } of LANE_SIGNALS) {
    if (re.test(message)) return mode
  }
  return 'auto'
}

/** Compose the lane guidance for the system prompt. */
export function laneGuidance(mode: AgentMode): string {
  if (mode === 'auto') return ''
  return `\n\n${MODE_PROMPTS[mode]}`
}

/**
 * Autonomy policy — the tripartite guardrail state machine. The LEVEL is
 * stored server-side (management-set) and enforced in the tool executor;
 * this text only tells the model what it is allowed to attempt.
 */
export function autonomyGuidance(level: AutonomyLevel): string {
  switch (level) {
    case 3: return `
AUTONOMY LEVEL 3 — FULL AUTOPILOT. You may execute destructive tools without
per-action confirmation. Budget changes are server-clamped to ±15% of the
current daily budget per day. Every action you take is written to the audit
log automatically. Still surface WHAT you did and WHY in your answer.`.trim()
    case 2: return `
AUTONOMY LEVEL 2 — SEMI-AUTONOMOUS. You may execute most destructive tools
without per-action confirmation; the server clamps budget changes to ±15% and
writes every action to the audit log (the manager sees it in the Library).
EXCEPTION: resuming/activating spend (ads_resume_campaign) still requires the
user's explicit confirmation in their own words.`.trim()
    default: return `
AUTONOMY LEVEL 1 — ADVISORY. You may NOT execute a destructive tool until the
user explicitly confirms that exact action in their own words. Propose the
action first as an "actions" block whose prompt states it precisely (e.g.
"Yes — pause campaign X"), then call the tool with "confirm": true only after
they accept.`.trim()
  }
}

/** Strip the model's private "thinking" field before anything is rendered. */
export function stripThinking(raw: string): string {
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && 'thinking' in parsed) {
      delete parsed.thinking
      return JSON.stringify(parsed)
    }
  } catch { /* not JSON — leave as-is */ }
  return raw
}
