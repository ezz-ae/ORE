# Freehold AI — Agent Map

How every AI surface in the app is wired, which agent serves it, and the single
credential that powers all of them.

## Credentials (one is enough)

| Env var | Powers | Status |
| --- | --- | --- |
| `VERTEX_AI_SERVICE_ACCOUNT_JSON` | **Everything** — server AI, marketing/ads agent, *and* the public/CRM AI (via fallback) | **Required** |
| `GEMINI_API_KEY` | Public site + CRM AI via the Google AI Studio SDK (optional speed path) | Optional |
| `VERTEX_AI_API_KEY` | Alternative to the service-account JSON for Vertex | Optional |

If `GEMINI_API_KEY` is **absent**, the public/CRM AI automatically falls back to
the Vertex service account — so the whole app runs on `VERTEX_AI_SERVICE_ACCOUNT_JSON` alone.

> The service-account JSON must live only in `.claude/settings.local.json`
> (gitignored) for local/sandbox runs, and in Vercel env vars for production.
> It must never be committed.

## Model

Only the **Gemini 2.5 family** is enabled in the Vertex project
(`gemini-2.5-flash`, `-flash-lite`, `-pro`). The 2.0 / 1.5 ids return 404, so all
Vertex calls use `gemini-2.5-flash`. Thinking is disabled (`thinkingConfig.thinkingBudget = 0`)
on chat/content surfaces so 2.5-flash returns direct text instead of spending the
output budget on reasoning tokens.

## The three agents

### 1. Intelligence Server AI — `lib/freehold/server-ai.ts`
Private operating partner for owner/management/brokers. Role-scoped topics
(CRM, campaigns, finance, security…). System prompt = the Freehold private server.

- `POST /api/freehold/server-ai/chat`
- `POST /api/freehold/server/chat`
- `POST /api/freehold/expert/chat`

### 2. Marketing / Ads Expert — `lib/google/vertex-agent.ts`
Deployed ADK reasoning engine (primary) with a direct Gemini fallback. Specialises
in Google/Meta ads, RSA copy, funnels.

- `POST /api/google/ads-agent`

### 3. Public + CRM AI — `lib/gemini.ts`
Client-facing advisor (public site) and CRM operator assistant. Uses the
`@google/generative-ai` SDK when `GEMINI_API_KEY` is set, otherwise a
Vertex-backed shim with the identical interface.

- `POST /api/ai/chat` — public website visitor advisor
- `POST /api/ai/broker-chat` — CRM broker assistant
- `POST /api/leads/ai-message` — lead WhatsApp/email drafts
- `POST /api/dashboard/projects/parse-brochure` — brochure → project

## Which app/page calls which agent

| Surface | Endpoint | Agent |
| --- | --- | --- |
| `/management` dashboard briefing | `/api/freehold/server-ai/chat` | Server AI |
| `/management/ai` chat | `/api/freehold/server-ai/chat` | Server AI |
| `/management/credits` CFO analysis | `/api/freehold/server-ai/chat` | Server AI |
| `/freehold-intelligence` ExpertChat (docked panel) | `/api/freehold/expert/chat` | Server AI |
| `/freehold-intelligence/...` `AiPrompt` boxes | routed to ExpertChat via the expert bus | Server AI |
| `/freehold-intelligence/agent/notebook` chat + studio | `/api/freehold/server-ai/chat` | Server AI |
| `/freehold-intelligence/agent/ai` connections | `/api/freehold/server-ai/chat` | Server AI |
| `/freehold-intelligence/lead-machine`, ads sidebar | `/api/google/ads-agent` | Ads Expert |
| Public site chat widget | `/api/ai/chat` | Public AI |
| `/crm` broker assistant | `/api/ai/broker-chat` | CRM AI |
| Lead follow-up composer | `/api/leads/ai-message` | CRM AI |
| Add-project-from-brochure | `/api/dashboard/projects/parse-brochure` | CRM AI |

## Shared plumbing

`lib/google/vertex-auth.ts` is the single source of truth for Vertex auth and
generation: OAuth token caching, project resolution (from the SA JSON), the
`vertexGenerateText()` call, and `normalizeVertexModel()` (maps AI-Studio model
ids to their Vertex equivalents). All three agents authenticate through it.
