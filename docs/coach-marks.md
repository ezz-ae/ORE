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
surfaces — listed so we can decide what to wire to real data next. None block
the tours; they’re honest stubs.

1. **Hub “Live activity” feed — hardcoded.**
   `app/freehold-intelligence/dashboard-client.tsx` (`ACTIVITY`, ~lines 30-36).
   The panel is titled *Live activity* but renders a fixed 5-row array. Seen by
   admin / director / ceo / sales_manager on the home hub.

2. **Hub morning briefing — static demo summary.**
   `src/features/freehold-intelligence/server-session.ts` (`serverSummary`,
   ~line 186). Urgent/blocked/pending counts and copy are frozen, with a
   hardcoded `generatedAt: 2026-05-22`. This is exactly the surface the CEO tour
   highlights (`hub-briefing`), so it should move to live aggregation.

3. **Freehold Expert sends `role: 'owner'` for everyone.**
   `components/freehold/expert-chat.tsx` (~line 121) hardcodes
   `role: 'owner'` in the chat request regardless of the signed-in user. The
   Expert is highlighted in *every* role tour, so it should pass the real
   session role for correctly-scoped answers.

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
