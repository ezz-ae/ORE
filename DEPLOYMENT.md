# DEPLOYMENT — Private White-Label Deployment Playbook

Every client company gets its **own private deployment** of this codebase — its own
Vercel project, its own Postgres database, its own domain, its own credentials.
There is **no multi-tenancy**: nothing is shared between deployments.

Re-branding is **configuration only**. All user-visible brand surfaces (naming,
accent colour, contact details, emails, AI prompts, public URLs, lead serials)
read from `lib/freehold/brand.ts`, which reads `NEXT_PUBLIC_BRAND_*` environment
variables. A deployment that sets none of them runs exactly as the original
Freehold deployment does today. Internal identifiers (DB table names
`freehold_site_*`, route namespaces `/freehold-intelligence/*` and
`/api/freehold/*`, the `fh_session` cookie, `FH_*` env prefixes, module paths)
are deliberately **not** branded — they are invisible to users and stable across
deployments.

---

## 1. Prerequisites

1. **Empty Postgres database** (Neon works well; any Postgres does). Tables are
   created lazily by the app (`ensure*` migrations) — no schema script to run.
2. **Vercel project** connected to a private copy of this repository
   (`vercel.json` carries the cron definitions — keep it).
3. **Domain** for the public site, with DNS pointed at Vercel
   (recommended: apex + `www`).

## 2. Environment variables

Set these in the Vercel project (Production). Names are exact.

### Required to boot

| Variable | Purpose |
|---|---|
| `DATABASE_URL` (or `NEON_DATABASE_URL`) | Postgres connection string. |
| `FH_SESSION_SECRET` | Session-signing secret (long random string). The app **refuses to run in production without it**. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL, e.g. `https://www.client-domain.com`. One variable now covers everything — see §3. |
| `SESSION_COOKIE_DOMAIN` | Cookie scope, e.g. `.client-domain.com`. Without it, production falls back to `.<NEXT_PUBLIC_BRAND_DOMAIN>`. |
| `ADMIN_SETUP_KEY` (or `CRM_ADMIN_SETUP_KEY`) | One-time key that authorises the first-admin bootstrap call (§5.1). |
| `VERTEX_AI_SERVICE_ACCOUNT_JSON` **or** `GEMINI_API_KEY` | AI transport. Vertex service-account JSON is the primary path; a plain Gemini API key also works. Without either, AI surfaces degrade to grounded fallbacks. |

### Recommended

| Variable | Purpose |
|---|---|
| `FH_CREDENTIALS_KEY` | AES-256-GCM key for integration credentials saved in-app (Integrations page). Set it before connecting anything in-app. |
| `CRON_SECRET` | Bearer token protecting the five cron endpoints (§5.6). Vercel sends it automatically once set. |
| `RESEND_API_KEY` | Transactional email (lead alerts, password resets, digests). |
| `LEADS_FROM_EMAIL` / `NOTIFICATIONS_FROM_EMAIL` | From addresses for outbound email. Default From is built from the brand config: `"<EMAIL_FROM> <hello@<BRAND_DOMAIN>>"`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage (brochures, cloud drive, creative-studio assets). |

### Brand (all optional — defaults are the Freehold values)

| Variable | Default | Drives |
|---|---|---|
| `NEXT_PUBLIC_BRAND_COMPANY` | `Freehold` | All visible naming, AI prompts, email signatures. |
| `NEXT_PUBLIC_BRAND_PRODUCT` | `Intelligence` | Product word (e.g. "Acme **Intelligence**"). |
| `NEXT_PUBLIC_BRAND_LEGAL_NAME` | `Freehold Property` | Legal entity in footer, titles, prompts (rendered as "… UAE" on public pages). |
| `NEXT_PUBLIC_BRAND_TAGLINE` | `Authorized Personnel Only` | Sign-in screen sub-text. |
| `NEXT_PUBLIC_BRAND_ACCENT` | `#D4AF37` | `--color-gold` token → every accent in the product, landing pages and microsites. |
| `NEXT_PUBLIC_BRAND_DOMAIN` | `freeholdproperty.ae` | Public links, derived URLs (`https://<domain>/privacy`), derived emails, cookie-domain fallback, ICS UIDs. |
| `NEXT_PUBLIC_BRAND_PHONE` | `+971 50 417 3622` | Display phone everywhere. |
| `NEXT_PUBLIC_BRAND_PHONE_E164` | `+971504173622` | `tel:` links; WhatsApp number is derived from it (digits only). |
| `NEXT_PUBLIC_BRAND_EMAIL` | `info@<domain>` | Public contact email. |
| `NEXT_PUBLIC_BRAND_EMAIL_FROM` | `Freehold` | Display name on transactional From headers. |
| `NEXT_PUBLIC_BRAND_SUPPORT_EMAIL` | `support@<domain>` | Billing/support links. |
| `NEXT_PUBLIC_BRAND_LEGAL_EMAIL` | `legal@<domain>` | Contract/legal links. |
| `NEXT_PUBLIC_BRAND_ADDRESS` | `Business Bay, Dubai, UAE` | Footer lines, landing-page footers, JSON-LD street address. |
| `NEXT_PUBLIC_BRAND_LEAD_PREFIX` | `FH` | Lead serials (`FH-0001`). **Fresh databases only** — see §4. |
| `NEXT_PUBLIC_BRAND_TIMEZONE` | `Asia/Dubai` | Displayed operation timezone. |

