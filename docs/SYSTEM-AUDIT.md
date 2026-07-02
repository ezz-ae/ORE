# Freehold / Entrestate — Full System Audit

**Date:** 2026-06-30 · **Method:** live production DB (Neon) queried directly + three parallel code scans (integrations, product-completeness, security & data-model), each cited to `file:line`. Supersedes the earlier pre-P0 draft.

---

## 1. Executive summary

Freehold is the coding-partner deployment of the **Entrestate** system (Freehold today; white-label later). Current state, in one line:

> **A content-complete public property catalog with a fully-built but not-yet-used operational platform, now behind a P0 security lockdown that has one critical hole remaining.**

**Beta-readiness verdict: NOT YET — one critical auth bypass + a handful of HIGH gaps block it, but they are small, well-scoped fixes, not rebuilds.**

Three truths from the data and code:
1. **The catalog is real and rich** — 2,840 projects (100% with hero image, 94% priced), 2,860 landing pages, 572 developers, 155 areas. The public site has genuine content.
2. **The operational side is empty** — 1 lead, 1 user, 0 deals/finance/tasks/contracts. Every CRM/ads/finance app is *built and wired* but has no real traffic yet. That's normal pre-beta, but it means "outcome-trained" claims have zero data (see §6).
3. **P0 security is 90% done but not airtight** — this audit found a **critical `crm.`-subdomain auth bypass** that voids the fail-closed middleware for any route lacking its own in-handler check.

---

## 2. Security posture (post-P0)

