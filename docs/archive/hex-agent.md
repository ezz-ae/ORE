> 📦 **Archived — completed / historical.** Kept for reference; this is **not** the current source of truth. See [`../README.md`](../README.md) for the live docs.

# Hex Data Agent — Master Blueprint (grounded)

**Platform owner:** Entrestate (open data firm — data is free for all; systems are the product)
**First white-label tenant:** Freehold Property UAE
**Database:** one shared Neon PostgreSQL (`NEON_DATABASE_URL` / `DATABASE_URL`)
**This file is the operating contract for the Hex notebook agent.** Everything in it
is verified against the live codebase (`ezz-ae/ORE`). Where an earlier draft
(the Gemini blueprint) conflicts with this file, THIS FILE WINS — see
"Corrections" at the bottom.

---

## 1. The system in one paragraph

"Listing to Landing": the platform converts raw market inventory into
zero-distraction selling pages (no header, no exits), then closes the loop —
lead outcomes flow back into a shared targeting brain so every next ad is
better than the last. The two halves together are the Lead Machine. Entrestate
keeps the market data open; tenants like Freehold pay for the system that
monetizes it. The Hex notebook is the staging pipeline that keeps the market
data in Neon rich, consistent, and honest.

---

## 2. Database map — three zones

### Zone A — MARKET DATA (Hex agent owns, enriches, upserts)

| Table | Rows (approx) | Purpose |
|---|---|---|
| `freehold_site_projects` | ~2,840 | Full market inventory. One row per project. `payload` JSONB is the complete object; `llm_context` TEXT is pre-formatted RAG context for Gemini. |
| `freehold_site_area_profiles` | ~155 | Area hubs: images, `avg_yield`, `median_price_aed`, `project_count`, descriptions, `payload`. |
| `freehold_site_developer_profiles` | ~572 | Developer pages: logo, track record, honesty index, `payload`. |

_Row counts reconciled against live Neon on 2026-07-13 (were ~3,655 / ~10 / ~64 in earlier docs). Approximate and point-in-time — the source of truth is a live `SELECT COUNT(*)`. There is no `freehold_site_units` table; unit data lives in `payload.units[]`._

### Zone B — SHARED BRAIN (Hex may feed through the defined door only)

| Table | Rule |
|---|---|
| `entrestate_lead_history` | Per-tenant landing zone for imported historical leads. Columns: `id, tenant_id, source, platform, campaign, area, project_type, price_band, age_band, city, interest, outcome ('lead'\|'qualified'\|'closed'\|'lost'), lead_date, payload, created_at`. PII may exist inside `payload` only, and is NEVER aggregated. |
| `entrestate_targeting_signals` | Anonymized aggregates ONLY (dimensions × outcome counts, PK on tenant+dimensions). Rebuilt from history by the platform (`rebuildSignals`). Do not write rows containing anything identifying — the schema is structurally incapable of holding a name/phone/email; keep it that way. |

Cross-tenant benchmarks require `SUM(leads) >= 5` per segment before a segment
is visible to anyone — never lower that threshold.

### Zone C — PLATFORM OPERATIONAL TABLES (Hex agent: DO NOT WRITE. Read only if asked)

Everything the app itself creates and manages. Writing here corrupts live
tenant state (deals, credits, sessions, campaigns):

`freehold_site_leads`, `freehold_site_deals`, `freehold_site_users`,
`freehold_site_user_sessions`, `freehold_site_lead_activity`,
`freehold_site_activity_log`, `freehold_site_tasks`, `freehold_site_contracts`,
`freehold_site_finance_entries`, `credit_ledger`, `broker_credit_accounts`,
`ad_spend_allocations`, `freehold_site_meta_campaigns`,
`freehold_site_google_campaigns`, `freehold_site_google_entities`,
`meta_campaign_prefs`, `meta_campaign_brokers`, `freehold_campaign_rules`,
`freehold_site_project_landing_pages`, `freehold_site_project_microsites`,
`freehold_site_lp_analytics`, `freehold_site_library`,
`freehold_site_notebook_*`, `freehold_site_ai_*`, `freehold_site_expert_sessions`,
`freehold_site_calendar_*`, `freehold_site_review_*`,
`freehold_site_integration_credentials`, `freehold_site_api_keys`,
`freehold_site_rate_limits`, `freehold_site_user_prefs`,
`freehold_site_agent_profiles`, `freehold_broker_permissions`,
`freehold_agent_settings`, `freehold_site_web_content`,
`freehold_site_whatsapp_messages`, `automation_rules`,
`workspace_automation_config`.

### Multi-tenant registry (the REAL tier gating)

Tenant access control already exists and lives in the `api` schema:

- `api.client_configs` — one row per white-label client: `client_id`,
  `client_name`, `tier`, `allowed_views` (jsonb array of `api.*` view names),
  `allowed_columns` (jsonb map view → column allow-list), `rate_limit`,
  `is_active`.
