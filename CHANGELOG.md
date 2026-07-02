# Changelog

Client-facing feature history for Freehold Intelligence. This mirrors the
in-app **What's new** panel (account menu → What's new), whose source of truth
is `lib/freehold/changelog.ts`.

**Rule:** this file lists **features, options, and improvements that make the
product easier to use** — the things a user wouldn't otherwise notice we
shipped. Routine bug fixes and internal plumbing are intentionally excluded
(they belong in commit history, not here).

> When you ship a user-facing feature: add an entry to `lib/freehold/changelog.ts`
> (bump the version number) **and** mirror it here. The version bump makes the
> in-app panel pop up once for every user.

---

## v4 — 2026-07-02 · See exactly where every commission goes
- **Full commission breakdown** — deals now capture the complete waterfall:
  agency commission, referral, cashback, expenses, growth fund, broker payout
  and company net. Enter each on the deal and the split updates live.
- **Company breakdown on Finance** — the Finance overview rolls the whole book
  up: referral, cashback, expenses, growth, broker payouts and what the company
  keeps, across all approved deals.

## v3 — 2026-07-02 · Personalise your workspace
- **Light mode** — switch between the dark and light look from the account menu
  (top-right), next to Language. Light mode uses a soft sky-gradient background
  with white cards and charts. Your choice is remembered per device.
- **What's new panel** — this panel. Whenever we add something to make your work
  easier you'll see it here; open it any time from the account menu.
- **Quieter tours** — skip two guided tours in a session and we stop opening them
  automatically for the rest of that session. The **Take a tour** button still
  replays any tour on demand.

## v2 — 2026-07-01 · Connect your own ad & messaging accounts
- **Connect Meta Ads in-app** — paste your token in Integrations → Meta Ads,
  pick your ad account + Facebook Page, and launch real campaigns from Freehold.
- **Connect WhatsApp in-app** — connect your WhatsApp Business number in
  Integrations → WhatsApp and the CRM can message leads directly.
- **Advertise a project in one click** — from an inventory project or a generated
  listing, jump straight into the campaign builder pre-filled with that project.

## v1 — 2026-06-30 · Faster follow-ups & clearer numbers
- **Instant broker notifications** — when a lead is assigned to you, you get an
  email with the lead details and a direct link, so you can respond in minutes.
- **Commission at a glance** — your account page shows real commission from your
  deals: gross, received and outstanding.
- **Deal-linked sales on inventory** — each project shows the deals booked
  against it: sales value and commission earned.
