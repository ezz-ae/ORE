# White-label demo — operator runbook

How to stand up a **branded demo** of this system for a prospect: they open a
login page, redeem an access key you gave them, set their brand name + logo, and
enter the full platform pre-loaded with realistic data — their company, live.

This is the **same codebase** as Freehold, deployed separately with one flag on.
When `NEXT_PUBLIC_WHITE_LABEL` is unset (the Freehold production deployment),
none of this activates and the product behaves exactly as before.

**Model:** one shared demo dataset, re-skinned per workspace · one key = one
branded workspace.

---

## 1. Extract into the new repo

The white-label build lives in `main`. To run it as its own product:

```bash
# in the new empty repo you created (e.g. ezz-ae/freehold-whitelabel)
git clone https://github.com/ezz-ae/ore.git .
git remote set-url origin https://github.com/ezz-ae/<new-repo>.git
git push -u origin main
```

Keeping `ore` as an upstream remote lets you pull core improvements later
(`git remote add upstream https://github.com/ezz-ae/ore.git`, then
`git fetch upstream && git merge upstream/main`).

## 2. Deploy config (Vercel + Neon)

Set these on the new project. The **only** three that differ from a normal
deployment:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_WHITE_LABEL` | `1` — turns on the demo mode (activation gate, runtime brand) |
| `WL_ADMIN_SECRET` | a long random string you keep — authorises minting keys |
| `NEON_DATABASE_URL` | a **fresh, empty** Neon database — never Freehold's |

Also set the usual `FH_SESSION_SECRET` (session signing) and any AI keys you
want the demo's AI features to use. Everything else keeps its defaults.

## 3. Seed the demo data

Fill the database so every screen is alive on entry:

```bash
NEXT_PUBLIC_WHITE_LABEL=1 DATABASE_URL=<demo-db-url> pnpm seed:demo
```

Seeds 8 team members, 8 Dubai projects, 54 CRM leads across the pipeline,
won/pending deals with commissions, finance entries, tasks, calendar events,
an activity feed, Meta + Google campaigns, and broker credits.

- **Idempotent** — re-running does nothing (a sentinel detects it's seeded).
- **Re-seed fresh:** `… pnpm seed:demo --reset` (wipes the demo rows first).
- **Safety:** the script refuses to run unless `NEXT_PUBLIC_WHITE_LABEL=1`. It
  can never seed Freehold's database.

## 4. Mint access keys

**Option A — the vendor console (no terminal):** open `/wl-admin`, paste your
`WL_ADMIN_SECRET`, and mint keys. You'll see all keys and their status
(active / redeemed / revoked). The secret is held in the browser only.

**Option B — the API:**

```bash
curl -X POST https://<your-demo>.vercel.app/api/wl/keys \
  -H "x-wl-admin: <WL_ADMIN_SECRET>" \
  -H "content-type: application/json" \
  -d '{"count":1,"label":"Skyline demo","expiresAt":"2026-12-31"}'
# → {"keys":["WL-XXXX-XXXX-XXXX"]}
```

## 5. The prospect activates

Give the prospect the key. They:

1. Open `/activate` (any unauthenticated visit redirects here).
2. Enter the key, their brand name, an accent colour, and (optionally) a logo.
3. Click **Enter my system** — and land in the full platform, re-skinned as
   their company, full of demo data.

The key is now `redeemed` and can't be reused.

---

## How the re-skin works

- A signed `wl_workspace` cookie carries the brand snapshot (name, product,
  accent, logo URL). The root layout reads it and paints the tree.
- `--color-gold` is overridden per workspace, so buttons/highlights adopt the
  brand accent.
- `useBrand()` + the i18n `{brand}` / `{brandName}` tokens re-skin the nav
  wordmark, the AI **Expert** title, hub/Notebook/agent labels, and the public
  header/footer logo — in EN/AR/RU.
- The uploaded logo is stored in the DB and served from `/api/wl/logo` (never
  in the cookie). A workspace with no logo shows its name as a wordmark.

## What's gated / safe

- Minting keys requires `WL_ADMIN_SECRET` (fails closed if unset).
- `/activate` and `/api/wl/*` are public; everything else still requires the
  platform session — the demo session is a CEO-scoped **demo** identity.
- The seed and the whole subsystem are inert without the flag, so pulling this
  code into Freehold changes nothing there.
- The public footer's legal line (legal entity + RERA licence) is intentionally
  **not** re-branded — a demo brand must not claim a real licence.

## Data model reference

| Table | Holds |
| --- | --- |
| `wl_keys` | access keys (key, label, status, workspace_id, expires_at) |
| `wl_workspaces` | redeemed brands (company, product, accent, logo) |

Both self-create on first use. Everything else is the app's normal schema,
filled by `pnpm seed:demo`.
