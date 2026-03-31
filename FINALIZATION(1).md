# FINALIZATION.md
# Entrestate Intelligence OS — Enterprise Finalization Checklist
# Generated: 2026-03-22 by notebook agent
# Source of truth: Hex notebook "Enterprise Decision Infrastructure Finalization"
# 
# HOW TO USE
# ----------
# Each Codex PR must update this file.
# Mark items ✅ when merged and green. Never mark ✅ before CI passes.
# If an item is partially done, use ⚠️ + note in parentheses.
# Do not delete items — archive them at the bottom if obsoleted.

---

## PROMPT #1 — Platform A→E (repo structure, surfaces, ops)
### A) Experience Plane
- [ ] Landing page: 1 headline + Chat / Search / Map + 3 Golden Path buttons + Trust bar
- [ ] Remove feature soup from first view (no more than 3 primary actions visible)
- [ ] Chat surface shell: `/chat` route exists, split-screen layout scaffolded
- [ ] Search surface shell: `/search` route exists, Time Table Builder scaffolded
- [ ] Map surface shell: `/map` route exists, Spatial cluster view scaffolded
- [ ] Golden Path tiles are static (no LLM at click — pre-validated TableSpec JSON fires)
- [ ] Evidence Drawer panel component exists (even if data-less)
- [ ] Citation click → row highlight wired in UI

### B) Intelligence Plane (shells only — Prompt #3 fills logic)
- [ ] `/api/chat` returns `{content, dataCards, requestId}` shape (even if stubbed)
- [ ] `/api/markets` and `/api/market-score/summary` remain stable (no regression)
- [ ] Ask Compiler stub: returns fallback Golden Path if called without full logic
- [ ] TableSpec zod schema imported and validated on every request

### C) Data Plane (shells — Prompt #2 fills fixes)
- [ ] Inventory spine view exists in DB (`inventory_spine`)
- [ ] `market_scores_v1` view exists in DB
- [ ] `area_roi_summary` view exists in DB
- [ ] `developer_performance` view exists in DB

### D) Monetisation Rails (shells)
- [ ] `/artifacts` route exists with embed widget section
- [ ] `/settings/tier` route exists with tier display
- [ ] Free tier branding enforcement present (even if CSS-only for now)

### E) Operational Readiness
- [ ] `.github/workflows/ci.yml` created (pnpm lint/test/build on PR)
- [ ] `.github/workflows/db-contract-nightly.yml` created (03:00 UTC)
- [ ] `scripts/smoke.ts` created (see smoke script spec in this notebook)
- [ ] README updated: Decision Tunnel, TableSpec, Time Table, Evidence Drawer, tiers
- [ ] `FINALIZATION.md` committed to repo root (this file)

---

## PROMPT #2 — Data Contract Fixes (12 cells, price_aed, exclusions, gates)
### price_from_aed integrity (12 cells)
- [ ] "Projects Outlier Analysis" — `price_from` → `price_from_aed`, enforce float64
- [ ] "Merge & Create Unified Dataset" — rename at merge + `pd.to_numeric` enforce
- [ ] "STATIC TRUTH: Final State & Quality Report" — rename in all print/summary refs
- [ ] "ENTRESTATE FINAL STATISTICS" — rename + enforce numeric before aggregation
- [ ] "FINAL ENRICHMENT: Fill Gaps from PF + Re-export Everything" — no string cast
- [ ] "NEON DATABASE: Schema + Push Pipeline" — `DOUBLE PRECISION` in DDL + SQLAlchemy dtype
- [ ] "GROWTH SHEET" — groupby on `price_from_aed`
- [ ] "CONFIDENCE GAP ANALYSIS" — coverage checks on `price_from_aed`
- [ ] "TEACHING AGENT" — string interpolation uses `price_from_aed` formatted as int
- [ ] "MARKETING INTELLIGENCE TRAINING" — same as above
- [ ] "FINAL DEPLOYMENT" — export as float64, not string
- [ ] "CELL 1/3: DATA NORMALIZATION GUARDIAN" — hard assert on dtype, raises ValueError

