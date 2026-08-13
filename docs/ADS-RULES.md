# Ads: the rules that decide what a number means

Every rule below is enforced by a suite in `pnpm guards`, not by convention.
The suite name is given so you can read the assertions instead of trusting this
page. Each rule exists because the opposite behaviour shipped and cost
something; the module header states which.

## Attribution — how a lead finds its campaign

A lead belongs to a campaign by `utm_id`, exact. `utm_campaign` carries the
campaign **name** and is only consulted when no id matches.

Ads created by this product carry `AD_URL_TAGS` (`lib/meta/client.ts`), one
definition used by all four creative paths. It writes the campaign id into
`utm_id` and the name into `utm_campaign`.

It used to write the **id** into `utm_campaign` and no `utm_id` at all, so both
matches missed and every landing-page lead this account bought was
unattributed — 571 CRM rows reading "General enquiry". `bucketLeadsByCampaign`
carries a last-resort branch that recovers those stored rows by matching a
`utm_campaign` shaped like a platform id (nine or more digits). It is consulted
after both genuine matches and can never displace one.

*Guard:* `lead-attribution-test.ts` — includes a source read of `AD_URL_TAGS`.

Instant-form leads are attributed by `meta-lead-sync`, which stamps `utm_id`
itself. That is why the failure above was invisible: half the evidence was
correct.

## Delivery — the switch is not the state

`campaign.status` (Meta) and the ENABLED flag (Google) are the control **we**
set. Neither says whether anything is being served.

- Meta: `deliveryOf` reads `effective_status`.
- Google: `googleDeliveryOf` reads `primary_status` **and**
  `primary_status_reasons`, which names the blocker — no keywords, ads
  disapproved, budget exhausted. Each named blocker carries the route to the
  screen that fixes it (`BLOCKER_FIX`).
- The Ads Machine: `pulseState` — a machine whose switch is on with nothing
  live and nothing committed is `onButIdle`, not running.

*Guards:* `delivery-status-test.ts` (includes a source scan over the ads
screens, so a new screen cannot invent its own badge), `machine-activity-test.ts`.

## Seeing a Page is not advertising with it

An ad runs from a Facebook Page, and Meta grants those two things separately. A
login can read a Page, list its lead forms and show its name in the picker, and
still be refused at ad-creation time with subcode 1487202.

`/me/accounts` has always returned the answer — a `tasks` array per Page, where
ADVERTISE (or MANAGE, which contains it) is the exact grant. Three places threw
it away: the launch route asked only whether the posted Page was **in** the
list, the configured Page was appended with the permission hardcoded true, and a
launch that posted no Page skipped the check entirely. So Meta answered instead,
after the campaign and its ad sets had been created.

Now `checkPageAds` (`lib/meta/client.ts`) reads it, the readiness strip shows it
on the first screen, and the launch route refuses **before** it builds anything
and returns the reserved credits.

Three states, not two. Meta omits `tasks` for some token scopes, and an omission
is not a denial — `unknown` proceeds and lets Meta be the judge. An empty array
*is* a denial.

*Guard:* `page-ads-permission-test.ts` — includes a source scan asserting the
refusal precedes `launchFullCampaign`.

## Evidence gates — when a number is withheld

| Rule | Where | Threshold |
| --- | --- | --- |
| Campaign quality score is withheld when no attributed lead has moved past `new` | `campaign-quality.ts` | `worked === 0` |
| Impression share is a **bound**, never a point estimate, at Google's clamps | `competition.ts` | `0.9` / `0.0999` |
| No auction verdict below a real impression count | `competition.ts` | `MIN_IMPRESSIONS_FOR_SHARE = 300` |
| No search term blocked without a cost-per-lead to measure against | `search-harvest.ts` | `MIN_LEADS_FOR_TARGET = 5` |
| No lookalike reported as built below Meta's working seed floor | `rating-loop.ts` | `LOOKALIKE_MIN_SEED = 100` |
| No placement bar drawn for a surface nobody tested | `placement-bars.ts` | `MIN_IMPRESSIONS_FOR_BAR = 500` |
| No chart at all with one measurable surface | `placement-bars.ts` | `MIN_BARS_TO_COMPARE = 2` |
| No design called a winner against one that was never funded | `design-race.ts` | one lead's worth of spend |

An unknown is never rendered as a zero. "We do not know" and "it produced
none" are different sentences and only one of them is true.

## What runs unattended, and what does not

The Ads Machine writes to live accounts. Two things bound that.

**Search negatives apply automatically** (`machine-activity.ts`,
`harvest-run.ts`). A negative only ever stops spend; the worst case is a query
that might have converted later stops showing, which is reversible in one
click. Running only, once every `HARVEST_EVERY_HOURS = 20`.

**New keywords are proposed and wait for a person.** A keyword starts spend on
a forecast rather than a measurement.

**Placement exclusions are applied at the next launch, never mid-flight**
(`placement-memory.ts`). Excluding a placement on a live ad set resets its
learning phase and changes the spec the operator approved.

*Guard:* `search-harvest-test.ts` includes a source scan over the machine cycle
asserting all three.

## Compliance

A Dubai property may not be advertised without a valid Trakheesi permit. The
gate applies at three points, and all three read the same expiry:

1. **Plan** — `planKeywords` refuses a project with no permit or a lapsed one.
2. **Launch** — `app/api/meta/launch` refuses, and sets `end_time` on the ad set
   so Meta enforces the window itself without anything of ours awake.
3. **Live** — the machine cycle stops a running campaign whose permit lapsed.

A permit is valid **through** its expiry date in Dubai time. A missing expiry is
the absence of evidence and blocks nothing; a date that has passed does.

## Targeting

Audiences narrow by **language and behaviour, never nationality or origin**.
Language is a real Meta field. Nationality is not — it is a proxy stack that is
wrong at the edges, and this is a housing product.

`location_types` is a statement about residence, never origin. The geo
breakdown reports where an ad was **shown**.

*Guards:* `audience-pattern-test.ts`, `geo-spec-test.ts`, `network-privacy-test.ts`.

## Copy

No paid advertisement may contain a word somebody meant to replace. Ad copy
built with no stored price says "price on request" — a real offer — rather than
a placeholder, and the Golden Visa angle is withheld entirely, because "above
the AED 2M threshold" is a claim about a price this company does not have.

*Guard:* `ad-copy-placeholder-test.ts` scans every variant of every angle.

On screen: say the thing, do not explain the mechanism. The reasoning belongs
in the module header where the next engineer needs it, not in front of somebody
trying to read a number.

## Windows

Two, and they are not interchangeable (`lib/meta/insights-window.ts`):

- **Headline** (lifetime) for a **report**. "How many leads did this bring" is a
  question about the whole life of a campaign and its answer must never go down.
- **Recent** (rolling 30 days) for a **judgement**. Not `this_month`: a calendar
  window erases every campaign's history at midnight on the 1st.

Google reads `LAST_30_DAYS` for the same reason, so the two channels are
compared like for like.