These are `NEXT_PUBLIC_*`, i.e. **inlined at build time** — changing them
requires a redeploy, and Preview/Production must both carry them.

The Settings → Brand tab in the product shows these live values read-only; it
does not (and cannot) edit them.

### Per-integration (each optional)

Meta, WhatsApp, Google Ads and HubSpot can be connected **in-app**
(Freehold Intelligence → Integrations); credentials entered there are stored
AES-encrypted in the database under `FH_CREDENTIALS_KEY`. Env vars are the
alternative for infrastructure-managed secrets — either path works:

- **Meta Ads**: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, optional `META_PIXEL_ID`.
- **WhatsApp Cloud API**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, optional `WHATSAPP_APP_SECRET`.
- **Google Ads**: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
- **HubSpot**: `HUBSPOT_TOKEN` (or connect in-app).
- **Anthropic** (WhatsApp AI-assist / recap): `ANTHROPIC_API_KEY`.
- **FAL** (creative studio image/video generation): `FAL_KEY`.

## 3. One URL convention

Historically some code read `NEXT_PUBLIC_SITE_URL` and some read
`NEXT_PUBLIC_BASE_URL`. These are now unified: `getSiteUrl()` resolves
`NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_BASE_URL → METADATA_BASE → Vercel URLs →
https://www.<BRAND_DOMAIN>`. **Setting `NEXT_PUBLIC_SITE_URL` alone covers
both.** No hardcoded `freeholdproperty.ae` fallback remains in app code.

## 4. Lead serial prefix — fresh databases only

The lead code column is a Postgres **generated column** created on first run:
`<LEAD_PREFIX>-0001`, from `NEXT_PUBLIC_BRAND_LEAD_PREFIX`. A brand-new
database therefore gets the client's prefix automatically. An **existing**
database keeps its original column — generated columns are never ALTERed by
the app, so the original `FH-` prefix persists on databases created before the
variable was set. If a client insists on changing an existing database, that is
a manual DBA operation (drop + recreate the generated column), not something
this app does.

## 5. Post-deploy steps (manual, in order)

1. **Bootstrap the first admin** (one-time; endpoint disables itself once an
   admin exists):
   ```bash
   curl -X POST https://www.client-domain.com/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"setupKey":"<ADMIN_SETUP_KEY>","email":"owner@client.com","password":"<min 8 chars>","name":"Owner"}'
   ```
2. **Create the team** in-app: Freehold Intelligence → Team. Roles gate
   everything (CRM visibility, AI skills, approvals).
3. **Connect integrations** in-app (Integrations page): Meta Ads, WhatsApp,
   Google Ads, HubSpot. The status page shows live connected/missing state per
   integration — it reads real credentials, nothing is simulated.
4. **Meta App Dashboard** (cannot be automated): point the app's
   Webhooks product at this deployment — `leadgen` webhook for lead forms and
   the WhatsApp webhook (URL + `WHATSAPP_WEBHOOK_VERIFY_TOKEN`) for messaging.
   Ensure the access token's app has `leads_retrieval` / `ads_management`.
5. **Populate the project catalog** — a fresh database has **zero projects**:
   - upload developer brochures in-app (AI brochure parsing creates listings), or
   - import rows directly into the projects tables from an existing dataset.
6. **Replace `data.md`** (repo root) with the client's own AI knowledge file.
   It is the public AI advisor's knowledge/prompt source; shipping it unchanged
   means the public chat speaks with Freehold's knowledge base.
7. **Replace brand assets in `public/`** (files, not code):
   `freehold-logo.png` (header/footer logo), `og-image.png`, `ai-og.png`,
   `icon.png`, `apple-icon.png`, `favicon.ico`, `site.webmanifest`, `logo.png`.
8. **Verify the crons fire** (Vercel → Crons; all five are defined in
   `vercel.json`, authorised via `CRON_SECRET`):
   - `/api/cron/project-profiles` — Mondays 02:00
   - `/api/cron/sync-meta-leads` — daily 03:00
   - `/api/cron/opportunity` — daily 03:30
   - `/api/cron/ads-machine` — daily 04:00
   - `/api/cron/follow-ups` — daily 05:00

## 6. Honest residue — what config does NOT cover

- **Marketing narrative copy**: the public About/Services/Terms pages carry the
  Freehold story ("19 years", "3,500+ projects", RERA ORN 28628 in the footer).
  Brand *names* in them are env-driven, but the narrative facts are content —
  review and edit these pages (or hide them) per client.
- **Social links**: Instagram/Facebook/LinkedIn URLs in the site footer and
  contact page are Freehold's accounts (no brand variable exists for them) —
  edit or remove per client.
- **Derived accent shades**: landing pages use a few fixed near-gold shades
  (`#E8C547` hover, `#9B8020`/`#C9A227` tier stripes, `#8E6D1A` day-mode text
  remap). The main accent re-skins via `NEXT_PUBLIC_BRAND_ACCENT`; these
  derived shades stay gold-ish unless edited.
- **Arabic transliteration**: with no brand env set, Arabic copy uses فريهولد.
  A re-branded deployment renders the Latin company name inside Arabic/Russian
  copy (standard practice for brand names).
- `scripts/smoke.ts` defaults its production target to the Freehold domain —
  set `PRODUCTION_URL` / `STAGING_URL` when running smoke tests.
