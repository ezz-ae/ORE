# Coach marks (guided onboarding tours)

Role-aware, fully translated (EN / AR / RU, RTL-aware) guided tours that
spotlight the parts of the system a user needs on day one.

## How it works

| Piece | File |
| --- | --- |
| Engine — provider, auto-start, spotlight overlay, `useCoach()` | `components/freehold/coach/coach-marks.tsx` |
| Tour definitions (per role) | `lib/freehold/coach-tours.ts` |
| Copy (EN/AR/RU) | `lib/i18n/dictionaries/coach.ts` (merged in `dictionaries.ts`) |

- `<CoachProvider>` wraps the Freehold shell (`app/freehold-intelligence/layout.tsx`),
  inside `I18nProvider` so tours pick up locale + direction.
- On first sign-in per role it **auto-starts once**, gated by
  `localStorage["fh_coach_seen_<role>_<COACH_VERSION>"]`. Bump `COACH_VERSION`
  in `coach-tours.ts` to re-show an updated tour to returning users.
- Re-run anytime from the account menu → **“Take a tour”** (`useCoach().start()`).
- Each step optionally targets a `[data-coach="<id>"]` element. The engine
  spotlights it (box-shadow dim + gold ring) and pins a tooltip beside it,
  tracking the element every frame so the spotlight stays glued during scroll.
  Steps with **no anchor**, or whose anchor isn’t on the current page, fall back
  to a centred card — a tour never breaks because a surface isn’t mounted.

## Tours

One tour per role (`broker`, `admin`, `sales_manager`, `director`, `ceo`,
`marketing`). Every tour ends with the shared tail: **Freehold Expert →
Account & language → done.**

## Anchors

Add `data-coach="<id>"` to make an element targetable. Current anchors:

| Anchor | Where |
| --- | --- |
| `nav-spine`, `nav-home`, `nav-<appId>` (e.g. `nav-crm`), `user-menu` | `components/freehold/spaces-nav.tsx` |
| `expert-chat` | `components/freehold/expert-chat.tsx` |
| `hub-briefing`, `hub-ai` | `app/freehold-intelligence/dashboard-client.tsx` |
| `agent-apps` | `app/freehold-intelligence/agent/page.tsx` |

To add a step: pick/define an anchor, add a `CoachStep` to the role’s tour in
`coach-tours.ts`, and add `<key>.title` / `<key>.body` to all three locales in
`coach.ts`.

---

## Placeholder content surfaced while wiring the tours

Writing role tours forced a walk through each role’s landing surface. These are
the placeholder / not-yet-live spots found on or next to the highlighted
surfaces. The first three were wired to live data in the same change; the rest
are tracked here.

1. **Hub “Live activity” feed — ✅ wired to live data.**
   `app/freehold-intelligence/dashboard-client.tsx` now fetches
   `/api/freehold/crm/activity` and renders real lead-activity rows (humanized
   type + relative timestamp), falling back to the static demo only when the
   activity log is empty.

2. **Hub morning briefing — ✅ wired to live data.**
   The urgent-action cards and the urgent / blocked / pending chips now read
   live work tasks (`/api/freehold/tasks`) and the pending-approval deal queue
   (`/api/freehold/deals?status=pending_step2`). The summary line switches to a
   live count sentence (`hub.briefingLive`) when live data is present, and an
   empty state (`hub.noUrgent`) shows when nothing is urgent. The static
   `serverSummary` remains the fallback for a fresh workspace.

3. **Freehold Expert role — ✅ fixed (and hardened).**
   `app/api/freehold/expert/chat/route.ts` now derives the MCP role from the
   verified session (`SESSION_TO_EXPERT` map) instead of trusting a client-sent
   `role`. The client no longer sends `role: 'owner'`. This both scopes answers
   correctly per role and closes a privilege-escalation hole (a client could
   previously claim `owner`).

4. **Analytics — mock display enriched by partial live stats.**
   `app/freehold-intelligence/analytics/page.tsx` (~lines 206-216) renders a
   mock analytics layout and overlays live DB counts where available. The
   marketing tour highlights Analytics; the non-live portions remain sample.

5. **Integrations → Google — explicitly sample.**
   `app/freehold-intelligence/integrations/google/page.tsx` shows a
   *“Sample data shown”* badge until backend credentials connect. Honest, but
   still placeholder for admin/marketing.

> Note: many other surfaces (CRM board/leads, credits, account wallet,
> integrations list) follow a deliberate **live-DB-with-mock-fallback** pattern
> — they show real data when the DB has rows and fall back to demo data when
> empty. Those are intentional and not listed above.
