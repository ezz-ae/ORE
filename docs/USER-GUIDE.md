# Freehold Intelligence — User Guide

A practical guide to **using** the platform: what each area does and how to get
things done. (This is not a setup/deploy doc — it's for the people using the
system day to day.)

---

## 1. The basics

### Signing in
- Go to the login page, enter your email and password. "Remember me" keeps you
  signed in for 30 days; otherwise the session lasts the working day.
- One sign-in covers everything — the main platform and the CRM share the same
  login. Signing out logs you out everywhere.
- Forgot your password? Use **Reset password** on the login screen; you'll get a
  reset link by email.

### Finding your way around
- The **top spine** is your app switcher — every app your role can open sits one
  click away (CRM, Ads, Inventory, Finance, Web Studio, Analytics, Notebook,
  Management, Settings, and your personal Workspace).
- You only see the apps your **role** is allowed to use (see §3).
- The **hub** (home) shows your morning briefing — what's urgent, what's blocked,
  what's awaiting approval — and live activity.

### Language & layout
- Open the **account menu** (top-right) to switch the interface between
  **English, العربية, Русский**. Arabic flips the whole layout right-to-left
  automatically.
- Set your default interface and AI language in **Settings → Languages**.

### Guided tours (coach marks)
- The first time you open the platform — and the first time you open each app —
  a short guided tour highlights the key controls on that screen.
- Replay any tour anytime from the **account menu → "Take a tour."** Tours only
  point at things actually on your screen, so they stay short and relevant.

### The AI Expert (everywhere)
- The gold **Expert** button is docked on every screen (keyboard: ⌘J / Ctrl-J).
- It reads your live data — ask it to plan, draft a message, design a landing
  page, build a report, or review work. There is **one** Expert conversation
  across the whole system, so context follows you.
- Most apps also show quick **"Ask the Expert"** prompts tailored to that
  screen; clicking one opens the Expert with that question.
- Anything the Expert produces can be **saved to the Notebook** and exported.

---

## 2. The apps

### CRM — leads, pipeline, agents
**What it does:** every lead, conversation, and deal in one place.
**How to:**
- **Work a lead:** open it for the 360° view — activity, comments, deals, AI
  summary, and the next-best action. Use the **Call** (dials the number) and
  **WhatsApp** (opens the chat) buttons on each row.
- **Move it down the pipeline:** drag on the board or change the stage on the
  lead; closing a lead opens the deal window.
- **Assign / reassign:** use Assignment to balance load across agents.
- **Follow-ups:** the Follow-up queue lists what's overdue and by whom; snoozes
  persist.
- **Ask the Expert:** e.g. "draft a follow-up for my hottest lead" — it uses the
  lead's real history.

### Lead Machine + Ads — campaigns end to end
**What it does:** plan, launch and track ad campaigns (Meta + Google) and the
landing pages behind them.
**How to:**
- **Build a campaign:** Lead Machine walks you step by step — pick a property,
  set targeting and budget, generate creatives, launch. Each step can run on
  AI-autopilot or by hand.
- **Launch:** review the summary and launch. Meta campaigns can go live or start
  paused; Google campaigns are created paused so you flip them live in Google.
  (Real spend happens only when the ad accounts are connected.)
- **Watch results:** Ads Live shows spend, leads and performance in real time.
- **Landing pages:** create a page for any property in one click (it's published
  at `/lp/<slug>`); "Create All" does every property missing a page.
- **Creatives / keywords / audiences:** generate and manage from their tabs.

### Inventory — properties & projects
**What it does:** every project, unit and off-plan listing, scored for data
quality and ad-readiness.
**How to:**
- **Find what's sellable:** sort by ad-readiness; fix gaps flagged under Data
  Quality before advertising.
- **Turn a listing into a page:** open a property → generate a landing page or a
  full microsite.

### Web Studio — content engine
**What it does:** generate and maintain listings, landing pages and SEO content.
**How to:**
- **Topics:** "Generate Topic" asks the AI for a fresh idea; per-topic
  "Generate" drafts a real article.
