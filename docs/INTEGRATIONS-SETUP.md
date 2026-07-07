# Integrations — Setup Guide (step by step)

How to connect every integration, in the order that gets a brokerage live
fastest. Each connection is made **inside the app** (Integrations page), is
**validated against the provider before it saves** (a green "Connected" means
it genuinely works), is **stored encrypted**, and immediately powers the
backend — launches, syncs and sends run server-side, not just in your browser.

> Who can connect: management roles (admin / CEO / director / sales manager)
> and marketing. Status at any time: the Integrations page or `GET /api/health`.

---

## 1. Meta Ads (Facebook + Instagram) — needed for the trial campaign

**What it unlocks:** launching real lead-gen campaigns, Ads Live monitoring,
lead-form leads flowing into the CRM, image uploads to the ad account.

**You need:** admin access to the company's **Meta Business Portfolio**
(business.facebook.com) that owns the ad account and the Facebook Page.

**Get a long-lived access token (recommended: System User — never expires):**
1. Go to **business.facebook.com → Settings (⚙) → Users → System users**.
2. **Add** a system user (name it e.g. `freehold-intelligence`, role: Admin).
3. **Add assets** to it: the **Ad account** (Manage) and the **Facebook Page** (Manage).
4. Click **Generate new token** → choose the business app → select scopes:
   - `ads_management` (create/manage campaigns)
   - `ads_read` (insights)
   - `pages_show_list` + `pages_manage_ads` (publish ads under the Page)
   - `leads_retrieval` (pull lead-form leads into the CRM)
5. Copy the token (starts with `EAAB…`). Store it somewhere safe — Meta shows it once.

> No system user / no developer app? Quick fallback: **developers.facebook.com
> → Tools → Graph API Explorer** → select the app → add the same scopes →
> Generate Access Token, then extend it to 60 days in **Tools → Access Token
> Debugger → "Extend Access Token"**. Fine for the trial; switch to a system
> user for permanent use.

**Connect in the app:**
1. **Integrations → Meta Ads** → paste the token.
2. The app lists the ad accounts the token can reach — **pick the ad account**
   and **pick the Facebook Page**.
3. **Save.** The app validates the token against the Meta Graph API before
   storing; success = genuinely connected. Optional: add the **Pixel ID** for
   conversion tracking.

**Verify:** the tile shows Connected; `api/health` shows `meta-ads: connected`;
Ads → New campaign no longer shows a connect gate.

**Troubleshooting**
- *"Meta rejected the token/account"* → token expired or missing a scope, or
  the system user isn't assigned to that ad account. Regenerate with the scopes
  above and re-assign assets.
- *Campaign launches but no leads arrive* → the token is missing
  `leads_retrieval`, or the Page isn't assigned to the system user.
- *Image upload fails* → token lacks `ads_management` on that ad account.

---

## 2. WhatsApp Business (Cloud API)

**What it unlocks:** the CRM messages leads on WhatsApp directly (and the
webhook can receive replies).

**You need:** a **WhatsApp Business** number registered on the **Cloud API**
(developers.facebook.com app with the WhatsApp product added).

**Get the credentials:**
1. **developers.facebook.com → your app → WhatsApp → API Setup.**
2. Copy the **Phone number ID** (a numeric ID under the phone number — *not*
   the phone number itself).
3. Token: the API Setup page shows a **temporary** (24h) token — fine for a
   test. For a permanent one, use a **System User token** (same steps as Meta
   above) with the `whatsapp_business_messaging` and
   `whatsapp_business_management` scopes.

**Connect in the app:** **Integrations → WhatsApp** → paste **Phone number ID**
+ **Access token** → Save (validated live against the Cloud API).

**Troubleshooting:** *401/403 on save* → token expired (24h temp token) or
missing the WhatsApp scopes. *Messages don't send* → the recipient must have
messaged you first OR you must use an approved **template** outside the 24-hour
customer-service window (Meta rule, not an app limitation).

