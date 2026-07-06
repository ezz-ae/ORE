# Entrestate White-Label OS — Extraction & Go-To-Market Blueprint

**Status:** planning · **Seller:** entrestate.com · **Source:** hard fork of ORE
**Prime rule:** Freehold's system, data, brand, and operations are never touched, shared, or affected.

---

## 1. What the product is

Everything ORE already does — public property site, discovery layer, AI intelligence
(chat, CRM assistant, brochure-to-listing, market analytics), broker dashboard, CRM,
WhatsApp automation, landing-page engine, ads tooling — packaged as a **multi-tenant,
white-label Real Estate Operating System**. A brokerage buys it and gets the full
system under **their brand, their domain, their data** in minutes, not months.

Entrestate.com is the seller and operator. Freehold remains simply the first
proof that the system works; it is not a tenant, not a customer, not a dependency.

## 2. How we sell it — the AI-call landing experience

The funnel IS the product demo. No sales team, no "book a call next Tuesday".

```
Instagram ad (localized: Arabic first, then Russian, Urdu)
        │  "Your entire brokerage, run by AI. See YOURS in 3 minutes."
        ▼
lp.entrestate.com — no form, one button: "Talk to it"
        │  In-browser AI voice call (WebRTC mic — no phone number, no app)
        ▼
AI agent greets the broker, asks two things:
   "What's your company called?" · "What's your website or Instagram?"
        │
        ▼  (while the conversation continues)
┌─ PROVISIONING PIPELINE — runs in the background, target < 3 min ─────────┐
│ 1. Scrape their site/Instagram → logo, colors, name, listings, phone     │
│ 2. Create tenant row in registry (client_configs) + subdomain            │
│    e.g. acme.entrestate.com                                              │
│ 3. Inject brand tokens (logo, palette, fonts, contact, locale/RTL)       │
│ 4. Seed data: their scraped listings + market demo data                  │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
The landing page MORPHS live into their branded system while the AI narrates:
   "This is your dashboard… these are your listings… this is your AI
    answering a buyer in Arabic right now…"
        ▼
Close, in-call: "This system is live at acme.entrestate.com for the next
7 days. Claim it now and it's yours." → Stripe checkout → demo tenant
becomes the paid account. Nothing to migrate — the demo IS the product.
```

Why this works:
- **Zero-friction demo-led growth.** The prospect experiences ownership before paying.
  The demo tenant is real; abandoning it feels like a loss (endowment effect).
- **The AI call is proof of the flagship feature.** They're being sold BY the thing
  they're buying: an AI that talks to leads in their language.
- **Localized one language at a time** (per the earlier strategy): Arabic voice agent +
  Arabic ads first — the codebase already ships RTL and Arabic dictionaries. Then
  Russian (already in i18n), then Urdu. Each language is its own ad campaign, voice,
  and objection script.

### Ad channels
Instagram/Facebook (broker-targeted, GCC + Pakistan diaspora), TikTok & Snapchat Arabic
(Gulf reach), Google Search on "real estate CRM / property website" intents in each
language. LinkedIn for the agency tier.

### Pricing shape (v1 proposal — validate in first 20 calls)
| Tier | For | Contents | Price idea |
|---|---|---|---|
| Launch | solo agent / small team | branded site + listings + AI chat | ~$399/mo |
| Brokerage | teams | + CRM, WhatsApp automation, dashboard, leads | ~$999/mo |
| Empire | established brokerages | + AI voice calls, ads tooling, analytics, own domain | ~$2,500/mo + AI usage |
| Setup | optional | data import, domain, training | one-time |

AI voice minutes metered above an included quota (voice AI has real per-minute cost).

## 3. Hard separation rules (non-negotiable)