- The platform's gateway (`lib/entrestate/gateway.ts`) only ever serves a view
  that (a) matches `api.[a-z0-9_]+` and (b) is in the client's `allowed_views`,
  projecting only `allowed_columns` when set. Max 500 rows per read.
- `public.connectors` — data sources wired per tenant.

**To gate a new premium column or view: add/adjust rows in
`api.client_configs`, and create the `api.*` view.** Do NOT invent a parallel
"tier_gated_columns" JSON config — the mechanism already exists here.

---

## 3. The hard contract on `freehold_site_projects`

The platform reads with COALESCE chains across top-level columns AND payload
keys — so **top-level columns and `payload` must always stay in sync**. If you
update one, update both.

### Top-level columns the app depends on (proven in code)

`id, slug, name, area, developer_name, status, featured, price_from_aed,
price_to_aed, rental_yield, market_score, risk_class, golden_visa_eligible,
price_tier, handover_date, archetype, area_type, hero_image, hero_video,
virtual_tour, brochure, og_image, confidence, payload, llm_context`

There is **no** `size` column and **no** `updated_at` column — do not assume
them; add `updated_at` only as a coordinated migration if ever needed.

### `payload` keys the platform actually reads (with the reader)

| Payload key | Read by |
|---|---|
| `payload->'units'[]` — each `{ type, bedrooms (int, 0=Studio), priceFrom, floorPlan, interiorImage }` | inventory, AI chat filters (`lib/data.ts`) |
| `payload->'location'->>'area'`, `payload->>'area'` | listing area resolution |
| `payload->'developer'->>'name'`, `payload->>'developer'` | developer resolution |
| `payload->>'priceFrom'`, `payload->'price'->>'fromAed'` | price fallbacks |
| `payload->>'status'`, `payload->>'propertyType'`, `payload->>'category'`, `payload->>'type'` | filters |
| `payload->>'roi'`, `payload->'investmentHighlights'->>'expectedROI'` | ROI fallbacks |
| `payload->>'sortScore'` | ranking fallback when `market_score` is null |
| `payload->'priceIntelligence'->>'vsCohortPct'`, `->>'pricePerSqft'` | **the public "below market" rail** (`lib/intelligence-block.ts`) — negative `vsCohortPct` between −50 and −5 makes a project surface there |
| `payload->>'city'` | city filters (Dubai / Abu Dhabi / Ras Al Khaimah) |
| `payload.paymentPlan`, `payload.amenities[]`, `payload.faqs[]`, `payload.gallery[]`, `payload.heroImage`, `payload.ogImage`, `payload.timeline`, `payload.investmentHighlights` | landing-page hydration (`lib/landing-pages.ts`), PDFs, microsites |
| `payload->>'pfSlug'` | landing pages resolve projects by `slug` OR `payload.slug` OR `payload.pfSlug` — **slugs are load-bearing; never rewrite a slug** |
| the 6 intelligence blocks: `investmentFlags`, `rentalIntelligence`, `priceIntelligence`, `roiCalculator`, `secondaryMarket`, `aiNarrative` | public project page + AI chat (documented in `data.md`) |

### Non-negotiable data rules

- `bedrooms = 0` means **Studio**. `units[].type` must already say "Studio" —
  consumers trust the `type` field.
- `golden_visa_eligible = price_from_aed >= 2,000,000` — a business rule, keep
  it computed, never hand-set against it.
- `market_score` bands: ≥80 Strong, 65–79 Good, <65 Standard.
- Yields/ROI are always "projected/estimated" downstream — store real numbers,
  the app adds the hedging language.
- **Honesty over completeness**: the platform renders honest empty states.
  A missing value is better than an invented one. Imputed values are allowed
  only when clearly marked (see job H2).

---

## 4. Hex job ledger — build these in the notebook

### H1 — Sync integrity sweep (run first, then on every batch)
For every row, assert top-level ↔ payload consistency (`price_from_aed` vs
`payload.priceFrom`/`payload.price.fromAed`, `area` vs `payload.location.area`,
`hero_image` vs `payload.heroImage`, `og_image` vs `payload.ogImage`). Emit a
drift report; fix by writing BOTH sides.

### H2 — Imputation with provenance (never silent)
Where `rental_yield`, `market_score`, or `risk_class` is NULL and a defensible
baseline exists (area median from `freehold_site_area_profiles`, developer tier
from `freehold_site_developer_profiles`), write the baseline AND set
`confidence = 'estimated'` (top-level column exists) plus
`payload.confidence = 'estimated'`. Never impute without flagging; never
overwrite a real observed value with a baseline.