- **Listings:** "AI Improve" rewrites a listing's copy; the bulk buttons run it
  across the visible listings.
- **Insights:** "Generate Report" builds an executive summary from your live KPIs.
- **Ask the Expert** to plan a content calendar or audit pages for stale data.

### Analytics — what's working
**What it does:** four lenses on the business — **Company, Team, Market,
Marketing** — each scoped to what your role should see.
**How to:**
- **Company:** revenue, conversion, spend, YTD.
- **Team:** per-agent leads, wins, overdue, activity; open any team member for
  their full 360° (leads, deals, commission, ad spend).
- **Marketing:** spend / lead quality / cost-per-lead by account, period,
  country, and team member — add a breakdown box from the preset chips.
- **Ask the Expert** about any view ("who's likely to close outside the team?",
  "who deserves more ad budget?") and save the answer as a report to the Notebook.

### Finance — money in motion
**What it does:** invoices, payments, credits and the company budget.
**How to:**
- **Company view:** full P&L — commission earned, spend by category, outstanding.
- **Credits:** grant bonus credits to an agent (Apply persists to the ledger);
  set tiers.
- Approvals that move money flow through here for sign-off.

### Management — the company view
**What it does:** system-level reporting rolled up across every app — team
performance, deals, ROI, events.
**How to:**
- Open any team member to see **all** their leads, comments, deals, commission,
  closed business and ad spend.
- Generate the AI company report (top decisions, full HTML report → Notebook).

### Notebook — your AI workspace
**What it does:** saves the research, plans, reports and offers the Expert builds
for you, as reusable documents.
**How to:** save anything the Expert generates, export as HTML, and pick it up
again later. It's your shared memory.

### Integrations — connect your stack
**What it does:** connects Meta, Google, HubSpot, WhatsApp and more.
**How to:** an integration shows **Connected** once its credentials are present.
Until then the app runs on realistic demo data so you can try every flow first.
- **HubSpot:** once connected, run a sync to push CRM leads to HubSpot and pull
  HubSpot contacts into the CRM (deduped by email).

### Settings — run the platform
**What it does:** team, roles, automation, billing, brand, languages, security.
**How to:**
- **Roles:** control exactly what each role can see and do.
- **Automation:** route new leads to agents automatically by your rules.
- **Brand / Languages:** company name, domain, timezone, default UI + AI
  language (these save automatically).

### My Workspace (brokers)
Your personal home: your leads, campaigns, credits and AI in one place.

---

## 3. Roles & who sees what

| Role | Sees / does |
|---|---|
| **Broker** | Personal Workspace: own leads, campaigns, credits, AI. |
| **Sales Manager** | CRM pipeline + Team performance + approvals. |
| **Marketing** | Ads, Web Studio, Analytics (Market/Marketing). |
| **Director / CEO / Admin** | Everything, including Management, Finance and Settings. |

The system enforces this on every screen **and** every data request — a role
never sees data it isn't entitled to, even via a direct link.

---

## 4. Common tasks — quick recipes

- **Follow up the right lead now:** Hub briefing → or CRM → Follow-up queue →
  open the top overdue lead → Call / WhatsApp → log the outcome.
- **Launch an ad for a property:** Lead Machine → New campaign → pick property →
  targeting + budget → generate creative → launch. Then watch in Ads Live.
- **Publish a landing page:** Inventory → property → Generate landing page (or
  Lead Machine → Landings → Create). It goes live at `/lp/<slug>`.
- **See who's performing:** Analytics → Team → sort by Wins; open a member for
  their full record.
- **Get a company report:** Management → Generate report → it saves to Notebook
  as a shareable HTML document.
- **Give an agent more credits:** Finance → Credits → +/- → Apply.
- **Sync with HubSpot:** Integrations → HubSpot → Sync (after it's connected).

---

## 5. Tips
- Press **⌘J / Ctrl-J** anywhere to open the Expert.
- Switch language anytime from the account menu — the whole UI (including
  right-to-left for Arabic) adapts instantly.
- "Sample" or demo figures only appear where a live source isn't connected yet;
  once integrations and the database are connected, every number is live.