| Layer | Freehold (stays as-is) | Entrestate OS (new) |
|---|---|---|
| Repo | ezz-ae/ORE | **new repo** (e.g. `ezz-ae/entrestate-os`) |
| Hosting | existing Vercel project | separate Vercel project + team |
| Domain | freeholdproperty.ae | entrestate.com + `*.entrestate.com` wildcard |
| Database | Freehold tables in Neon | Entrestate schemas (`api`/`canonical`/`raw`) via **their own scoped DB role** — no access to Freehold tables. Later: separate DB instance |
| CRM/WhatsApp | Freehold HubSpot + number | per-tenant connectors; Entrestate's own for the funnel |
| API keys | Freehold's Google/Meta/etc. | all new keys under Entrestate accounts |
| Deploys | never blocked/affected by white-label work | independent CI |

The existing `lib/entrestate/` bridge in ORE stays read-only and additive, exactly
as built — it is Freehold *reading from* the data platform, not a coupling.

## 4. Architecture of the new repo

**Foundation that already exists** (this is why the fork is viable):
- Tenant registry: `api.client_configs` (tier, allowed_views, allowed_columns,
  rate_limit) + per-tenant connectors — already live in Neon.
- Access gateway pattern: `lib/entrestate/gateway.ts` — per-tenant view/column
  allow-lists, strict identifier validation. Port and extend to read-write.
- i18n with RTL (en/ar/ru), landing-page engine (`app/lp/[slug]`), embed API,
  Gemini AI features, WhatsApp session code, ads tooling.

**What the fork changes:**
1. **Brand inversion.** Everything hardcoded in `lib/site.ts` (domain, phone,
   WhatsApp, email, OG images) plus ~434 files referencing "freehold" become a
   `TenantBrand` config resolved per request: middleware maps
   `{subdomain|custom domain} → tenant` and hydrates brand tokens (logo, palette
   CSS variables, contact, locale, RTL) into layout. Module rename
   `freehold-intelligence` → `intelligence` is mechanical.
2. **Data goes multi-tenant.** Static `src/data/*.ts` (projects, leads, reports)
   moves into tenant-keyed tables/views behind the gateway. Market-wide Dubai data
   (3500 projects, DLD, area analytics) becomes a **shared read-only layer** every
   tenant benefits from — that's a moat no solo brokerage can build.
3. **Provisioning API** — the "minutes" engine:
   `POST /api/provision { name, url }` → scrape → brand-extract → create tenant →
   seed → return live subdomain. Must be idempotent and < 3 min p95. This endpoint
   is what the sales AI calls mid-conversation.
4. **AI voice layer.** In-browser realtime voice (Gemini Live API fits the existing
   Google stack; Vapi/Retell as faster-to-ship alternative). Two agents:
   - *Seller agent* (entrestate funnel): qualifies, triggers provisioning, narrates
     the morph, closes to checkout.
   - *Tenant agent* (the product): answers the tenant's buyer leads in the tenant's
     brand and language — same pipeline, per-tenant prompt + voice.
5. **Billing.** Stripe subscriptions keyed to tenant tier; demo tenants expire in
   7 days unless claimed; usage metering for AI minutes.

## 5. Extraction roadmap

| Phase | Work | Nature |
|---|---|---|
| 0 | Create new repo + Vercel + wildcard domain + scoped DB role | setup, days |
| 1 | Hard fork ORE; strip Freehold data/copy/images; rename modules; brand → `TenantBrand` config | mostly mechanical, the 434-file sweep |
| 2 | Tenant middleware (subdomain → config), gateway extended read-write, static data → tenant tables | core engineering |
| 3 | Provisioning API + brand scraper + seeder ("minutes" engine) | core engineering |
| 4 | Seller voice agent + landing morph experience on lp.entrestate.com | the funnel |
| 5 | Stripe + demo-expiry + tenant self-serve settings | monetization |
| 6 | Arabic ad campaign live → first 20 AI-sold demos → iterate script & pricing | GTM |

Phases 2–4 are where the real risk lives; everything else is known work.

## 6. Immediate next steps

1. Create the new GitHub repo and add it to a Claude session (`add repo`) — the
   current session is scoped to ezz-ae/ORE only, so the fork can't be pushed
   elsewhere from here.
2. Decide voice stack: Gemini Live (stack-native, more build) vs Vapi/Retell
   (fastest to a working Arabic demo).
3. Confirm the tenant data contract: which `api.*` views exist today in the
   Entrestate schemas and which are still to be built.