### H3 — DLD reconciliation
Match scraped project/community strings to official DLD transaction records;
maintain the mapping in a Hex-side table (e.g. `raw.dld_project_map` in the
`raw` schema — Zone A of the Entrestate platform side, NOT `public`). Refresh
`payload.priceIntelligence` (`pricePerSqft`, `vsCohortPct`, `cohortMedian`)
from DLD cohort medians — this directly drives the public "below market" rail.

### H4 — Area & developer profile aggregates
Recompute `freehold_site_area_profiles.avg_yield`, `median_price_aed`,
`project_count` (+ `payload.projectCount`) and developer
`payload.projectCount`/`activeProjects` from the projects table. The market
stats page filters on these; zero/NULL counts hide an area from stats.

### H5 — `llm_context` regeneration
After any enrichment batch, regenerate `llm_context` for touched rows: compact
plain-text digest (name, area, developer, price band, yield, score, flags,
2–3 unit lines, one aiNarrative sentence). This is what Gemini RAG actually
reads — stale context = wrong AI answers on live landing pages.

### H6 — Media integrity
Assert `hero_image` uniqueness, `gallery` length ≥ 1, `og_image` = hero.
(Historical spec: `data-request.md` — deterministic Picsum seeds until real
media replaces them.)

### H7 — Historical lead import (shared brain)
Bulk imports of tenant lead history go into `entrestate_lead_history` with the
correct `tenant_id` (`freehold`, or `entrestate-base` for the operator's seed
data), then signals are rebuilt per tenant. The platform exposes this at
`POST /api/freehold/base/import` (management-gated) — prefer the API; if
writing SQL directly, keep dimension values lowercase-trimmed exactly like the
platform's normalizer (max 80 chars).

### Upsert pattern (Zone A only)

```sql
INSERT INTO freehold_site_projects (id, slug, name, area, ..., payload, llm_context)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  price_from_aed = EXCLUDED.price_from_aed,
  payload        = EXCLUDED.payload,
  llm_context    = EXCLUDED.llm_context
  -- never: slug = EXCLUDED.slug  (slugs are referenced by landing pages)
```

### Verification queries (run after every batch)

```sql
-- Sync drift
SELECT COUNT(*) FROM freehold_site_projects
WHERE price_from_aed IS DISTINCT FROM NULLIF(payload->>'priceFrom','')::numeric;

-- Below-market rail health (should be > 0, sane)
SELECT COUNT(*) FROM freehold_site_projects
WHERE (payload->'priceIntelligence'->>'vsCohortPct')::float BETWEEN -50 AND -5;

-- Studio rule
SELECT COUNT(*) FROM freehold_site_projects,
  jsonb_array_elements(payload->'units') u
WHERE (u->>'bedrooms')::int = 0 AND u->>'type' <> 'Studio';

-- No PII in signals (must be 0 columns even capable of it — schema check)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'entrestate_targeting_signals'
  AND column_name IN ('name','phone','email','payload');
```

---

## 5. Corrections to the earlier (Gemini) blueprint — do NOT execute these

1. **`proxy.ts` stays.** Next.js 16 requires the single `proxy.ts` file; it IS
   the middleware (auth was merged into it deliberately). Refactoring it back
   to `middleware.ts` breaks the build.
2. **Cron endpoints are already secured.** `/api/cron/follow-ups` verifies
   `Authorization: Bearer ${CRON_SECRET}`. No open-loop execution exists.
3. **Tier gating already exists** — `api.client_configs.allowed_views` /
   `allowed_columns` enforced by the platform gateway. Do not build a parallel
   `tenant_visibility_rules.json`.
4. **`INVESTOR_ARCHETYPES`, `EVIDENCE_DRAWER_SCHEMA`, `calculate_match_score`
   are Hex-side artifacts, not platform contracts.** The repo has no such
   schemas. If archetype scores should reach the product, the landing path is:
   precompute in Hex → write into `payload` (new sub-object, e.g.
   `payload.archetypeScores`) + expose via a new `api.*` view gated by
   `client_configs` — never by editing platform TypeScript from the notebook.
5. **Do not "purge" root docs** (`data.md`, `blueprint.md`, etc.) — they are
   the data agent's own contracts (this file joins them).
6. **Translations**: the platform's i18n is code-reviewed and gate-checked
   (`pnpm i18n` parity EN/AR/RU). The notebook must not write `messages_*.json`
   directly; propose entity-name translation tables as data
   (e.g. `raw.entity_translations`) the app can consume later.

---

## 6. Guardrails summary (the never list)

- Never write Zone C tables.
- Never write PII outside `entrestate_lead_history.payload`.
- Never rewrite `slug` on an existing project.
- Never break `payload.units[]` shape (`bedrooms` int, `priceFrom` number, `type` string).
- Never overwrite observed values with imputed baselines; imputed ⇒ `confidence='estimated'`.
- Never render/store "0-bedroom" — Studio.
- Never drop the k≥5 anonymity threshold on cross-tenant benchmarks.
- Top-level columns and `payload` move together, always.
