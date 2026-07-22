> 📦 **Archived — completed / historical.** Kept for reference; this is **not** the current source of truth. See [`../README.md`](../README.md) for the live docs.

# Freehold Beta — Master Plan & Backlog

**Owner:** Mahmoud (Entrestate) · **Goal:** ship the full Freehold beta and run the client's **first trial campaign**, then harden into the white-label.
**Status keys:** ✅ done · 🟡 partial · ⬜ not started · 🔬 needs live data/creds · 🧱 blocked (human/settings)

> This is the single source of truth for remaining work. It supersedes ad-hoc lists. Grouped by: **Ship-today**, **Beta blockers**, **Placeholders to replace**, **Roadmap features** (client list + additions), **Docs**, **Code org**. Effort: **S** ≤1d · **M** 2–5d · **L** 1–2wk · **XL** 3wk+.

---

## A. Ship TODAY (client-requested, unblocks the trial)

| # | Item | Effort | Status |
|---|---|---|---|
| A1 | **Light mode** — light sky gradient bg, white charts, gray (dark+light) + black text; toggle in the account menu beside Languages + Tour; persisted per user | M | ✅ |
| A2 | **Tour: skip-twice = stop** — if a user skips the tour twice, don't reshow it that session (less intrusive) | S | ✅ |
| A3 | **What's-new** — a changelog panel openable from the account menu **and** a one-time popup on an affected page when a **feature/option** ships (never for fixes). Client-facing, dismissible, per-version | M | ✅ |
| A4 | **First trial campaign** — with Meta connected in-app (done): verify launch end-to-end, one real (PAUSED) campaign, confirm lead-form → CRM round-trip | S | 🔬 runbook ready: `docs/CAMPAIGN-LAUNCH-RUNBOOK.md` — needs client Meta token |

## B. Beta blockers / remaining from the audit

