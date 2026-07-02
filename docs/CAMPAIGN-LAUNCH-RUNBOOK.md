# First Trial Campaign — Launch & Verify Runbook

Step-by-step to take the client's **first real campaign** live and confirm the
full loop works: **connect → launch → lead comes back into the CRM.** Follow it
top to bottom; each step has a pass check. Budget ~30 minutes.

Roles needed: **marketing** or a management role (admin/director/ceo).

---

## 0. Pre-flight (once)

- [ ] Production env has `FH_SESSION_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`,
      `RESEND_API_KEY` set (see [Operations Runbook §2](./OPERATIONS-RUNBOOK.md)).
- [ ] You can sign in and reach **Integrations**.
- [ ] The client has: a Meta **ad account ID**, a **Facebook Page**, and a
      **long-lived access token** with `ads_management` + `pages_show_list`.

---

## 1. Connect Meta (in-app, no redeploy)

1. **Integrations → Meta Ads → Connect.**
2. Paste the token; pick the **ad account** and **Facebook Page**.
3. **Save.**

**Pass check:** Meta shows **Connected** (not "Seen"/"Pending"). The save
endpoint validates the token against the Meta Graph API before storing, so a
green state means the token is genuinely live. `GET /api/health` should also
report Meta connected.

> If it rejects: the token is expired or missing scopes. Regenerate a
> long-lived token with `ads_management` + `pages_show_list` and re-save.

---

## 2. Build the campaign

1. **Ads / Lead Machine → New campaign** (or from an Inventory project →
   **Advertise**, which pre-fills the project).
2. Walk the steps: property → objective (**Lead generation**) → targeting →
   budget → creative (AI-generate or paste). Each step can run on AI-autopilot
   or by hand.
3. Attach a **lead form** (name + phone + email at minimum).

**Pass check:** the review screen shows a complete summary — property, audience,
budget, creative, and the lead form — with no "connect an account first" gate.

---

## 3. Launch — PAUSED first

1. On the review step choose **Launch paused** (recommended for the first run).
2. Confirm.

**Pass check:** you get a real campaign/ad-set/ad ID back and the campaign
appears in **Ads Live** with status **Paused**. Cross-check it exists in Meta
Ads Manager under the same ad account. **No real spend occurs while paused.**

---

## 4. Verify the lead round-trip

Do a controlled end-to-end test before spending:

1. In Meta Ads Manager, use the **lead form preview / test lead** tool on the
   form you attached (this creates a test lead without live spend).
2. Wait for the webhook (or trigger a sync if configured).

**Pass check:** the test lead appears in **CRM → Leads** with a serial code
(e.g. `FH-0001`), source attributed to the campaign, and — if the assignee has
notifications on — an **email** arrives ("a lead was assigned to you") with a
direct link. Open the lead: the **Call** and **WhatsApp** buttons work.

---

## 5. Go live

Once steps 1–4 pass:

1. **Ads Live → the campaign → Resume / set live** (or flip it live in Meta).
2. Set the daily budget the client approved.
3. Watch **Ads Live** for spend + real leads.

**Pass check:** status **Active**, spend begins accruing, real leads land in the
CRM the same way the test lead did.

---

## Rollback / stop

- **Pause spend instantly:** Ads Live → campaign → **Pause** (or in Meta).
- **Disconnect Meta:** Integrations → Meta Ads → **Disconnect** (removes the
  stored credential; env-var credentials, if any, remain and take precedence).

---

## What "done" looks like

✅ Meta **Connected** · ✅ campaign created with a real ID · ✅ a lead flowed
Meta → CRM with attribution + notification · ✅ Call/WhatsApp work on the lead.
That is the first trial campaign verified end to end.
