# Handover Notes — session close-out (2026-07-12)

**Repo:** `ezz-ae/ORE` · **main:** `c5ca4e9` (PR #183)
**System:** Entrestate Intelligence OS (white-label) · first tenant: Freehold Property UAE
**Purpose of this file:** the honest ledger of what is DONE, what is NOT done yet,
and everything a new session / new repo needs to know. Written at the point of
shifting development to a new repository.

---

## 1. Where the code stands

Main is the single source of truth. This session shipped and merged PRs
**#175–#183**, all gates green (`tsc`, `pnpm i18n` EN/AR/RU parity, `pnpm build`):

- #175 UI polish (dup upload, text stroke box, chat tone, editable landing blocks)
- #176 Meta + landing pages + Drive finalization (spend caps, CPL caps, UTM first-touch, sections_json)
- #177 Creative Studio / Notebook / Library (workflow handles, honest errors, library CRUD)
- #178 Chat transport ladder — Vertex → Gemini API key → grounded fallback (killed the "FAQ chat")
- #179 Platform-wide shape-up: smart targeting (`recommendTargeting`), gemini-rest 429/thinking fixes, safe AI errors
- #180 Coordinator builder tools: `ads_plan_campaign` / `ads_launch_campaign` (always launches PAUSED)
- #181 Creative Studio pointer-event fix (15 node files — dropdowns dead under ReactFlow v12)
- #182 Coach-tour overlay dismisses on outside click (it was freezing whole apps)
- #183 `hex-agent.md` — grounded data-agent blueprint

**Repo-history loss audit (completed this session): nothing is missing.**
195 files were ever deleted on main; 38 (the PR #159 bad-merge swallow) are all
recovered; the other 157 were deliberate cleanups. `middleware.ts` lives on as
`proxy.ts` (required by Next.js 16 — do not "restore" it).

---

## 2. NOT DONE YET — deployment actions (owner: Ezz, not code)

The code is ready for these; they are configuration, and until they're set the
app shows honest fallbacks instead of the real feature:

1. **Vercel `GEMINI_API_KEY` must come from the Tier-1 billed project**
   (`gen-lang-client-0814069297`, Tier 1 · Postpay, confirmed by screenshot),
   then **redeploy**. This unlocks real AI everywhere: Expert chat, landing AI
   edits, creative generation. Optional upgrade: `VERTEX_AI_SERVICE_ACCOUNT_JSON`
   (preferred transport in the ladder).
2. **`FAL_KEY`** — video generation in Creative Studio does nothing without it.
3. **Meta pixel** — pick a pixel in ads settings once the Meta account is
   connected; conversion signals, lookalikes and retargeting depend on it.
4. **`CRON_SECRET`** on Vercel — `/api/cron/follow-ups` (daily 05:00) requires it.
5. Full env-var inventory (everything the app reads — carry to any new repo/deploy):
   - Core: `DATABASE_URL` / `NEON_DATABASE_URL`, `FH_SESSION_SECRET`,
     `FH_CREDENTIALS_KEY`, `SESSION_COOKIE_DOMAIN`, `NEXT_PUBLIC_BASE_URL`,
     `NEXT_PUBLIC_SITE_URL`, `APP_URL`, `METADATA_BASE`, `DB_SCHEMA`,
     `ENTRESTATE_TENANT_ID` (defaults `freehold`), `CRON_SECRET`,
     `ADMIN_SETUP_KEY` / `CRM_ADMIN_SETUP_KEY`
   - AI: `GEMINI_API_KEY` (+`GEMINI_KEY` alias), `GEMINI_MODEL`,
     `GEMINI_MODEL_FALLBACKS`, `GOOGLE_API_KEY`, `VERTEX_AI_SERVICE_ACCOUNT_JSON`,
     `VERTEX_PROJECT`/`VERTEX_LOCATION`/`VERTEX_AI_API_KEY`,
     `GOOGLE_CLOUD_PROJECT`/`GOOGLE_CLOUD_REGION`, `FAL_KEY`, `ANTHROPIC_API_KEY`
   - Meta: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`,
     `META_PIXEL_ID`, `META_APP_SECRET`
   - Google Ads: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
     `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
     `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
   - WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
     `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
     `LEADS_WHATSAPP_WEBHOOK_URL`, `CRM_WHATSAPP_WEBHOOK_URL`
   - Email/notify: `RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL`, `LEADS_FROM_EMAIL`,
     `LEADS_NOTIFICATION_EMAIL`, `LEADS_NOTIFICATION_WHATSAPP`,
     `SALES_NOTIFICATION_EMAIL`, `CRM_NOTIFICATION_EMAIL`
   - Integrations: `HUBSPOT_TOKEN`

---

## 3. Product work — task board fully closed (final verification 2026-07-12)

Every task on the 150-item board is now completed. The four items previously
listed as open were re-verified against the code and turned out to be shipped
by later PRs (the board had lagged behind the code):

- **LP-1** ✓ — public landing pages have the trilingual `LangSwitcher` AND the
  day/night `ThemeToggle` (`app/lp/[slug]/page.tsx`, `lib/landing-theme.ts`).
- **ADS-2** ✓ — targeting builder (location/language/gender default-all,
  deselectable), templates, placements, pixel, AI multi-copy, and a **live Meta
  reach estimate** in wizard step 2 (`getReachEstimate` via
  `/api/freehold/ads/buyer-match`, honest "connect for a live estimate" state).
- **MB Phase 3 (Smart Landing flow)** ✓ — audience basics are first-class on
  step 2; **Data Quality Test** button on step 1
  (`/api/freehold/ads/data-quality`); generate → landing edit canvas (AI rail)
  → handoff to ad setup (`campaigns/new?project=…&lp=…` from the landings list).
- **MB Phase 5 (Creative + Landing test)** ✓ — creative via upload-to-Meta
  (`image_hash`), Library picker, Drive QR-stamp (#168); AI copy samples;
  **Landing Test** button running real pre-flight checks
  (`/api/crm/landing-pages/[slug]/test`); Meta instant lead-form variant (#167).

**Future enhancements — explicitly NOT built (by decision, not oversight):**

- **Carousel and video ad formats** — the Meta launch path is single-image link
  ads (+ instant form / WhatsApp / call destinations). Carousel
  (`child_attachments`) and video (advideos upload + processing poll) were left
  out rather than shipped unverified into the money path right before handover.
- **"Instant experience"** ad format and launch-time per-placement auto-resize
  (Creative Studio format presets cover resizing at design time).

Data-side gaps (also encoded in `hex-agent.md`, jobs H1–H7 — to be built in the
external Hex notebook, not in this repo):

- Media on `freehold_site_projects` are deterministic **Picsum placeholders**
  (per `data-request.md`) — real project media still needs to land in Neon.
- `payload.priceIntelligence` / the 6 intelligence blocks need a real
  DLD-reconciled refresh pipeline (Hex job H3) for the below-market rail.
- Network targeting benchmarks are only as good as imported history —
  `POST /api/freehold/base/import` is ready; historical lead imports are pending.
- No `updated_at` column on `freehold_site_projects`; "views" analytics feed
  doesn't exist (UI honestly shows 0/— by design, not a bug).

---

## 4. Known behaviors that look like bugs but are by design

- Agent-launched Meta campaigns are **always created PAUSED** — a human must
  start spend. Do not "fix" this.
- Empty/zero states across inventory, analytics, ads are **honest** — data is
  missing, not the wiring. Populate Neon, don't fabricate.
- The chat's offline fallback answers appear ONLY when no working AI key is
  configured (see §2.1).
- `proxy.ts` at the root IS the middleware (Next.js 16). Never rename it back.

## 5. Working-protocol notes for the next session / new repo

- **Verify gates before every ship:** `pnpm exec tsc --noEmit` (ignore stale
  `.next/types` errors), `pnpm i18n` (EN/AR/RU parity), `pnpm build`.
- **This cloud container silently reverts to a stale snapshot** (happened ~7
  times, incl. mid-turn). First command of ANY session:
  `git log --oneline -1` — if it isn't the latest main, run
  `git fetch origin main && git checkout -f -B <branch> origin/main`.
  Commit + push in small batches immediately; GitHub main is the only truth.
- Ship flow used all session: feature commits → push to the designated
  `claude/*` branch with `--force-with-lease` → PR to main → squash-merge.
  Never `merge -s ours` (that's what caused the #159 swallow).
- Data-agent contracts live at repo root: `data.md`, `data-request.md`,
  `hex-agent.md` (the grounded one — where it conflicts with older drafts or
  the Gemini transcript, `hex-agent.md` wins).

## 6. Shifting to a new repo — carry list

1. The full git history (clone/mirror, don't copy files — history holds the audit trail).
2. All env vars in §2.5 (same Neon DB — the Entrestate `api.*` /
   `raw` / `canonical` schemas and all `freehold_site_*` tables live there and
   move with the connection string, not the repo).
3. Vercel project settings: the cron entry (`/api/cron/follow-ups` @ `0 5 * * *`),
   Node runtime, and the domain (`SESSION_COOKIE_DOMAIN` must match).
4. The three data-agent docs (root `*.md`) and this file.
5. GitHub-side: branch protection on main if desired; the white-label rule —
   platform code stays tenant-agnostic, tenant config lives in
   `api.client_configs` in Neon.