### Exclusion cleanup
- [ ] All `lelwa`/`mashroi` filter logic removed from data pipeline
- [ ] Any display-layer filters moved to UI layer with explicit comment
- [ ] `grep -r "lelwa|mashroi" src/ lib/` → 0 results in filter context

### Narration gating
- [ ] `ENTRESTATE_LOG_LEVEL` env var added top of pipeline
- [ ] All emoji print() statements gated behind `if _verbose:`
- [ ] Contract output prints (JSON, assertions, provenance) ungated
- [ ] `ENTRESTATE_LOG_LEVEL=INFO` produces zero emoji stdout

### DB contract tests
- [ ] `tests/db-contract.test.ts` created
- [ ] Asserts: `inventory_spine`, `market_scores_v1`, `area_roi_summary`, `developer_performance` exist
- [ ] Asserts: `rank_investors()`, `refresh_market_scores()`, `get_area_absorption()` exist
- [ ] Asserts: `price_from_aed` is `DOUBLE PRECISION` (not text)
- [ ] Asserts: `market_scores_v1.score` is `DOUBLE PRECISION`
- [ ] `pnpm test:db-contract` passes against `NEON_READONLY_URL`

### CI wiring
- [ ] `package.json` has `"test:db-contract"` script
- [ ] Nightly workflow fails fast and logs which object is missing

---

## PROMPT #3 — Intelligence Layer (registry, compiler, profiles, tier gate)
### I) Column Registry
- [ ] `lib/registry/columns.ts` exported with all 55 columns
- [ ] `isColumnAccessible('ghost_portfolio_flag', 'free')` → `false`
- [ ] `isColumnAccessible('price_from_aed', 'free')` → `true`
- [ ] `getColumnsByTier('enterprise')` returns only enterprise-gated columns

### II) Investor Profile Engine
- [ ] `lib/profile/types.ts` — `InvestorProfile`, `InvestorArchetype`, `ScoringWeights`
- [ ] `lib/profile/archetypes.ts` — 5 archetypes, each `scoring_weights` sums to 1.0
- [ ] `lib/profile/scoring.ts` — `calculateMatchScore()` pure, deterministic, 0-100
- [ ] `lib/profile/storage.ts` — `getProfile()`, `upsertProfile()`, Neon-backed
- [ ] `lib/profile/inference.ts` — 6 inference rules from behavior log
- [ ] `investor_profiles` table exists in DB with correct schema

### III) Ask Compiler
- [ ] `lib/compiler/ask-compiler.ts` — only file touching OpenAI API
- [ ] Injects `ASK_COMPILER_SYSTEM_PROMPT` with `column_registry_version`
- [ ] Always returns valid `AskCompilerOutput` (never throws to caller)
- [ ] Invalid TableSpec → auto-fallback to Golden Path (no error surfaced to user)
- [ ] `lib/compiler/tablespec-validator.ts` — zod validation, throws `ZodError` if invalid
- [ ] `lib/compiler/query-builder.ts` — parameterized SELECT only, 500-row max
- [ ] `buildQuery()` with free-tier user cannot return `ghost_portfolio_flag`

### IV) Tier Gate Middleware
- [ ] `lib/middleware/tier-gate.ts` — `applyTierGate()` implemented
- [ ] Tier extracted from JWT/session — client-supplied tier ignored
- [ ] Gated columns removed silently (no error), `upgrade_cta` set from domain templates
- [ ] Gate events logged async to `tier_gate_events` (non-blocking)

### V) Evidence Drawer + API
- [ ] `/api/chat` pipeline: compile → tierGate → buildQuery → executeQuery → buildEvidence → respond
- [ ] `/api/chat` response always includes `request_id`, `evidence`, `provenance`
- [ ] `/api/chat` never leaks stack traces or internal errors in `NODE_ENV=production`
- [ ] `/api/markets` attaches `provenance` from `latest_provenance` view
- [ ] `/api/markets` attaches `request_id` to every response

### VI) DB Migration 0005
- [ ] `investor_profiles` table created
- [ ] `tier_gate_events` table + index created
- [ ] `notebook_provenance_log` table created
- [ ] `latest_provenance` view created (returns 1 row after every notebook run)
- [ ] Notebook provenance runner fires on every pipeline run and upserts to DB

