# Freehold Intelligence — Operations Runbook

The setup/deploy/operate companion to the [User Guide](./USER-GUIDE.md). For
**administrators and operators** — how to configure, connect, deploy and
maintain the platform. Nothing here is needed for day-to-day use.

> **Secrets:** never commit real tokens. Set them in the hosting provider's
> environment (Vercel → Project → Settings → Environment Variables) or, for the
> ad/messaging providers, connect them in-app (see §3). Environment variables
> always take precedence over in-app credentials.

---

## 1. Architecture at a glance

- **Framework:** Next.js 16 (App Router) + TypeScript, deployed on Vercel.
- **Database:** Neon Postgres. Tables are prefixed `freehold_site_*` (app data)
  and `freehold_*` (catalog). Access via `DATABASE_URL` / `NEON_DATABASE_URL`.
- **Auth:** two cookies are set at login and both must be valid:
  - `fh_session` — HMAC-signed, primary app session (`lib/auth-edge.ts`).
  - `freehold_site_session` — scrypt-backed, powers inherited CRM/admin APIs.
  Sessions last the working day, or 30 days with "Remember me".
- **Edge middleware:** `proxy.ts` fail-closes every API route except a public
  allowlist, and gates ad-write routes to the `marketing`/management roles.
- **AI:** Google Gemini (primary) via `GEMINI_API_KEY`; optional Vertex/Anthropic.
- **Rate limiting:** in-memory per instance today (see beta plan B8 for the
  shared-store upgrade before high traffic).

---

## 2. Environment variables

### Required (core)
| Var | Purpose |
|---|---|
| `DATABASE_URL` (or `NEON_DATABASE_URL`) | Neon Postgres connection string |
| `FH_SESSION_SECRET` | Signs the `fh_session` cookie — **must be set in prod** |
| `NEXT_PUBLIC_SITE_URL` / `APP_URL` | Canonical public URL (links in emails, OG) |
| `CRON_SECRET` | Bearer token that authorizes the daily cron (see §5) |

### AI
| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini access (content, Expert, ad copy) |
| `GEMINI_MODEL` / `GEMINI_MODEL_FALLBACKS` | Override the default model + fallback chain |
| `ANTHROPIC_API_KEY` | Optional — alternate Expert model |
| `VERTEX_*` / `GOOGLE_CLOUD_*` | Optional — Vertex AI instead of the public API |

### Email & notifications (Resend)
| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Sends lead-assigned, password-changed, low-credit emails |
| `NOTIFICATIONS_FROM_EMAIL` / `LEADS_FROM_EMAIL` | From-addresses |
| `LEADS_NOTIFICATION_EMAIL` / `SALES_NOTIFICATION_EMAIL` | Ops inboxes |

### Ad & messaging providers
These can be set as env vars **or** connected in-app (§3). Env wins.
| Provider | Vars |
|---|---|
| Meta Ads | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `META_PIXEL_ID`, `META_APP_SECRET` |
| Google Ads | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` |
| WhatsApp Cloud | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| HubSpot | `HUBSPOT_TOKEN` |

### Setup / admin
| Var | Purpose |
|---|---|
| `ADMIN_SETUP_KEY` / `CRM_ADMIN_SETUP_KEY` | Guards one-time setup + admin purge endpoints |
| `SESSION_COOKIE_DOMAIN` | Set when serving the app on a custom domain |
| `FH_CREDENTIALS_KEY` | Optional. Key used to encrypt stored integration tokens at rest (AES-256-GCM). Falls back to `FH_SESSION_SECRET` if unset. Rotating it makes previously stored in-app connections unreadable — reconnect them after a rotation. |

---

## 3. Connecting integrations (in-app)

Marketing + management roles can connect providers without touching env vars:

**Integrations → provider → paste credentials → Save.** The save endpoint
**validates the token against the provider's live API before storing it**, so a
bad token is rejected at save time, not at launch time. Stored credentials live
in `freehold_site_integration_credentials` (one row per provider) and are
**never returned** by any API — only a "connected / not connected" state.

- **Meta Ads:** paste a long-lived token, pick the ad account + Facebook Page.
- **WhatsApp:** connect the Business number; the CRM can then message leads.
- **HubSpot:** connect the private-app token, then run a sync (push CRM leads,
  pull HubSpot contacts, deduped by email).
- **Google Ads:** created paused; flip live in Google after review.

Precedence: **env var → stored credential → demo mode.** An unconnected
provider runs on realistic demo data so flows can be trialled first.

---

## 4. Deploy

1. Push to the deploy branch; Vercel builds automatically.
2. Ensure all **Required** env vars (§2) are present in the Production
   environment before the first real session.
3. Verify locally before promoting: `pnpm build` must pass, and:
   - `npx tsc --noEmit` — no type errors
   - `pnpm i18n` — full EN/AR/RU translation parity
4. GitHub Actions must be **enabled** in repo Settings for CI to run (beta
   plan B3 — the workflow is correct; jobs otherwise never reach a runner).

---

## 5. Scheduled jobs (cron)

| Path | Schedule (UTC) | Does |
|---|---|---|
| `/api/cron/follow-ups` | `0 5 * * *` (daily 05:00) | Surfaces overdue follow-ups / SLA breaches |

The route requires `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends this
automatically once `CRON_SECRET` is set. To add a job: add an entry to
`vercel.json → crons` and a matching route under `app/api/cron/*`.

---

## 6. Database

- **Connection:** use the Neon **pooled** connection string. From restricted
  networks, use Neon's HTTPS SQL endpoint (port 443) rather than raw TCP 5432.
- **Backups:** Neon keeps automatic point-in-time backups; verify the retention
  window matches the client's requirement in the Neon console.
- **Schema:** app tables are `freehold_site_*`. See the data dictionary
  (beta plan G6) for column-level detail.
- **Danger — purge:** `/api/admin/purge` (guarded by `ADMIN_SETUP_KEY`) deletes
  all leads and demo data. Use only when resetting a fresh client tenant.

---

## 7. Roles & access

Six roles: `broker`, `sales_manager`, `marketing`, `director`, `ceo`, `admin`.
Access is enforced on **every screen and every data request** (not just the
nav) — a role never sees data it isn't entitled to, even via a direct link. The
single source of truth is `lib/freehold/apps.ts` (nav + guard) and
`lib/freehold/session-types.ts` (role definitions). See the
[Access Matrix](./ACCESS-MATRIX.md) for the full route table.

---

## 8. White-label re-brand

To ship the platform for a different brokerage, edit **only**
`lib/freehold/brand.ts`: `company`, `product`, `accent` (drives the gold
token → full re-skin), `domain`, `legalName`, `tagline`. Everything else reads
from design tokens, so one edit re-skins the whole product.

---

## 9. Health & troubleshooting

- **Health check:** `GET /api/health` reports DB + integration status.
- **Integration shows "not connected" after saving:** the token failed live
  validation — re-check scopes/expiry and re-save.
- **Emails not sending:** confirm `RESEND_API_KEY` and the From-addresses; check
  the Resend dashboard for bounces.
- **AI errors:** confirm `GEMINI_API_KEY`; the model falls back through
  `GEMINI_MODEL_FALLBACKS` before failing.
- **Everyone logged out after deploy:** `FH_SESSION_SECRET` changed — keep it
  stable across deploys.
