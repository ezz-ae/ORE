# Freehold Intelligence — System Audit & Connectivity Enhancement Plan

**Audit date:** 2026-06-29
**Scope:** Full platform — app inventory, data backbone, API surface, integrations, AI Expert, RBAC/auth, and the inter-app data loops that make the suite feel like one system rather than a folder of tools.
**Method:** Code-grounded read-only audit across `app/freehold-intelligence/**`, `app/api/freehold/**`, `lib/**`, and integration clients. Every finding below cites the file it came from.

> **Why this document exists.** The platform is being hardened for production and for white-label resale. White-labeling raises the bar twice: the product has to be *correct* (no broken loops, no leaks across roles) and it has to be *legible* (a buyer's team must understand how data flows). This audit states where we are honestly and lays out a phased plan to close the open loops.

---

## 1. Executive Summary

**Overall posture: production-capable core, with known seams.** The transactional spine — leads, deals, finance, inventory, analytics, management — is wired to live APIs backed by Neon Postgres. The lead-capture funnel (public landing form → `freehold_site_leads` → automation engine → assignment) is fully real. RBAC is enforced server-side on the sensitive paths, and the AI Expert is role-scoped so brokers never receive management-level context.

Three classes of gap remain, in priority order:

1. **Under-gated read APIs.** Several `/api/freehold/analytics/*` and `server-ai/*` / `server/*` routes resolve with **Role: none** — they verify a session inconsistently or not at all. This is the highest-priority hardening item before white-label sale, because a buyer's data would be queryable cross-tenant-style by any authenticated user. *(See §6.)*
2. **Open connectivity loops.** The data exists to close them, but the UI/back-end edges are missing: deal-close doesn't tag the inventory unit sold; analytics KPIs don't drill back into CRM; lead `source` doesn't link to the originating campaign; Notebook "Send to Ads/CRM" is UI-only (clipboard, no POST). *(See §5 and §7.)*
3. **Structural debt.** Cross-table relationships are implicit string references with **no FK constraints** (orphan risk on user/project deletion); a second, dormant session system (`lib/auth.ts` + `freehold_site_user_sessions`) is dead code that confuses the auth story; and a handful of seed/static surfaces (Notebook threads, Lead-Machine readiness, AI-Manager hub counts, Integrations status) still render mock data. *(See §3 and §7.)*

None of these block the working demo the user is testing daily. All of them matter for a white-label buyer who will push real money and real PII through the system.

---

## 2. App Inventory & Data-Source Health

Source of truth for apps and role visibility: `lib/freehold/apps.ts` (`APPS`, `appAllowsRole`, `rolesForApp`).

| App | Entry | Primary data source | Health | Notes |
|---|---|---|---|---|
| **CRM** | `crm/page.tsx` | `/api/freehold/crm/leads` (`use-live-leads.ts`) | **LIVE** | Sync-status badges (HubSpot/Meta/Google) are still static seed. |
| **Ads (launcher)** | `ads/page.tsx` | Hardcoded `PLATFORMS`/`BUILD`/`OPTIMIZE` grid | **STATIC CONFIG** | Pure router to lead-machine subapps; no live data on the tile. |
| **Inventory** | `inventory/page.tsx` | `getInventoryPropertiesFromDB()` | **LIVE DB** | Clean empty state, no seed fallback. |
| **Finance** | `finance/page.tsx` | `/api/freehold/deals?totals=1` + `freehold_site_finance_entries` | **LIVE** | Ad spend from ledger (30-day / 6-month). |
| **AI-Manager (Web Studio)** | `ai-manager/page.tsx` | Hub: hardcoded `CONTENT_TYPES`/`ACTIVITY`; sub-pages: `/api/freehold/public/*`, `/web-content` | **MIXED** | Hub counts are illustrative "until event log is wired"; sub-pages are live. |
| **Analytics** | `analytics/page.tsx` | `/api/freehold/analytics/leads` + `/deals?totals=1` | **LIVE** | Funnel + deal metrics; KPIs do not drill back to CRM (§5). |
| **Notebook** | `notebook/page.tsx` | Threads: `notebookConversations` seed; outputs: `/api/freehold/notebook/save-output` | **MIXED** | "Send to CRM/Ads/WhatsApp" is clipboard-only (§5 #6). |
| **Integrations** | `integrations/page.tsx` | `getAllIntegrations()` (mock-integrations) | **STATIC SEED** | OAuth buttons present; live connection status not yet surfaced here. |
| **Settings** | `settings/page.tsx` | `/api/freehold/team` | **LIVE** | |
| **Management** | `management/page.tsx` | `/api/freehold/dashboard/stats`, `/crm/leads`, `/tasks` | **LIVE** | Central exec hub + quick-nav spine. |
| **Agent (broker workspace)** | `agent/page.tsx` | `/api/freehold/crm/leads`, `/credits/balance` | **LIVE** | Self-scoped. |
| **Lead-Machine** | `lead-machine/page.tsx` | `leadMachineListings`/`Requirements` seed | **STATIC SEED** | Readiness/blocker scores are illustrative. |

**Takeaway:** the money-path apps (CRM, Finance, Inventory, Analytics, Management, Agent) are live. The remaining seed surfaces are all on the *content/ops* side (Notebook, Lead-Machine, Integrations status, AI-Manager hub) and are the natural Phase-2/3 wiring targets.

---

## 3. Data Backbone — Tables, Consumers & Implicit-FK Gaps

~18 actively-used `freehold_site_*` tables in Neon, plus ~5 MCP-managed concepts (credits, automation rules) that have **no Postgres table** and live in MCP state. Schema helpers in `lib/data.ts`, `lib/deals.ts`, `lib/finance.ts`, `lib/tasks.ts`, `lib/contracts.ts`.

### 3.1 Core table → consumer map (abridged)

| Table | Readers | Writers | Implicit FK (not enforced) |
|---|---|---|---|
| `freehold_site_leads` | crm, analytics, dashboard, management, expert | crm/leads, hubspot/sync, lead-machine, landing form | `assigned_broker_id` → users.id *(string)*; `project_slug` → projects.slug *(string)* |
| `freehold_site_deals` | deals, analytics, finance, management | deals, finance/entries | `lead_id` → leads.id *(nullable)*; `agent_id` → users.id *(string)* |
| `freehold_site_finance_entries` | finance, management | finance/entries | `related_deal_id` → deals.id *(nullable)*; `created_by` → users.id *(string)* |
| `freehold_site_lead_activity` | analytics | crm/activity | `lead_id` → leads.id **(real FK, CASCADE)** |
| `freehold_site_tasks` | tasks | tasks | `assignee` → users.id *(string, no FK)*; no link to leads/deals |
| `freehold_site_users` | team, crm/agents, management, finance | team, auth | — |
| `freehold_site_review_comments` / `_resolutions` | reviews | reviews | `item_id` → **no declared parent table** |
| `freehold_site_meta_campaigns` / `_google_campaigns` | analytics/marketing | integrations | none |
| `freehold_site_project_landing_pages` | public/landing | lead-machine | `project_slug` → projects.slug *(string)* |

### 3.2 Gaps

- **Implicit foreign keys.** `assigned_broker_id`, `agent_id`, `created_by`, `tasks.assignee`, and every `project_slug` reference are plain strings with no constraint. Deleting a user or project leaves orphaned leads/deals/finance rows. For a multi-tenant white-label deployment this is a data-integrity hazard.
- **`review_comments.item_id` has no parent type.** Comments could point at a deal, a landing page, or anything; there is no referential integrity and no discriminator column. This table is effectively untyped.
- **`freehold_site_lp_analytics`** appears in `admin/reset` but is **never read by any API** — landing-page analytics are computed elsewhere or not at all. Either wire it or remove it.
- **Tasks are siloed.** No relationship to leads or deals, so "follow up on lead X" cannot be represented as a typed task.
- **AI conversations never link back to a lead.** `freehold_site_ai_conversations` stores chat history but has no `lead_id`, so a broker's AI work on a specific lead is not attached to that lead's record.

---

## 4. Integrations & Inbound-Lead Wiring

Live status is computed from env vars only (no secrets) in `lib/freehold/integration-status.ts`. Each integration degrades gracefully to demo/mock when unconfigured.

| Channel | Client | Configured behavior | Unconfigured behavior |
|---|---|---|---|
| **Meta Ads** | `lib/meta/client.ts` | Real reads; pull-sync of lead forms on demand | Demo campaigns (`meta/demo-data.ts`), local store fallback |
| **Google Ads** | `lib/google/client.ts` | Real reads | Demo campaigns |
| **WhatsApp** | `lib/whatsapp/client.ts` | Real inbound webhook; real outbound | Inbound still stored; **outbound is mock** (fake messageId) |
| **HubSpot** | `lib/hubspot/client.ts` | One-time manual import (push/pull) | Fail-fast (`HubspotConfigError`); CRM runs standalone |
| **Gemini → Vertex** | `lib/gemini.ts`, `lib/google/vertex-auth.ts` | Gemini preferred; Vertex fallback | Both absent → offline context-only answers |

### Inbound lead flows (the funnel that matters most)

| Source | Endpoint | Persistence | Status |
|---|---|---|---|
| **Public landing form** | `POST /api/leads` (`app/lp/[slug]/_form.tsx`) | Writes `freehold_site_leads` (`status=new`, `source=lp:{slug}`); triggers `handleNewLead` automation | **FULLY WIRED** |
| **WhatsApp inbound** | `POST /api/whatsapp/webhook` | Writes `freehold_site_whatsapp_messages`; links to lead by phone (last 9 digits) | **WIRED** |
| **Meta lead forms** | `GET /api/meta/forms/[formId]/leads` | Upserts leads, dedupes by `meta_lead_id` | **WIRED (pull, on-demand)** — not a continuous webhook |
| **HubSpot import** | `POST /api/freehold/integrations/hubspot/sync` | Upserts contacts into leads | **REQUIRES CONFIG** |

Dedup/re-inquiry logic (`lib/automation/distribution.ts`, `lib/automation/engine.ts`): repeat submissions match on phone/email, log activity on the existing lead, and never create a duplicate pipeline entry. This is solid.

**Gaps:** Meta is pull-based (no continuous webhook); WhatsApp outbound is mock until tokens are set; HubSpot is one-time, not bidirectional.

---

## 5. AI Expert Connectivity

Entry: `app/api/freehold/expert/chat/route.ts`. `gatherSystemContext()` assembles a live, **role-scoped** snapshot via parallel `executeTool()` calls.

| Context slice | Role gate |
|---|---|
| Server status, launch blockers, lead-machine summary | Operators (admin/ceo/director/marketing) |
| Team performance, finance totals, CRM pipeline snapshot | Management only |
| **Broker's own pipeline** (`brokerPipelineSnapshot`) | Self-scoped — broker sees only their leads |
| Inventory analysis, integration health | All roles |

This role-scoping is correct and addresses the earlier "even AI is levels" defect — a broker no longer receives infra/integration tasking.

**Tool registry** (`lib/freehold/mcp/registry.ts`, dispatched by `execute-tool.ts`): 6 read tools (no approval), 3–4 write tools (approval-gated, role-scoped to owner/admin/marketing) — `meta-ads-launch`, `google-ads-budget`, `whatsapp-send`, `crm-hubspot-write`, plus `lead-machine-campaign`.

**Gaps:**
- Expert can **read** projects/leads but has **no internal write tool** — it can send a WhatsApp (external) but cannot update a lead, create a landing page, or generate ad copy directly. Every internal mutation routes back through the UI.
- Approval gating (`lib/freehold/mcp/permissions.ts`) is currently a **stub** — writes return `pendingApproval` but the approval-execution path is not fully implemented.

---

## 6. RBAC & Auth Model

Roles (`lib/freehold/session-types.ts`): `broker | admin | sales_manager | director | ceo | marketing`. `MANAGEMENT_ROLES = [admin, ceo, director, sales_manager]`.

- **Active session:** `fh_session` — HMAC-signed, stateless, edge-compatible (`lib/freehold/auth-edge.ts`). Used by all `/api/freehold/*` routes via `verifySession()`; role enforced with `requireSession(roles)` (`lib/freehold/api-auth.ts`).
- **Dormant session:** `freehold_site_session` — scrypt, DB-backed in `freehold_site_user_sessions` (`lib/auth.ts`). **Dead code**; not called by any active route. Should be removed to make the auth story unambiguous for a white-label buyer.
- **Row-level scoping:** brokers see only their own leads (`assigned_broker_id`) and deals (`agent_id`); management sees all. Finance/tasks/contracts are not row-scoped (all-visible, write gated).
- **Deal approval:** two-step — step 1 (`sales_manager`/`admin`), step 2 (`ceo`/`director`), recorded in `deals.step1_*`/`step2_*`.

### ⚠️ Under-gated routes (highest priority)

The API audit found these resolving with **Role: none** — no consistent session/role check:

- `GET /api/freehold/analytics/team`, `/leads`, `/marketing`, `/market`, `/report`, `/agent/[id]`
- `POST /api/freehold/server-ai/chat`, `/server/chat`, `/server-ai/session-summary`
- `GET /api/freehold/notebook/conversations`, `POST /notebook/chat`

By contrast `dashboard/stats` correctly uses `verifySession`, and `admin/reset` correctly requires `['ceo','admin']`. The analytics and server-ai endpoints expose aggregated company data (team metrics, sales volume, source attribution) and should at minimum require a valid session, and the team/agent analytics should require management. **This is the #1 pre-white-label fix.**

---

## 7. Connectivity Enhancement Plan (phased)

The suite is ~75% a closed loop. The full intended loop is:

> **Inventory unit → Landing page → Ad creative → Campaign → Lead → CRM pipeline → Deal → Finance/commission → (back to) Inventory "sold" + Agent payout**

Below, each missing edge with the data that already exists to close it.

### Phase 0 — Security hardening (do first, blocks white-label)
- **Gate the under-gated routes (§6).** Add `verifySession`/`requireSession(MANAGEMENT_ROLES)` to all `analytics/*`, `server-ai/*`, `server/*`, and `notebook/*` endpoints. Low effort, high impact.
- **Implement approval execution** for Expert write tools (`mcp/permissions.ts`) instead of the current stub.
- **Verify session-secret enforcement** in production (no dev-fallback secret).

### Phase 1 — Close the money loop (highest product value)
1. **Deal → Inventory "sold" tag.** On deal close, write `status=sold` + `deal_id` onto the inventory unit; show the linked deal on the inventory detail page, and the linked unit on the deal. *(Data: `deals.project_slug` already exists.)*
2. **Analytics → CRM drill-down.** Make the conversion/closed KPIs in `analytics/page.tsx` link to `/crm/leads?stage=closed` (and by source). *(Data: analytics already counts closed leads.)*
3. **Lead source → campaign link.** Make the `source` badge on the lead detail clickable → `/lead-machine/campaigns/{id}` with CPL/funnel/ROI. *(Data: `leads.source` exists; needs a campaign id mapping.)*
4. **Finance → agent commission breakdown.** Surface "pending commission from closed deals" in the Agent workspace, linked to `/management/deals?agent={id}`. *(Data: `finance_entries.related_deal_id`, `deals.agent_id`.)*

### Phase 2 — Close the content/ads loop
5. **Inventory → "Create Ad Campaign"** button → Lead-Machine listing for that unit. *(Data: `lead-machine/listings` already carries `projectId`.)*
6. **AI-Manager → "Generate Ad Creatives"** after a listing page is generated → `/lead-machine/creatives/generate?listing={id}`.
7. **Notebook "Send to CRM/Ads/WhatsApp" backend.** Replace clipboard-only stubs (`notebook/page.tsx` ~lines 796–835) with real POSTs to CRM/creatives/WhatsApp.
8. **Lead-Machine → Finance attribution.** Show campaign-level spend in Finance ("Top Spenders"). *(Data: `finance_entries` category `ad_spend`.)*

### Phase 3 — Structural / white-label readiness
9. **Standardize implicit FKs.** Add real FK constraints (or a documented tenant-scoped convention) for `assigned_broker_id`, `agent_id`, `created_by`, `project_slug`, and give `review_comments.item_id` a discriminator + parent. Prevents orphan rows on delete in multi-tenant deployments.
10. **Remove the dormant session system** (`lib/auth.ts` scrypt path + `freehold_site_user_sessions`) so there is exactly one auth model.
11. **Replace remaining seed surfaces** (Notebook threads, Lead-Machine readiness, AI-Manager hub counts, Integrations status badges) with the live event log once it's wired.
12. **Wire or drop `freehold_site_lp_analytics`** and link `ai_conversations.lead_id` so AI work attaches to the lead it concerns.

---

## 8. Loop-Completeness Scorecard

| Loop | Status | ~Completeness |
|---|---|---|
| Ad campaign → Lead → CRM → Deal → Finance | ✅ Mostly works | ~85% (missing UI drill-downs) |
| Inventory → Landing → Creative → Campaign → Lead → Deal → Commission → Inventory | ⚠️ Partial | ~60% (no Deal→Inventory reverse; AI-Manager→Lead-Machine manual) |
| Management → Team → Credit allocation → Agent | ✅ Mostly works | ~80% (no pending-commission breakdown) |
| Broker workspace → My leads → My campaigns | ⚠️ Partial | ~70% (campaigns filter unconfirmed) |
| Notebook research → Output → Distribute | ⚠️ Partial | ~50% (distribution UI-only) |

---

## 9. Key File Index

- **App registry / RBAC:** `lib/freehold/apps.ts`, `lib/freehold/session-types.ts`, `lib/freehold/api-auth.ts`, `lib/freehold/auth-edge.ts`
- **Data layer:** `lib/data.ts`, `lib/deals.ts`, `lib/finance.ts`, `lib/tasks.ts`, `lib/contracts.ts`, `lib/db.ts`, `lib/inventory-data.ts`, `lib/freehold/use-live-leads.ts`
- **Inbound leads:** `app/api/leads/route.ts`, `app/api/whatsapp/webhook/route.ts`, `app/api/meta/forms/[formId]/leads/route.ts`, `lib/automation/{engine,distribution}.ts`
- **AI Expert:** `app/api/freehold/expert/chat/route.ts`, `lib/freehold/mcp/{registry,execute-tool,permissions}.ts`, `lib/freehold/server-ai.ts`
- **Integrations:** `lib/{meta,google,whatsapp,hubspot}/client.ts`, `lib/gemini.ts`, `lib/freehold/integration-status.ts`
- **Inter-app links:** `app/freehold-intelligence/crm/leads/[id]/_components/LeadClientActions.tsx`, `app/freehold-intelligence/notebook/page.tsx`, `app/freehold-intelligence/management/page.tsx`

---

*This audit is companion to `docs/ACCESS-MATRIX.md` (roles × apps × capabilities). Together they cover what the system does, who can do it, and what to build next to make it whole.*
