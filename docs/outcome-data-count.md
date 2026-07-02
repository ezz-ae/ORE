# Outcome-Data Count (P2.3) — live Neon, 2026-06-30

Measured directly against the production Neon DB (`neondb`, ep-rapid-pine) before making any "outcome-trained targeting" claim.

## Closed-loop count

| Metric | Count |
|---|---|
| Leads (total) | 1 (status `new`) |
| Leads carrying campaign attribution (`utm_campaign`/`utm_id`) | 0 |
| Deals (total) | 0 |
| Deals linked to a lead | 0 |
| Deals `approved`/`closed` | 0 |
| **Full campaign → lead → closed-deal cycles** | **0** |

> Operational tables were recently cleared (the `admin/reset` "leads" scope wipes leads/deals/activity/finance); the property catalogue is intact (2,840 projects). Either way, there is **no** outcome history to train on yet.

## Decision (per P2.3)

**Gate the "outcome-trained" / "admin AI" claim in all copy until real closed-loop data exists.** With 0 cycles, any such claim is unsupported. The scaffolding (rules-based distribution, `campaign.cpl` tracking, lead `converted` status) is present, but that is a rules engine, not a trained model.

- Do **not** advertise outcome-trained targeting in marketing copy or UI.
- Revisit when this count is non-trivial (target: enough `closed` deals with campaign attribution to label). At that point, build the `campaign_outcomes` feedback table + labeling job (K in the Expansion Roadmap, Phase 4).
- Enforcement mechanism for the copy gate: the P5.2 `tests/copy-rules` forbidden-strings scan.

## Related data verifications (P2.4 / data-request.md)

| Check | Result |
|---|---|
| Media uniqueness — `freehold_site_projects.hero_image` | ✅ 2,840 / 2,840 distinct, 0 duplicate/null |
| `freehold_site_leads` schema (id, name, phone, email, source, project_slug, assigned_broker_id, created_at, + utm_*) | ✅ present |
| `freehold_site_users` with role | ✅ present (1 admin: `crm@oreproperties.ae`) |
| Credit tables (`broker_credit_accounts`, `credit_ledger`) | ✅ present; `campaign_outcomes` / `broker_integration_tokens` not yet built (P2.3 / P1.2) |

## Credit-ledger note (P2.2, to harden in code)
One test account (`bc_laila`) shows `allocated=0` but `credit_ledger` sum `=20` (1 entry). At scale, balance must reconcile to the ledger and launches must refuse on insufficient balance — tracked as the P2.2 credit-loop hardening (separate PR; gated with the Meta launch path).