---

## PROMPT #4 — Distribution, Acquisition & Trust
### I) Embed SDK
- [ ] `packages/embed/src/index.ts` — self-contained, CSP-safe, no eval()
- [ ] 4 widget types implemented: `market_card`, `area_table`, `score_badge`, `market_pulse`
- [ ] `app/api/embed/route.ts` — returns only `columns_exposed` per embed type
- [ ] Free-tier: "Powered by Entrestate" non-removable (hardcoded in `styles.ts`)
- [ ] Pro-embedder: `data-accent` custom color supported
- [ ] Gated columns render blurred + upgrade CTA
- [ ] Response cache: `Cache-Control: public, max-age=3600`
- [ ] Rate limit: 100 req/min per ref, 10 req/min unauthenticated
- [ ] `packages/embed/package.json` — publishable, semver

### II) Attribution Engine
- [ ] `lib/attribution/events.ts` — `trackAttributionEvent()` non-blocking (void, no await)
- [ ] `widget_view` deduped: 1 per widget per session per 30 min
- [ ] `widget_signup` attributed if `widget_click` within 7 days
- [ ] `widget_upgrade` attributed if `widget_view` within 90 days
- [ ] `lib/attribution/viral-coefficient.ts` — `getViralMetrics()` per user
- [ ] Signup flow wired: if session has widget_click → fire `widget_signup` event
- [ ] `attribution_events` table exists with all columns + indexes
- [ ] `widgets` table exists

### III) Onboarding Flow
- [ ] `app/onboarding/page.tsx` — 3 steps, correct UI types per step
- [ ] Step 1: non-skippable, single-select cards, auto-advance on select
- [ ] Step 2: skippable, budget range slider + horizon segmented control
- [ ] Step 3: skippable, yield-vs-growth single-axis slider
- [ ] Completion → `upsertProfile()` → `inferArchetype()` → `/chat?q=...` pre-filled
- [ ] Copy matches `ONBOARDING_COPY` verbatim (no ad-hoc strings)
- [ ] Funnel events fire at each step start/complete/skip
- [ ] `lib/onboarding/first-query.ts` — routes profile hint to correct pre-filled query

### IV) Trust Language System
- [ ] `lib/copy/trust.ts` — exports `TRUST_COPY` + 4 utility functions
- [ ] `lib/copy/upgrade.ts` — `buildUpgradeCTA()` uses `benefit_map` verbatim
- [ ] `components/ConfidenceBadge.tsx` — HIGH=#16a34a, MEDIUM=#ca8a04, LOW=#dc2626
- [ ] `components/ScoreExplainer.tsx` — renders "what it isn't" clause for all 3 scores
- [ ] `components/EvidenceDrawer.tsx` — footer uses `snapshot_ts` + `run_id` from provenance
- [ ] `tests/copy-rules.test.ts` — scans `.tsx/.ts` for forbidden strings
- [ ] Forbidden strings test catches: "our algorithm", "100% accurate", "real-time", "AI says"
- [ ] `pnpm test` fails if any forbidden string found in codebase

---

## CRITIQUE FIXES — Infrastructure Hardening (The Critique review, Feb 2026)

### I) Guardian Pre-Compilation Script (FIX 7)
- [ ] `scripts/guardian.py` created — deterministic, fail-fast, no LLM
- [ ] Guardian is first CI step in `ci.yml` (runs before `pnpm lint`)
- [ ] `package.json` includes `"guardian"` and `"precompile"` scripts
- [ ] `python scripts/guardian.py` exits 0 on clean repo
- [ ] Contract violation summary (C07) retained as post-hoc audit only — not the enforcer

### II) Unit Granularity Layer (FIX 8)
- [ ] MIGRATION 0007 applied: `unit_samples` table exists in Neon
- [ ] `idx_unit_samples_project` index exists on `unit_samples`
- [ ] `inventory_spine` view updated: exposes `unit_sample` (jsonb) + `unit_coverage_pct` (numeric)
- [ ] `unit_sample` element schema: `{floor_level, view_type, bedrooms, price_aed, price_vs_project_avg_pct, tx_date}`
- [ ] `unit_sample IS NULL` → UI signals "project-level data only"
- [ ] Initial coverage target: 10% of 7,015 projects (capability over completeness)

