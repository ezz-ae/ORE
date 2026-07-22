# Freehold Intelligence — Private Real-Estate Operating System

> Internal README for the team. This is a **private, white-label** system, not an
> open-source project — the audience here is a teammate joining the codebase, not
> an external downloader.

**What it is.** A private operations server for a Dubai real-estate brokerage. It
has **two faces on one database and one AI layer**:

- **Public storefront** — the marketing site, project catalogue, area/developer
  pages, agent bio pages, and landing pages that capture leads.
- **Private server** (`/freehold-intelligence/*`) — where the team runs the
  business: CRM & Lead 360, the Lead Machine (inventory → landing → ads → leads),
  the Expert AI, Notebook, analytics, finance, and settings.

Because both faces share one Neon database and one AI layer, every action on the
private server sharpens the public storefront and feeds the learning loop. The
full architecture is in [`docs/`](docs/) — start with the index there.

Each client company gets its **own private deployment** (own Vercel project, own
Postgres, own domain, own credentials). There is **no multi-tenancy** — see
[`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict) · **Tailwind**
- **Neon PostgreSQL** (accessed via `lib/db.ts` `query()`; tables self-create with
  `CREATE TABLE IF NOT EXISTS` — no migration tool)
- **AI:** Google Vertex / Gemini (the Expert, ad generation, notebook, ingest)
- **Ads:** Meta Graph API + Google Ads API
- **Hosting:** Vercel · **Package manager:** pnpm · **Node 22**
- Edge request handling lives in **`proxy.ts`** (Next 16 renamed `middleware.ts` →
  `proxy.ts`) — auth gating, the public-API allowlist, and short-domain rewrites.

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in Neon + AI + ads credentials
pnpm dev                     # http://localhost:3000
```

## The verification gauntlet (run before every push)

CI (`.github/workflows/ci.yml`, the `verify` check) runs the same three:

```bash
pnpm typecheck   # tsc --noEmit — must be clean
pnpm i18n        # EN/AR/RU parity: every used key resolves in all 3 locales
pnpm build       # production build must succeed
```

`pnpm smoke` runs a lightweight end-to-end smoke pass.

## Repo layout

| Path | What lives there |
| --- | --- |
| `app/` | All routes — public site, `/freehold-intelligence/*` private app, and `app/api/*` route handlers |
| `components/` | Shared React components (`components/freehold/*` is the private app's UI) |
| `lib/` | Server + shared logic — `lib/db.ts`, `lib/freehold/*` (domain), `lib/meta/*`, `lib/google/*`, `lib/i18n/*` |
| `src/features/` | Feature modules (e.g. inventory intelligence) |
| `hooks/`, `styles/`, `types/`, `public/` | Hooks, global styles, shared types, static assets |
| `scripts/` | `i18n-audit.ts`, `smoke.ts`, and data/marketing agents |
| `docs/` | Living documentation (see [`docs/README.md`](docs/README.md)); `docs/archive/` holds completed/historical plans |

## Key domains (where to look)

- **The Expert** — the docked, screen-aware AI (open with the gold button or
  **Cmd/Ctrl-J**). UI: `components/freehold/expert-chat.tsx`; server:
  `app/api/freehold/expert/*`; tools: `lib/freehold/coordinator-tools.ts`.
- **Lead Machine / Ads** — `app/freehold-intelligence/ads` (hub), `.../lead-machine/*`.
  The Machine (live optimiser + gated actions) is `.../campaigns/optimize`.
- **Spend Governor** — the deterministic autonomous-spend rule engine:
  `lib/meta/spend-authority.ts` (+ `spend-rules.ts`, `app/api/freehold/ads/spend-rules`).
- **CRM & Lead 360** — `app/freehold-intelligence/crm/*`, `lib/deals.ts`.
- **Connect AI (MCP)** — drive the system from your own Claude/GPT/Gemini:
  `app/api/mcp/route.ts`, `lib/freehold/api-tokens.ts`, settings → Connect AI.
- **i18n** — `lib/i18n/dictionaries/*`; every user-facing string is a key,
  enforced trilingual by `pnpm i18n`.

## House rules (non-negotiable)

- **No fake data.** Surfaces show real DB data or an honest empty state — never
  invented numbers, statuses, or "connected" badges.
- **Trilingual.** New user-facing text is an i18n key present in EN/AR/RU; RTL-safe.
- **Honest AI boundaries.** The AI proposes; a human applies. Money-moving and
  external writes are gated (roles + the Spend Governor) and logged.
- **Verify before push.** tsc + i18n + build must pass.

## Docs

- **[`docs/README.md`](docs/README.md)** — index of the living documentation.
- **[`docs/archive/README.md`](docs/archive/README.md)** — completed/historical
  plans, audits, and session handovers, kept for reference.
- **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — private white-label deployment playbook.
- **[`CHANGELOG.md`](CHANGELOG.md)** — client-facing feature history (mirrors the
  in-app *What's new*).