| # | Item | Effort | Status |
|---|---|---|---|
| B1 | HubSpot connect: env→DB creds + validated save + Activate panel (store ready) | S | ✅ client env→DB, validated `/credentials` endpoint, in-app connect now persists server-side so two-way sync works |
| B2 | Google Ads connect: env→DB (5 keys + OAuth) + Activate panel | M | ✅ client `creds()` env→DB, validated `/credentials` endpoint (OAuth refresh + trial GAQL), in-app connect persists server-side, status folds in DB creds |
| B3 | Enable **GitHub Actions** so CI runs (workflow correct; jobs never reach a runner) | S | 🧱 |
| B4 | Set Vercel env: `FH_SESSION_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `WHATSAPP_APP_SECRET`, `GEMINI_API_KEY` | S | 🧱 |
| B5 | Expert write-tool **approval executor** (`mcp/permissions.ts` is a stub) | M | ⏸ deprioritised — the external-write MCP tools (meta-launch, whatsapp-send, …) are registered but **never invoked** (the Expert only calls read tools), so the path is dormant, not a live risk. Auto-executing money/message writes from the AI needs explicit sign-off before building. |
| B6 | CPL-breach email (needs live Meta spend) | S | 🔬 |
| B7 | Tests: auth-matrix (401s), credit-ledger reconciliation, copy-rules scan | M | ⬜ |
| B8 | Rate limiting → shared store (currently per-instance in-memory) | M | ✅ there was actually **no** throttling; added a shared Postgres fixed-window limiter (`lib/freehold/rate-limit.ts`, fail-open) on the AI chat routes (expert + notebook, 40/60s per user → 429 + Retry-After) so a runaway loop can't drain credits |

## C. Placeholders / mockups to REPLACE (no fake data in beta)

| # | Surface | Effort | Status |
|---|---|---|---|
| C1 | **ads-live preview** (`ads-live/preview`) — hardcoded copy/images for 4 properties → real ad-account data | M | ✅ now loads real inventory projects (real name/area/price/hero image), brand-driven copy + page identity, empty state; editable before copy-out |
| C2 | **Integrations page** mock catalog + hardcoded "critical blockers" + static "AI take" → live status | M | ✅ catalog live from `/integrations/status`; **critical blockers now derived from live status** (db/AI/session), not the mock list; mock kept only as pre-fetch fallback |
| C3 | `lib/freehold/mcp/mock-integrations.ts` + `execute-tool` `{mock:true}` fallbacks → real connection registry | M | ✅ MCP integration-summary + launch-blockers now derive from live env/DB status (no mock); mock-integrations kept only as the integrations page pre-fetch fallback + dormant `[integrationId]` scaffolding (D1) |
| C4 | OAuth `start` route fake authorize URL + **no callback** → real per-provider OAuth (see F1) | L | ⬜ |
| C5 | Notebook seed threads (`notebookConversations`) → live persisted threads | M | ✅ real `freehold_site_notebook_conversations` store; chat persists each turn; list + detail page load real per-user threads (mgmt sees team's); demo seed no longer served anywhere |
| C6 | Lead-Machine seed listings/readiness → live inventory-derived | M | ⬜ |
| C7 | AI-Manager hub static content counts → live event log | S | ⬜ |
| C8 | `lib/gemini.ts` legacy content/paths audit (stale `/crm/*` fixed already) | S | 🟡 |

## D. Roadmap features — client's list (with build notes)

| # | Feature | Effort | Phase | Notes |
|---|---|---|---|---|
| D1 | **Universal connections hub** — connect to almost anything (connector framework + webhooks + Zapier/Make bridge) | XL | 3 | build on the new credential store + integrations hub |
| D2 | **AI Control Room** — connect any company, deploy any model, create internal agents (automation), train AI | XL | 4 | extends MCP + automation engine; model-agnostic |
| D3 | **Portals** — push/pull/review/rewrite/extract listings on **Bayut, Property Finder, Dubizzle** | L | 2 | **depends on Trakheesi permits (E1)** — hard requirement |
| D4 | **Agent bio-link + QR** — `name.company.com`: selected projects, offers, direct chat, contact, lead capture, analytics | M | 2 | ✅ public page at `/a/<handle>` (contact buttons + featured projects + lead capture → CRM assigned to the agent, rate-limited), in-workspace editor with copy-link + QR. Subdomain (`name.company.com`) is a DNS/wildcard follow-up on top of the path route |
| D5 | **Webmail integration** — Gmail/IMAP: AI reads/writes/summarizes in-system | M | 3 | integrate, don't build a mail server |
| D6 | **WhatsApp per-agent number** (not just one business account) — register each agent's number on Cloud API | M | 3 | ban-trap warning: never automate a personal number |
| D7 | **Creative suite** — upload/edit video + image, create designs, full control in-app | L | 3 | embed a creative SDK, don't build Canva |
| D8 | **Landing pages: advertise-from-builder** + redesign/edit with variety of **content holders/templates** | M | 2 | closes builder→ads loop |
| D9 | **Team chat** — all members, media sharing | M | 3 | |
| D10 | **Phone-unhide → unclaimed → auto-reassign by urgency** — unhiding a number = claimed event; unclaimed (even if assigned) auto-reassigns by lead urgency | M | 2 | genuinely novel CRM edge |
| D11 | **Finance commission breakdown** — growth / net / broker / referral / cashback / expenses per deal | M | 2 | ✅ full waterfall on the deal form (live) + company roll-up on Finance; additive schema, rates entered by management (no assumed split) |

## E. Roadmap — my additions (real-estate-critical, mostly from the expansion doc)

| # | Feature | Effort | Why |
|---|---|---|---|
| E1 | **Trakheesi (DLD) permit management** — generate/validate/attach permit per listing + watermark media | M | Hard legal requirement; **blocks portals (D3)** |
| E2 | **RERA BRN + agent-card validation** | S | Trust gate for UAE brokerages |
| E3 | **Viewings scheduler + calendar + reminders** | M | Book/track viewings in-system |
| E4 | **Document management + e-signature** (Form A/F, MOU, SPA) | L | The paperwork a deal runs on; high stickiness |
| E5 | **★ AI qualification bot** (web + WhatsApp) — 24/7 instant first response that qualifies + books | L | This *is* "lead in minutes" |
| E6 | **Buyer-matching engine** — auto-match a lead's brief to inventory | M | |
| E7 | **★ Billing & subscription (Stripe)** + points top-up | M | Can't charge without it |
| E8 | **Unified notification center** — in-app/push/email/WhatsApp | M | |
| E9 | **Buyer-facing client portal** — shortlist, docs, deal status | M | Makes it B2B2C |
| E10 | **Multi-channel nurture sequences** (WhatsApp/email/SMS drip) | M | No lead goes cold |
| E11 | **Lead SLA + escalation ladder + speed-to-lead scoreboard** | M | Builds on D10 |
| E12 | **Audit log + granular permissions** | M | Post-P0 selling line |
| E13 | **AVM / price estimator + market alerts** (DLD data) | M | Moat / data-native |
| E14 | **Outcome-training loop** (campaign→lead→closed-deal) | L | The compounding "admin AI" edge (gated until data exists) |

## F. Structural / white-label foundations

| # | Item | Effort | Status |
|---|---|---|---|
| F1 | **Per-broker OAuth tokens** (`broker_integration_tokens`, encrypted) + real onboarding | L | ⬜ |
| F2 | Consolidate the two session systems (`fh_session` + `freehold_site_session`) onto one | M | ⬜ |
| F3 | Normalize `assigned_broker_id`/`agent_id` to canonical user IDs → then add safe FK constraints | M | ⬜ |
| F4 | Tenant/tier-gating middleware (server-side) for the white-label | L | ⬜ |
| F5 | Column encryption for stored integration credentials | S | ✅ AES-256-GCM at rest (`lib/freehold/secure-store.ts`); Meta/Google/HubSpot/WhatsApp tokens encrypted, transparent decrypt, legacy plaintext rows auto-re-encrypt on next write; key from `FH_CREDENTIALS_KEY`→`FH_SESSION_SECRET` |

## G. Docs & organization (the "real attention to detail" ask)

| # | Item | Status |
|---|---|---|
| G1 | **System manual** — per-role user guide (CEO/manager/broker/marketing), every app + option, EN/AR | 🟡 `docs/USER-GUIDE.md` (updated w/ light mode, what's-new, quieter tours); in-app help page pending |
| G2 | Admin/ops runbook — env vars, integration setup, cron, backups | ✅ `docs/OPERATIONS-RUNBOOK.md` |
| G3 | **CHANGELOG.md** — the source for the What's-new panel (A3) | ✅ `CHANGELOG.md` (mirrors `changelog.ts`) |
| G4 | API/route reference (extend `route-auth-matrix.md`) | 🟡 |
| G5 | Code organization pass — dead-code sweep, consistent lib structure, remove dormant `lib/auth.ts` after F2 | ⬜ |
| G6 | Data dictionary — every `freehold_site_*` table, columns, implicit FKs | ⬜ |

---

## Suggested execution order
1. **Today:** A1 light mode → A2 tour → A3 what's-new → A4 verify first campaign.
2. **This week:** B1/B2 (HubSpot+Google connect), D11 finance breakdown, D10 phone-unhide, C1/C2 kill ads-live + integrations mocks, G1 system manual, G3 changelog.
3. **Then:** D4 bio-link, D8 LP templates+advertise, E1 Trakheesi (unblocks D3 portals), E7 Stripe, E5 AI qual bot.
4. **White-label:** F1–F4, D1 connections hub, D2 AI control room.

*Updated as items ship. Each shippable feature gets a CHANGELOG entry (G3) so the What's-new panel surfaces it to the client.*