P0 lockdown shipped this cycle (PRs #34–#38): fail-closed API middleware, MCP hard-auth (server-derived role), reset-token leak closed, WhatsApp webhook HMAC, route auth matrix. **This audit then went deeper and found residual holes:**

### 🔴 CRITICAL — `crm.` subdomain bypasses fail-closed API auth
`proxy.ts` — the `if (hostname.startsWith("crm."))` block `return`s `NextResponse.next()` for `/api` paths **before** the fail-closed auth block runs. Any `/api/*` request with `Host: crm.*` (or a spoofed Host header) skips `verifySession` entirely. Routes with no in-handler auth are then fully exposed unauthenticated: `whatsapp/send` (message any number from the company account), all `ai/*` + `chat` (unmetered LLM spend), `fi/inventory`, `freehold/lead-machine/*`, `freehold-intelligence/{comments,dashboard,tasks}`, `dashboard/projects/parse-brochure`, `freehold/mcp/tools`. **Fix: run the auth check before the `crm.` early-return.** *(Fixed in the follow-up PR to this audit.)*

### 🟠 HIGH — ad-budget & lead-PII endpoints require only *a* session, not a role
Every `app/api/meta/*` and `app/api/google/*` route calls `requireSession()` with **no role arg** → any authenticated user, including a `broker`, can launch/edit real ad campaigns (spend money) and export Meta lead-form PII (`meta/forms/[formId]/leads`). Should be gated to `marketing` + management.

### 🟠 HIGH — `team/[id]` role management is over-permissive
`app/api/freehold/team/[id]` allows any of `[admin,ceo,director,sales_manager]` to **promote anyone (incl. themselves) to ceo/admin** and **delete any user incl. the CEO** — contradicting `lib/auth.ts` (`canManageCrmUsers` = ceo/gm/admin, `canDeleteCrmUsers` = ceo only, never delete a CEO). Self-escalation + privileged-account-deletion path.

### 🟡 MEDIUM — session signing secret has an insecure fallback
`lib/freehold/auth-edge.ts`: `process.env.FH_SESSION_SECRET || 'dev-insecure-secret-change-me-in-prod'`. If unset in prod, every `fh_session` is signed with a public constant → anyone can forge a `ceo` session. Should throw in production when unset.

### 🟢 LOW — inert `?? 'owner'` in `notebook/chat`
`body.role ?? 'owner'` is only echoed, never used for authz — harmless but the exact pre-P0 pattern; remove to prevent regression.

### ✅ Confirmed clean
Fail-closed logic + public allowlist correct; login sets both cookies; MCP escalation fixed; correct in-handler role checks on `admin/reset`, `management/analytics`, `credits/admin/allocate`, `admin/users/*`; **no hardcoded secrets**; `.gitignore` covers `.env*` (only `.env.example` tracked).

### Env vars that must be set in Vercel for the gates to engage
`FH_SESSION_SECRET` (critical), `WHATSAPP_APP_SECRET`, `CRON_SECRET`, `CRM_ADMIN_SETUP_KEY`, `RESEND_API_KEY`, `DATABASE_URL`.

---

## 3. Integration readiness

| Integration | Client / version | Verdict | To go live |
|---|---|---|---|
| **Meta Ads** | `lib/meta/client.ts` Graph v20 | **LIVE-CAPABLE** (demo fallback) | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID` (+`META_PIXEL_ID`) |
| **Google Ads** | `lib/google/client.ts` Ads v16 | **LIVE-CAPABLE** (demo fallback) | 5× `GOOGLE_ADS_*` (+ MCC login id) |
| **HubSpot** | `lib/hubspot/client.ts` v3 | **LIVE-CAPABLE** (fails clean, no demo) | `HUBSPOT_TOKEN` |
| **Gemini/Vertex** | `lib/gemini.ts` (2.5 family) | **LIVE-CAPABLE** (dual provider) | `GEMINI_API_KEY` or `VERTEX_AI_*` |
| **WhatsApp** | Cloud v18 (`client.ts`) + Baileys (`session.ts`) | **SPLIT-BRAIN** — webhook live, send inconsistent | see below |
| **OAuth onboarding** | `integrations/[id]/oauth/start` | **PLACEHOLDER** | real per-provider OAuth + callback |

Key gaps:
- **OAuth onboarding is fake** — `oauth/start` builds a non-existent `https://oauth.${id}.com/authorize` URL, there is **no callback route**, and no `broker_integration_tokens` table exists. Every integration is really configured by pasting **global env secrets**, not by a user "Connect" flow (the UI "Connect" button is a 1.2s `setTimeout` + localStorage).
- **No multi-tenant tokens** — all clients use a single global env credential. This is *the* leadbylead gap: each broker must run on their own Meta/Google assets (P1.2).
- **Demo data is weakly labeled** — unconfigured Meta/Google return `demo:true`, but the UI surfaces it as "not connected" while still rendering seeded spend/lead numbers. A viewer can read fake numbers as real. (P1.1: label "DEMO".)
- **WhatsApp split-brain** — inbound webhook expects Cloud API; outbound `send` uses Baileys (which *can't run on Vercel serverless*); the Cloud client silently returns `{status:'sent', mock_…}` when unconfigured. Pick one backend (Cloud API) before launch.

---

## 4. Product completeness (P3 / P4 / P5)

**P3 — product**
| Item | Status |
|---|---|
| Coach onboarding (per-role, first-login, en/ar/ru) | ✅ DONE |
| Data-quality page (DB-honest, no masking) | ✅ DONE |
| Transactional email infra (Resend) + 5 senders + follow-up cron | ✅ present |
| Event hooks: **new-lead→broker, password-changed, CPL breach, low-credit** | ❌ NOT wired |
| Light/full mobile density mode | ❌ MISSING (only color theme) |
| Landing-page **templates** (multiple) | ⚠️ one section-driven layout, not multiple templates |
| ads-live preview | ❌ static mock (hardcoded copy for 4 properties) |

**P4 — enterprise "FINALIZATION" layer: entirely absent** — no `lib/registry`, `lib/profile`, tier-gate `lib/middleware`, `packages/embed`, `tests/`, `.github/workflows`, `scripts/guardian.py`. Fine to defer past beta, **but any paid-tier / multi-tenant gating is currently unenforced** — decide scope (Freehold dashboard vs separate Entrestate product) before building.

**P5 — hardening**
| Item | Status |
|---|---|
| Rate limiting on `/api/ai/*` + public | ❌ MISSING — direct cost/abuse on Gemini chat |
| CI (`.github/workflows`) | ❌ MISSING |
| Tests (`tests/`) | ❌ MISSING (only `scripts/smoke.ts`) |
| `next.config` `typescript.ignoreBuildErrors:true` | ⚠️ type errors ship silently — `tsc` is the only real gate |
| Production error hygiene / stack-trace leakage | not audited in depth |

---

## 5. Data-model integrity

- **One active table family:** the app reads/writes `freehold_site_*` almost exclusively (276 refs in `lib/`). The `freehold_*` (no `_site_`) tables are SELECT-only seed/external data (`freehold_private_dashboard`, `freehold_integration_*`).
- **Implicit foreign keys (string, unconstrained):** `deals.lead_id`, `deals.project_slug`, `deals.agent_id`, `finance_entries.related_deal_id`, `finance_entries.created_by`, `leads.project_slug`, `leads.assigned_broker_id`, various `created_by`. Only one real FK exists: `lead_activity.lead_id → leads(id) CASCADE`.
- **`review_comments.item_id`** — polymorphic free-text, no `item_type`, no parent table; can't be FK-constrained as-is.

**Safe FK additions** (single-type keys): `deals.lead_id→leads(id)`, `finance_entries.related_deal_id→deals(id)` (both `ON DELETE SET NULL`); `*.project_slug→projects(slug)` only if `slug` is unique and no orphans (backfill-verify first).
**Unsafe** (mixed identifiers — would reject existing rows): `assigned_broker_id`/`agent_id`/`created_by → users(id)` (hold UUID *or* slug like `agent_layla` *or* email — normalize first), and `review_comments.item_id` (needs an `item_type` discriminator first).

---

## 6. Connectivity loops (after this session's Phase 1–2 work)

Closed this cycle (PRs #24–#30): deal→inventory booked-sales, analytics→CRM drill-down, lead-source→campaign, finance→agent commission, inventory→ad-campaign, AI-Manager→ad-creatives, Notebook→CRM. Still open: Notebook→Ads/WhatsApp (needs target pickers), Lead-Machine→Finance spend (needs a campaign column on finance entries), and the paid-campaign half of source→campaign (needs the multi-tenant campaign data from P1.2).

**Outcome data = 0** full campaign→lead→closed-deal cycles (0 deals, 1 lead). The "outcome-trained targeting" claim must stay gated until real cycles exist (`docs/outcome-data-count.md`).

---

## 7. Phase scorecard

| Phase | Status |
|---|---|
| **P0 Security** | 🟡 ~90% — lockdown shipped; **1 critical (crm-subdomain) + 2 HIGH role gaps** from this audit to close |
| **P1 Integrations** | 🔴 clients LIVE-CAPABLE but blocked on **human prereqs** (clean Meta identity, App Review, WABA templates, Google dev token) + **no multi-tenant tokens / real OAuth** |
| **P2 Business logic** | 🟢 build green, credit loop hardened (refuse-on-insufficient), outcome count known, media unique |
| **P3 Product** | 🟡 onboarding done; email event hooks, light mode, LP templates, ads-live-live pending |
| **P4 Enterprise** | 🔴 unbuilt — needs a scope decision first |
| **P5 Hardening** | 🔴 no CI, no tests, no rate limiting, `ignoreBuildErrors` on |

---

## 8. Prioritized action list

**Block beta on these (security):**
1. 🔴 Fix the `crm.`-subdomain auth bypass (`proxy.ts`).
2. 🟠 Role-gate `meta/*` + `google/*` to marketing + management.
3. 🟠 Fix `team/[id]` — no self-escalation, no CEO deletion.
4. 🟡 Make `FH_SESSION_SECRET` fail-closed in production; set it (and the other secrets) in Vercel.
5. 🟢 Rate-limit `/api/ai/*`.

**Then beta-quality:**
6. P1.1 — label demo/unconfigured integration data as "DEMO" (stop showing fake spend as real).
7. P3 — wire new-lead→broker email/WhatsApp (leads sit unseen today); publish real landing pages (only 5/2,860 live).
8. WhatsApp — commit to Cloud API; retire/curtail Baileys; remove silent mock-send.
9. P5 — add CI (`tsc`+`build`+`i18n`) and remove `ignoreBuildErrors`.

**For white-label (post-beta):**
10. P1.2 — real per-broker OAuth onboarding + `broker_integration_tokens` (encrypted); refactor clients to per-call tokens.
11. P4 scope decision → tier-gate middleware if in scope.
12. Normalize `assigned_broker_id`/`agent_id` to canonical user IDs, then add the safe FKs.

---

*Companion docs: `docs/route-auth-matrix.md` (route classification), `docs/outcome-data-count.md` (outcome gate), `docs/ACCESS-MATRIX.md` (roles × apps).*
