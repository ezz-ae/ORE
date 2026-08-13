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

## The money layer — leads are not the objective

Every gate in the Ads Machine judged **leads**. The business is paid on deals,
and they are not the same campaign:

```
cashoffer          25 leads   CPL AED 106   0 qualified   0 deals
venice-investor     8 leads   CPL AED 331   5 qualified   2 deals
```

On cost per lead the first wins three times over and the second gets condemned
as "> 2× the best sibling". `deal_value_aed` was in the CRM the whole time, read
by the seed builder and by no advertising decision anywhere.

`lib/freehold/money-truth.ts` states three rules:

1. **A campaign is judged only on a rung it has had TIME to reach** —
   lead → qualified → deal. A campaign eleven days old with no sale has not
   failed at selling; a sale here takes about six weeks. The account's own cycle
   replaces that default once it has closed `MIN_CLOSED_FOR_CYCLE = 5` deals
   (`money-truth-db.ts`), measured as a median so one nine-month deal cannot
   move it.
2. **The ranking counts deals, not dirhams.** One AED 12M villa does not prove a
   campaign fifteen times better than one that closed an AED 800k studio — that
   is the variance of the catalogue. Revenue is shown; cost per deal decides.
3. **Two campaigns separate only on a real test** — `samePace`, the same
   conditional-Poisson test the CPL gate uses. Otherwise `tied`, and the machine
   acts on a tie by doing nothing.

In ROTATE this gives the machine a **veto**: a trial provably ahead on qualified
leads or deals is not paused for its cost per lead. The veto never fires on the
lead rung, where it would be the CPL gate overruling itself with its own
numbers, and never over a human verdict — brokers calling the leads junk
outranks arithmetic about them. The mirror also holds: cheap leads that provably
become nothing get paused on that basis, and the log cites the p-value.

*Guard:* `money-truth-test.ts` — includes a source scan asserting the veto
filter is present in the rotate gate and that deal value travels from the CRM
read to the engine.

## The clock — a bad hour is not always a bad hour

Nothing in this product read the clock. Every number was a total over thirty
days, and an account that spends the same at 03:00 as at 19:00 is leaving the
easiest money on the table there is.

The obvious analysis is the wrong one. "Leads at 3am never convert, so stop
advertising at 3am" is what every dashboard does, and on a brokerage it is
usually backwards: a lead arriving at 03:00 is not called at 03:00, it waits
until 09:00 and goes cold. The hour did not fail — the cover did, and switching
the hour off deletes the evidence rather than the problem.

`lib/freehold/hour-truth.ts` splits them. A block that converts badly is `weak`
only when its leads were answered as fast as everywhere else; when they waited
`SLOW_RESPONSE_MULTIPLE = 2` times longer, it is `unanswered` and points at the
rota. Only `weak` may ever remove an hour from a schedule, and `scheduleFrom`
never returns an empty day.

Four blocks, not twenty-four hours: a month of one brokerage's leads gives two
or three per hourly bucket, so nothing would ever separate and the chart would
be noise. Dubai time throughout — an hour report computed in UTC is wrong by
four hours and looks perfectly reasonable.

*Guard:* `hour-truth-test.ts` — includes the blocks tiling the full day exactly
once, and that no lead rows survive into the reading the API serialises.

## The cap, split on purpose

The machine moves budget locally — ROTATE pauses a loser and hands its money to
a survivor, GROW raises a winner into idle headroom. Nothing ever asked the
portfolio question: given this cap and these campaigns, what should each be
running at tomorrow? The four facts that answer it were all being computed and
read by nothing that sets a budget.

`lib/freehold/budget-split.ts`:

1. **Fewer arms funded properly beats many arms starved.** `armsThatCanLearn`
   has always known how many ad sets a cap can carry past Meta's fifty-events
   floor. Splitting a cap across five arms it can fund two of does not give you
   five results — it gives five campaigns that never tell you anything.
   An **unknown** cost per lead starves nothing: not knowing is not evidence.
2. **The next dirham is not worth what the last one was.** A saturated arm —
   frequency at the ceiling, reach flat (`lookalike-ladder.ts`) — is held at its
   base and never raised. Its *average* still looks excellent, because the
   average is dominated by the money that bought the first views. This is the
   difference between allocating on average and on marginal return.
3. **Money moves only on a standing that separated on a real test**
   (`money-truth.ts`). A tie moves nothing.
4. **And the move never resets learning.** A change over
   `LEARNING_RESET_BUDGET_CHANGE` re-enters the learning phase, so the plan
   carries a **target** and a **step** and they are different numbers. A large
   cut is a glide of `glideDays`, capped at `MAX_GLIDE_DAYS = 14`; past a
   fortnight the evidence will have changed before the budget arrives.

An account already over its cap is reported as `overCapAed` — still over
tomorrow, converging across the glide. A plan that claimed to land overnight
would be lying about what the platform allows. The panel's Apply writes the
**step**, never the target.

*Guard:* `budget-split-test.ts`.

## The intent router — a verdict that decides something

The router reads a launch request as **intent** against what is already running
for the project, and returns one of five structural actions. It computed that
correctly from the day it shipped, and nothing acted on it:

- `/api/freehold/ads/route-intent` says in its own header *"the wizard shows
  this before the broker commits"* — and had no caller anywhere.
- In the launch route the decision changed behaviour in exactly **one** branch,
  `autonomy === 3 && action === 'hold'`. `getAutonomyLevel()` defaults to `1` and
  **fails closed** to `1`, so on a real account it is never `3`.
- Every other verdict was written to the decision log as *"the intent router
  recommended X — fold the arms via Campaign Groups"*: telling somebody,
  afterwards, what should have happened.

Now `routerBlocks` refuses a launch whose objective, language, audience **and**
creative are already running and still in the learning phase. A second one bids
against the first in the same auction and resets the learning on both.

**Refused at any autonomy level.** The autonomy gate governs the machine
*spending* on its own; declining to create a competitor is the machine *not*
acting — the same class as the Trakheesi gate and the landing-404 gate, both of
which refuse whatever the level is. Refusing to spend is not autonomy.

**And always overridable.** `confirmDuplicate` re-posts the launch. There are
real reasons to want two, and a refusal with no way through is a wall people
route around. Nothing is created and the reserved credits go back.

`routerWarns` covers the softer verdict — the same setup running but past
learning — which rides out **with** the successful launch instead of into a log.

*Guard:* `intent-router-acts-test.ts` — source scans that the refusal precedes
`launchFullCampaign`, that no autonomy check precedes it, and that the Run
button never hands its click event to `confirmDuplicate` (React passes the event
as the first argument, and a `MouseEvent` is truthy).

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
| No campaign judged on a rung it has not had time to reach | `money-truth.ts` | `DEFAULT_DAYS_TO_CLOSE = 42` |
| No return per dirham without a median deal to price it | `money-truth.ts` | `MIN_DEALS_FOR_MEDIAN = 3` |
| No account paced by its own sales cycle below a real median | `money-truth.ts` | `MIN_CLOSED_FOR_CYCLE = 5` |
| No verdict on a part of the day below a real lead count | `hour-truth.ts` | `MIN_LEADS_PER_BLOCK = 12` |
| No campaign starved on a cost per lead nobody knows | `budget-split.ts` | `costPerLeadAed === null` |

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
