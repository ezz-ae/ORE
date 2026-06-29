# Freehold Intelligence — Finalization Plan

_Audit of this session's work + current platform state + a prioritized plan to
take it fully live._

---

## Part 1 — What changed this session (edit audit)

All merged to `main`, each verified with `tsc --noEmit` + `pnpm i18n` (full
EN/AR/RU parity) + `pnpm build` before merge.

| PR | Theme | Highlights |
|----|-------|-----------|
| **#8** | Readiness + security | Auth-guarded all 20 Google/Meta ad routes (were anonymous, incl. ad-spend); role-gated `analytics/leads` + `management/analytics`; fixed landing create→publish (was a no-op); retired all secondary AI chats → one docked Expert; Meta local-store fallback; `/lp` stops inventing testimonials/ROI/developer stats; Sales Team & Sales Performance mini-apps → live CRM data; honest catalog fallback. |
| **#9** | Integrations + auth | Real **HubSpot** client (private-app token) + two-way sync + live status; **Meta/Google ads** ready via env credentials; **auth unified** (one sign-in across platform+CRM) + logout clears both cookies. |
| **#10** | UX + docs | `/api/health` readiness endpoint; **coach marks** now smart (only highlight on-screen targets) + strong spotlight; **full user guide** (`docs/USER-GUIDE.md`); CRM brand colors + declutter; Notebook single-chat; integrations i18n started. |
| **#11** | Broker + inventory | **Broker 360° profile actions** (add credits, assign lead); **fixed "only 2 names" assignment** (seed full ~28 roster); **inventory editor rearranged** (roomy); integrations hub i18n. |
| **#12** | Broker | **"Add lead"** profile action + new create-lead endpoint. |

Net: **~13 commits**, security holes closed, AI consolidated, real integrations
wired, broker command-center started, coach/colors/docs done.

---

## Part 2 — Current platform state (audit)

### ✅ Real & working (code-complete)
- **Auth** — password login, scrypt hashing, unified session, reset, bootstrap-admin, RBAC on pages + APIs.
- **CRM** — leads, pipeline, deals, follow-ups, assignment, lead 360°; real DB-backed.
- **Broker profile** — 360° read-out + 3 actions (credits, assign lead, add lead).
- **Ads** — Meta/Google clients call live APIs; local-store demo fallback when unconnected.
- **HubSpot** — real client + sync, live on `HUBSPOT_TOKEN`.
- **AI** — Expert + Web Studio generation via Gemini, template fallback.
- **i18n** — EN/AR/RU + RTL; guard enforces parity.
- **Coach marks** — role + per-app tours, smart, translated.

### ⚙️ Code-ready, needs config to be "live" (NOT bugs)
- **Live data** — needs `DATABASE_URL` (Neon, pooled) in Vercel.
- **AI** — needs `GEMINI_API_KEY`.
- **HubSpot sync** — needs `HUBSPOT_TOKEN`.
- **Meta ads** — `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID` (funded account).
- **Google ads** — `GOOGLE_ADS_DEVELOPER_TOKEN`/`CLIENT_ID`/`CLIENT_SECRET`/`REFRESH_TOKEN`/`CUSTOMER_ID`.
- **Sessions** — `FH_SESSION_SECRET` (avoid the insecure dev fallback).
- **Payments / "add money"** — **no processor integrated** (deferred by choice). Credits are an admin ledger grant, not real money.

### ⏳ Incomplete / known gaps
1. **Broker profile** — missing 2 of 5 actions: **add/remove on a deal** (needs a co-agent endpoint) and the deal picker UI.
2. **Terminology** — same role shown as "Broker"/"Agent"/"Sales Advisor" in different places; needs one term ("Broker") everywhere.
3. **Translation** — ~40 client files still have hardcoded English (integrations layout+hub done; provider pages, Web Studio, apps, lead-machine remainder, misc remain).
4. **Inventory generate page** — relayouted; deeper field-grouping polish optional.
5. **Orphan fabricated routes** — `apps/dashboard/*`, `apps/market`, `screentime`, `data-engineering` exist but aren't navigable; should be deleted.
6. **Public marketing stats** — hardcoded figures (hero "3,500+", market pages) left by choice ("internal only"); revisit before public launch.

---

## Part 3 — Finalization plan (prioritized)

### Phase 0 — Go-live config (you, ~15 min, no code)
1. Set the env vars above in Vercel (`freehold` project, Production) and redeploy.
2. Verify at `/api/health` → `db:true`, integrations `connected`.
3. Rotate the Neon password (it was shared in plaintext).

### Phase 1 — Finish the broker command-center (code, ~1 pass)
- Build co-agent **add/remove on a deal** endpoint + deal picker on the profile.
- This completes all 5 requested actions (credits, assign, add-lead, add-to-deal, remove-from-deal).

### Phase 2 — Terminology unification (code, ~1 pass)
- One term **"Broker"** across UI + i18n; remove the "Agent"/"Sales Advisor"/"brokers vs agents" inconsistency the client flagged.

### Phase 3 — Translation sweep (code, parallel workflow recommended)
- ~40 files → EN/AR/RU. Fastest via a parallel agent workflow; otherwise cluster-by-cluster (integrations provider pages → Web Studio → apps → lead-machine → misc).

### Phase 4 — Cleanup (code, small)
- Delete orphan fabricated routes (`apps/dashboard/*`, `apps/market`, `screentime`, `data-engineering`).
- Decide public marketing stats (remove/verify) before any public launch.

### Phase 5 — Decisions for you (product)
- **Payments**: integrate a processor (Stripe / Tap / PayTabs) if "add money" must be real, or keep credits as admin-granted.
- **Ads OAuth**: env credentials (current) vs user-facing "Connect" buttons (needs Meta/Google app review).

### Definition of done
- `/api/health` all green in production · every reachable button works · no fabricated numbers on reachable surfaces · one term for brokers · all pages EN/AR/RU · broker profile fully actionable.

_Recommended order: **Phase 0 now** (unblocks the meeting/demo), then 1 → 2 → 3 → 4._