---

## 3. HubSpot CRM

**What it unlocks:** two-way sync — push CRM leads to HubSpot contacts, pull
recent HubSpot contacts into the CRM (deduped by email).

**Get the token (Private App — 2 minutes):**
1. In HubSpot: **Settings (⚙) → Integrations → Private Apps → Create a
   private app.**
2. Name it (e.g. `Freehold Intelligence`), open the **Scopes** tab and enable:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
3. **Create app → Copy the token** (starts with `pat-…`).

**Connect in the app:** **Integrations → HubSpot** → paste the token →
Connect. The dashboard loads your live contacts/deals AND the token is saved
server-side (you'll see "Two-way sync enabled") so the backend Sync works.

**Use it:** Integrations → HubSpot → **Sync** (push / pull / both).

**Troubleshooting:** *"HubSpot rejected the token"* → missing the two contacts
scopes, or the token was copied partially. Regenerate and re-paste.

---

## 4. Google Ads (heavier setup — not needed for the Meta trial)

**What it unlocks:** Google Search campaigns (created paused), keywords,
audiences, extensions, reports.

**You need 5 credentials** (all pasted into **Integrations → Google Ads**):

| Field | Where to get it |
|---|---|
| **Developer token** | Google Ads → tools (🔧) → **API Center** (needs a Manager/MCC account; "Basic access" approval from Google can take days) |
| **OAuth Client ID** + **Client secret** | **console.cloud.google.com** → create a project → APIs & Services → **Credentials → Create OAuth client ID** (type: Web application) → enable the **Google Ads API** for the project |
| **Refresh token** | Authorize once with your client: easiest is Google's **OAuth 2.0 Playground** (settings → use your own client ID/secret → authorize scope `https://www.googleapis.com/auth/adwords` → exchange for tokens → copy the **refresh token**) |
| **Customer ID** | The 10-digit ID at the top-right of the Google Ads account (enter without dashes) |

Optional: **Login Customer ID** — the MCC id, if the account is managed through
a manager account.

**Connect in the app:** paste all five → **Save credentials.** The app
validates by refreshing the OAuth token *and* running a test query against the
Google Ads API before storing — success = launches will work.

**Troubleshooting:** *"Google rejected the OAuth credentials"* → client
ID/secret/refresh token mismatch (regenerate the refresh token with the same
client). *"Google Ads rejected the request"* → developer token not approved
yet, wrong customer ID, or missing login-customer-id for MCC setups.

---

## 5. Platform services (set once in Vercel — already operational)

These aren't connected in the UI; they live as environment variables
(Vercel → Project → Settings → Environment Variables). See
`docs/OPERATIONS-RUNBOOK.md` for the full table.

| Service | Env var | Status check |
|---|---|---|
| AI (creatives, Expert, reports) | `GEMINI_API_KEY` | `api/health → ai: connected` |
| Email notifications (lead assigned, password, low credit) | `RESEND_API_KEY` + from-addresses | send a test lead |
| Database | `DATABASE_URL` / `NEON_DATABASE_URL` | `api/health → neon: connected` |
| Sessions | `FH_SESSION_SECRET` | `api/health → session: connected` |
| Credential encryption | `FH_CREDENTIALS_KEY` (optional; falls back to session secret) | — |
| Cron (follow-up digests) | `CRON_SECRET` | Vercel cron logs |

---

## Recommended connection order for a new brokerage

1. **Meta Ads** → run the first trial campaign (see
   `docs/CAMPAIGN-LAUNCH-RUNBOOK.md`).
2. **WhatsApp** → so brokers can work the leads that arrive.
3. **HubSpot** → only if the client already lives in HubSpot.
4. **Google Ads** → start the developer-token approval early; connect when
   approved.

Every connection is per-provider, revocable in one click (Disconnect removes
the stored credential), and env vars always override in-app connections for
ops control.