### III) Ask Compiler — Partial Resolution State
- [ ] `partial_spec` output type implemented in `lib/compiler/ask-compiler.ts`
- [ ] Complex multi-signal queries → `partial_spec` (not golden path fallback)
- [ ] `gaps[]` field populated with every unresolved filter name
- [ ] `investor_profile_hints[]` attached when user profile is known in session
- [ ] 4 archetypes wired: `capital_growth_seeker` → price_momentum; `yield_maximizer` → gross_yield; `risk_averse_buyer` → risk_class filter; `developer_brand_buyer` → honesty_index
- [ ] Unit-level keywords (`floor`, `seaview`, `bedrooms`, `1BR`, `2BR`, `3BR`) → `unit_distribution_signal`
- [ ] `unit_distribution_signal` triggers `unit_sample` lookup; null coverage → gap note in response

### IV) Widget Symbiote Mode
- [ ] All 4 embed types: `interaction_mode: "overlay"` (no same-tab redirect to `/chat`)
- [ ] CTA click → `open_evidence_drawer` overlay renders on embedder's page
- [ ] User never leaves broker's page on widget interaction
- [ ] `market_card` + `area_table`: lead magnet `dual_capture` enabled
- [ ] `data-lead-webhook` fires to broker CRM on email submit (broker gets CRM lead)
- [ ] `/api/signup?tier=free&source=widget` fires simultaneously (Entrestate gets signup)
- [ ] Overlay fallback: if drawer fails → open `/chat?ref=widget` in new tab (not same tab)
- [ ] `packages/embed` handles `data-interaction="overlay"` + `data-lead-magnet="true"` attributes

---

## GLOBAL ACCEPTANCE CRITERIA (must be true after all 4 prompts)
- [ ] `grep -r "price_from[^_]" src/ lib/ notebooks/` → 0 results
- [ ] `grep -r "lelwa|mashroi" src/ lib/` → 0 results in filter context
- [ ] `ENTRESTATE_LOG_LEVEL=INFO` → zero emoji prints in stdout
- [ ] `/api/chat` response includes `provenance.run_id` on every call
- [ ] Home page: only Chat / Search / Map + Golden Paths + Trust Bar visible
- [ ] Tier gating enforced server-side (JWT, not client claim)
- [ ] Widget "Powered by Entrestate" cannot be hidden via external CSS
- [ ] `latest_provenance` view returns 1 row after notebook pipeline run
- [ ] `pnpm lint` → 0 errors
- [ ] `pnpm test` → all green (including db-contract + copy-rules)
- [ ] `pnpm build` → success
- [ ] Nightly db-contract CI passes against `NEON_READONLY_URL`
- [ ] Smoke script passes against staging URL
- [ ] `python scripts/guardian.py` exits 0 on clean repo
- [ ] CI runs guardian as first step before `pnpm lint`
- [ ] `unit_samples` table exists in Neon with `idx_unit_samples_project`
- [ ] `inventory_spine` view exposes `unit_sample` + `unit_coverage_pct`
- [ ] Ask Compiler returns `partial_spec` for complex multi-signal queries (not fallback)
- [ ] Widget CTA opens overlay on embedder site — no same-tab redirect to `/chat`
- [ ] Lead magnet dual-capture fires broker webhook + Entrestate signup simultaneously

---

## ARCHIVED / DEFERRED
- WhatsApp web assistant workflow (`/automations`) — deferred post-launch
- IG DM agent — deferred post-launch
- Ads agent — deferred post-launch
- PPT deck export — deferred to Business tier launch
- Custom brand profile (logo/colors on artifacts) — deferred to Enterprise tier launch

---

*This file is auto-generated from the Hex notebook architecture map.*
*Do not edit manually — regenerate from notebook cell C32 if items change.*
*Last generated: 2026-03-22 19:51 UTC*
