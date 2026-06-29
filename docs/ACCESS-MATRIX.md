# Access Matrix — roles × apps × capabilities

The single source of truth for **who can see and do what**. This is the document
to hand a new white-label customer when they ask "what does each seat get?"

- **Code source of truth:** app visibility lives in `lib/freehold/apps.ts`
  (`APPS` + `appAllowsRole`/`rolesForApp`); the role list lives in
  `lib/freehold/session-types.ts` (`Role`, `MANAGEMENT_ROLES`). Route guards
  (`useSessionGuard`) and API guards (`requireSession(roles)`) read the same
  lists, so nav, pages and APIs can never drift.
- **White-label note:** nothing here is Freehold-specific. Roles are generic
  seats; brand colour is one token (`--color-gold`). To re-skin for another
  brokerage, change the brand token and (optionally) rename role labels — the
  access rules carry over unchanged.

## Roles (seats)

| Role | Seat / who it's for |
|------|---------------------|
| **broker** | Front-line agent. Works only their own book. |
| **sales_manager** | Runs the sales floor: pipeline, assignment, team performance. |
| **director** | Oversight of operations + finance + content. |
| **ceo** (owner) | Everything, including destructive/admin operations. |
| **admin** | Full operator: team, roles, billing, integrations, system. |
| **marketing** | Growth: ads, web studio, integrations, analytics. |

Helper groups (in `apps.ts`): `MGMT_ROLES = admin·sales_manager·director·ceo`,
`STUDIO_ROLES = admin·director·ceo·marketing`, `SETTINGS_ROLES = admin·director·ceo`,
`MANAGEMENT_ROLES = admin·ceo·director·sales_manager`.

## App-level access (the navigation spine)

✅ = full app · 🔵 = visible but **scoped to own data** · — = hidden (route + API blocked)

| App / surface | broker | sales_manager | director | ceo | admin | marketing |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **My Workspace** (`/agent`) | ✅ | — | — | — | — | — |
| **CRM** (`/crm`) | 🔵 own leads | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inventory** (`/inventory`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notebook** (`/notebook`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ads** (`/ads`, `/ads-live`) | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Analytics** (`/analytics`) | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Web Studio** (`/ai-manager`) | — | — | ✅ | ✅ | ✅ | ✅ |
| **Integrations** (`/integrations`) | — | — | ✅ | ✅ | ✅ | ✅ |
| **Finance** (`/finance`) | — | ✅ | ✅ | ✅ | ✅ | — |
| **Management** (`/management`) | — | ✅ | ✅ | ✅ | ✅ | — |
| **Settings** (`/settings`) | — | — | ✅ | ✅ | ✅ | — |

## Within-app capabilities (the important options)

| Capability | broker | sales_manager | director | ceo | admin | marketing |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| See **own** leads / pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| See **all** leads (whole team) | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create **direct lead** (+ details) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Work a lead (call, log, follow-up, stage) | ✅ own | ✅ | ✅ | ✅ | ✅ | — |
| **Assign / reassign** lead to a broker | — | ✅ | ✅ | ✅ | ✅ | — |
| See **team roster** (other brokers' names) | — | ✅ | ✅ | ✅ | ✅ | — |
| **Broker 360° profile** (leads, deals, commission, lifetime) | — | ✅ | ✅ | ✅ | ✅ | — |
| Profile actions: add credits, add/assign lead, add/remove on deal | — | ✅ | ✅ | ✅ | ✅ | — |
| Create / approve **deals** | own | ✅ | ✅ | ✅ | ✅ | — |
| **Finance**: invoices, payments, credits, budget | — | view/act | ✅ | ✅ | ✅ | — |
| **Publish** a landing page / microsite | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Build / launch **ad campaigns** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Connect integrations** (Meta/Google/HubSpot/WhatsApp) | — | — | ✅ | ✅ | ✅ | ✅ |
| **Settings**: team, roles, automation, billing | — | — | ✅ | ✅ | ✅ | — |
| **Operations → Delete all leads & reset** | — | — | — | ✅ | ✅ | — |
| **AI Expert** scope | own sales work only | full system | full system | full system | full system | marketing |

## AI Expert role-scoping (important for white-label trust)

The one docked Expert is **role-aware** (`/api/freehold/expert/chat`):
- **broker** → context is *their own* pipeline only; coached on leads, follow-ups,
  viewings, closing. Never told to fix billing, connect integrations or manage
  others.
- **marketing** → campaigns, ads, landing pages, attribution.
- **operator (owner/admin/manager)** → full-system context (server, blockers,
  integrations, team, finance, CRM).

## How to extend / re-skin (white-label)

1. **Add an app:** add one entry to `APPS` in `lib/freehold/apps.ts` with its
   role rule (`roles`, `managementOnly`, `brokerHide`, or `brokerOnly`). Nav,
   hub launcher and the guard helper update automatically.
2. **Gate a page:** `useSessionGuard(rolesForApp('<id>'))` on the client and
   `requireSession(MGMT_ROLES)` (or the relevant list) on every API route.
3. **Re-brand:** change `--color-gold` (and other `--color-*` tokens) in
   `app/globals.css`; role labels are display-only and can be renamed per tenant.
4. **Keep this table in sync** whenever a role rule changes — it is the contract.
