# Documentation

Docs for the team working on this private system. **Living** references sit in
this folder; **completed / historical** plans, audits, and handovers live in
[`archive/`](archive/) (clearly marked, kept for context).

New here? Start with the root [`README.md`](../README.md), then skim the reference
docs below.

## Living reference

| Doc | What it covers |
| --- | --- |
| [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | Private white-label deployment playbook — one isolated deployment per client (Vercel + Neon + domain + credentials), no multi-tenancy. (Kept at repo root; code references it.) |
| [`INTEGRATIONS-SETUP.md`](INTEGRATIONS-SETUP.md) | Connecting the external services: Meta Ads, Google Ads, AI/Vertex, tracking, database. |
| [`OPERATIONS-RUNBOOK.md`](OPERATIONS-RUNBOOK.md) | Day-to-day operational procedures and incident handling. |
| [`CAMPAIGN-LAUNCH-RUNBOOK.md`](CAMPAIGN-LAUNCH-RUNBOOK.md) | Step-by-step for taking a project from inventory to a live ad campaign. |
| [`USER-GUIDE.md`](USER-GUIDE.md) | End-user guide to the private app (workspaces, CRM, Lead Machine, Expert). |
| [`AI_AGENTS.md`](AI_AGENTS.md) | The AI agents (the Expert, ads/coordinator tools) and how they're scoped. |
| [`ACCESS-MATRIX.md`](ACCESS-MATRIX.md) | Role → capability matrix (who can see/do what). |
| [`route-auth-matrix.md`](route-auth-matrix.md) | Route-level auth: which paths are public vs. gated, and by which role. |
| [`coach-marks.md`](coach-marks.md) | The in-app coach-mark / guided-tour system. |

## Archive

[`archive/`](archive/) holds finished work — finalization checklists, the beta
master plan, dated system audits, session handovers, and the original
implementation blueprints. Read its [`README.md`](archive/README.md) for the
index. These are **not** the current source of truth; the code and the living
docs above are.
