# Route Auth Matrix — Freehold / Entrestate (P0)

**Model:** `proxy.ts` (Next 16's middleware) is now **fail-closed**: every `/api/*` route requires a valid `fh_session` **except** the explicit public allowlist below. New routes are private by default. Sensitive machine endpoints (cron, bootstrap, webhook) are allowlisted at the edge and verify their **own secret/signature in-handler**.

Roles (from `lib/freehold/session-types.ts` / `auth-edge`): `broker | admin | sales_manager | director | ceo | marketing` (MCP/legacy also uses `owner | sales_agent | data_manager | viewer`). Management = `admin, ceo, director, sales_manager`.

## PUBLIC — intentionally open (allowlist in `proxy.ts`)

| Route | Method | Why public | Extra gate |
|---|---|---|---|
| `/api/health` | GET | uptime probe | — |
| `/api/freehold/public/*` (projects, areas, developers, search) | GET | public catalogue / SEO | — |
| `/api/markets`, `/api/market-score/*`, `/api/intelligence-block` | GET | public market intelligence | — |
| `/api/embed` | GET | external embed widget data | — |
| `/api/lp-analytics` | POST | anonymous landing-page event ingestion | — |
| `/api/leads` | POST | public landing-page lead **capture** | dedupe/validation in handler |
| `/api/pdf/*` (project, comparison) | POST | public brochure download + lead capture | — |
| `/api/auth/login`, `/request-reset`, `/reset` | POST | pre-session auth entry | reset consumes token; request-reset must not leak it (P0 Task 3) |
| `/api/server/login`, `/server/logout` | POST | pre-session auth entry | — |
| `/api/auth/bootstrap-admin` | POST | first-run setup (no session yet) | **setup-key** (`CRM_ADMIN_SETUP_KEY`) + refuse if admin exists (P0 Task 4) |
| `/api/cron/*` (follow-ups) | GET | scheduler (no session) | **`CRON_SECRET`** bearer / `x-vercel-cron` (P0 Task 5) |
| `/api/whatsapp/webhook` | GET/POST | Meta calls it | **`X-Hub-Signature-256`** HMAC + `hub.verify_token` (P0 Task 7) |

## PRIVATE — require session (default; enforced by `proxy.ts`)

Everything else under `/api/*`, notably:

| Group | Notes |
|---|---|
| `/api/meta/*`, `/api/google/*` | ad spend + campaign control — highest risk |
| `/api/meta/forms/[formId]/leads` | lead PII pull — also `requireSession` in-handler ✓ |
| `/api/whatsapp/*` (send, history, recap, disconnect, stream, ai-assist, status) | messaging — webhook is the only public one |
| `/api/ai/*` (chat, compare, generate-ad, summarize-lead, ask-notebook, recommend-followup, upload-brochure), `/api/chat`, `/api/freehold/chat`, `/api/freehold/ai/chat` | LLM cost — must not be anonymous |
| `/api/freehold/*` (mcp, integrations, lead-machine, analytics, admin, credits, deals, crm, tasks, expert, notebook, server, server-ai, search) | operational core; `/api/freehold/public/*` is the only public subtree |
| `/api/freehold/mcp/call`, `/mcp/tools` | **also** needs in-handler server-derived role + fail-closed (P0 Task 2) — session presence alone is not enough |
| `/api/freehold/admin/reset` | session + role `ceo|admin` in-handler ✓ |
| `/api/fi/inventory` | intelligence inventory — private |
| `/api/dashboard/*` (parse-brochure = AI, profile) | authoring / account |
| `/api/freehold-intelligence/*` (comments, dashboard, tasks) | app data |
| `/api/leads/{activity,assign,ai-message}`, `/api/crm/*`, `/api/admin/*`, `/api/ai-training`, `/api/ai/*` history | legacy CRM tree — self-gates via `getSessionUser` (freehold_site_session); also behind the fail-closed edge check |

## Residual (tracked, not in this PR)
- **`crm.` subdomain `/api/*`** short-circuits before the edge auth check (returns `next()`); those legacy routes self-gate via `getSessionUser` in-handler. Consolidate when the two session systems are unified (see `SYSTEM-AUDIT.md` §7).

## Acceptance
- Unauthenticated `GET /api/meta/campaigns`, `/api/ai/chat`, `/api/fi/inventory`, `/api/freehold/mcp/call` → `401`.
- `GET /api/health`, `/api/freehold/public/projects`, `/api/markets` → `200`.
- `POST /api/leads`, `POST /api/lp-analytics` (landing capture) → still work.
