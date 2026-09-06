# The Machine

### What this system does, in the language of the business it serves

---

## 1. The problem this exists for

You spend money on Meta. Leads arrive. Your brokers call them. Some are real
buyers, most are not, and at the end of the month you have a cost per lead and
no idea which half of the money did anything.

You already know the leads were mixed. What you cannot do is tell Meta.

That is the whole gap. Meta decides who to show your ad to next based on what
it can see, and all it can see is that somebody filled in a form. It cannot see
that one of them bought an apartment and eleven of them were looking for a job.
So it goes and finds more people who fill in forms — which is exactly what it
was asked to do, and exactly what you did not want.

**Every campaign starts from zero because nothing you learned last month ever
reached the platform.**

This system closes that gap. That is the thing it is for. Everything else in it
exists to make that one loop trustworthy.

---

## 2. The loop

Six steps. If you understand these, you understand the product.

**1. The ad runs.** A person sees it and fills in the form.

**2. The lead arrives with its origin attached.** Not just "from Meta" — from
*this ad*, inside *this ad set*, which targets *this pool of interests*. Most
systems throw that away within a day. This one keeps it on the lead forever.

**3. The machine makes a prediction, before anyone picks up the phone.** Based
on what leads from this same ad have actually been worth in the past, how
thoroughly the person read the page, whether the number can be dialled, and
what they bothered to answer. It says "this one is probably a 7."

Or it says nothing, which matters just as much — see §5.

**4. Your broker rates the lead, 0 to 10, in one click.** This is the only
work the system asks of a human, and it is the most valuable minute in the
business. That rating is the ground truth everything else is measured against.

**5. The rating goes back to Meta the moment it is given.** Not weekly, not on
a button, not in a report. The event carries Meta's own id for that form
submission, which means Meta ties the outcome to the exact ad that produced it
— not to a person it has to guess at from an email address.

**6. Meta optimises toward the ratings instead of the form fills.** Your next
campaign is aimed at people like the ones your brokers scored 8, not people
like the ones who filled in a form.

That is the loop. Campaign N teaches campaign N+1. Without step 5 the whole
thing is a very expensive spreadsheet.

---

## 3. What the prediction is actually made of

The strongest signal is not clever. It is simply: **what have leads from this
exact ad been worth before?**

Nobody tunes that. Your brokers' own ratings move it. An ad that produced four
8s gets a higher forecast for its next lead; an ad that produced four 2s gets a
lower one. After three rated leads an ad has earned an opinion. Before that,
the machine says it does not know.

The other signals adjust it, and every one of them is something observed before
anybody called:

- **How they behaved on the page** — read it properly, or bounced.
- **Whether the number can be dialled.** A lead nobody can reach is worth
  nothing whatever the ad said, so this one is allowed to overrule everything.
- **What they answered on the form** — someone who filled in the optional
  questions has told you something.

Then the loop closes on itself: the machine compares what it predicted against
what your broker actually said. When an ad is consistently rated *better* than
predicted, it is under-bought and deserves more budget. Consistently *worse*,
and it is over-bought. That difference is the instruction for the next campaign,
and it is arrived at by measurement rather than opinion.

**One safeguard worth knowing about.** An ad can beat a terrible forecast and
still produce leads nobody wants. "Less bad than expected" must never read as
"buy more" — that is how a system talks itself into funding rubbish. So a
source is only called under-bought if it beat its forecast *and* the leads were
genuinely good.

---

## 4. Who the ads are shown to

This is where most agencies quietly do something they should not, so it is
worth being direct about what this system does and does not do.

### It narrows by language, never by nationality

Language is a real field on the platform, and it is the only honest reason to
narrow: an Arabic ad shown to somebody who does not read Arabic is wasted money
for you and noise for them. So the audience is defined by the language the
creative is written in.

**Nationality is not a field.** Anybody selling you "target Egyptians" is
selling you a stack of proxies — surnames, page likes, interests — that is
wrong at the edges and wrong in a way that is invisible in a report. This
system will not build it. Not as an option, not as an advanced setting.

For housing specifically, deciding who sees a home based on where they or their
family come from is the kind of thing that ends companies. We do not build the
capability, so it cannot be switched on by mistake.

### Every audience must contain a property signal

The one hard rule: a person who has never shown the platform any interest in
property is a browser, whatever else is true about them. Cash buyer, luxury
shopper, business owner — irrelevant on its own.

So every audience this system builds carries a property requirement on top of
everything else.

**And that requirement has to actually narrow.** This is subtle and it costs
real money when it goes wrong. A requirement like "real estate investing"
sounds precise and reaches roughly two in five reachable adults in this
country — it is not a filter, it is the market. The requirement is now built
from signals that genuinely indicate somebody shopping for property, and every
one has its audience size recorded next to it so nobody can widen the gate
without noticing.

### What is excluded, and one honest limitation

Agents and brokers are excluded — they are researching, not buying.

**Job seekers cannot be excluded by targeting.** The platform has no
job-seeking interest to exclude; the nearest thing describes people who have
just *started* a job, which is close to the opposite. Anyone who tells you they
filter out job seekers with targeting is guessing.

What actually attracts job seekers is the offer and the creative. An ad that
reads as an opportunity brings people looking for one. That is a decision about
the ad, and the system does not pretend it is a decision about the audience.

---

## 5. Why some numbers say "not enough evidence yet"

You will see this on screens where other tools would show you a confident
figure, and it is deliberate.

Three leads from an ad is not a cost per lead. It is three leads. A tool that
prints "AED 78 per lead" from a sample of three has told you something it
cannot possibly know, and you will make a budget decision with it.

So numbers facing a decision are shown as a **range**, or withheld with a
statement of what is still missing. "Twelve more results and this becomes
decidable" is more useful than a precise-looking number that is wrong.

The same rule applies to the prediction in §3. When the machine knows nothing
about a lead it says nothing — not a middle value, not 50 out of 100. **A score
that is always present is a score that means nothing**, and the middle of a
scale is a claim that the lead is average, which is itself a claim.

This is the least flattering behaviour in the product and the reason you can
trust the numbers that *are* shown.

---

## 6. Which audience actually produced buyers

Cost per lead tells you what a form submission cost. It does not tell you what
it was worth.

Because every lead keeps its origin, the system can roll your brokers' ratings
back up to the pool of interests that bought them — for campaigns built here
*and* for campaigns built by hand in Ads Manager, since it reads the live
account rather than its own records.

So you can ask: of the audiences we have run, which brought people who bought?

**One honest limit.** The platform never tells you which single interest
produced a lead — inside an ad set they are an "or", resolved in one auction,
and there is no per-interest attribution. Anyone showing you a per-interest
breakdown is inferring it.

So the unit of measurement is the ad set's whole stack. If you want finer
resolution, the answer is structural, not analytical: **run one pool per ad
set.** Then the pool and the ad set are the same thing and the answer is exact.
The system tells you when splitting would buy you an answer, and only once the
pool has produced enough to make the question worth paying for.

---

## 7. The same person, twice

A duplicate is usually treated as waste. It is often the opposite.

Somebody who registered for an apartment in January and a different one in
March is not a filing error. They are actively shopping, and that is the
strongest buying signal in the book.

So the system reads repeat registrations rather than deleting them:

- **Twice in thirty minutes** on the same ad — a double submit. That one is
  genuinely wasted.
- **The same offer again, weeks later** — they are still interested.
- **A different apartment, similar price or area** — they are comparing. Call
  them.

And when two records are combined, **nothing is thrown away**. The first
registration is the base — it keeps its rating, its owner and its stage,
because that is the record your team has actually worked. Anything the person
told you the second time that you did not already have — an email, a bigger
budget, a different tower — is added to it. Where the two answers differ, both
are kept: that disagreement *is* the finding.

The lead then carries a mark saying this person came to you more than once.
That fact survives the merge, because it is a fact about the buyer rather than
about your filing.

---

## 8. What the machine does each morning without being asked

Every morning it reads the live ad account and checks the things that are
invisible from a performance report — a campaign can look perfectly healthy on
every number while the audience underneath it is wrong.

It checks whether the platform is quietly overriding your chosen audience,
whether the property requirement is actually binding, whether the ads are
running where you said and not on placements you never buy, whether the money
is pointed at residents or at everybody passing through, and whether a budget
has been split so many ways that no single ad can ever accumulate enough
results to be judged.

Then it tells one person, once, and only when something has **changed**. A
guard that reports the same problem every morning gets muted, and a muted guard
is worse than none.

**It does not pause your campaigns.** Stopping somebody's advertising without
them is a bigger mistake than the one being fixed. It makes exactly one change
on its own — switching off the platform's audience expansion, because an ad set
running with that on is running an audience nobody chose, and there is no second
question about what the fix is. Everything else it finds, it reports and leaves
for a person.

---

## 9. The rules that will not move

These are written into the system, not into a policy document, and each one is
there because of something that went wrong.

**Audience expansion stays off.** The platform's "expand your audience" setting
overrides the audience you chose. Cheaper leads, worse ones, and the report
looks better while the phone calls get worse.

**Placements are always chosen explicitly.** Left to the platform, budget goes
where impressions are cheapest, which is rarely where buyers are.

**Ads are bought for residents.** Meta's own default includes everybody
recently in the area, which for Dubai means buying tourists at property prices.

**No number is invented.** A closed deal carries its real value; a qualified
lead carries none. A made-up value teaches the platform to find more people
like a customer who never existed.

**Your data does not leave.** Contact details are hashed before anything is
sent to any platform. How your audiences are built never reaches a browser.
Nothing about one company's performance is ever visible to another.

---

## 10. What it asks of you

One thing.

**Rate the leads.** Zero to ten, one click, whenever a broker knows enough to
have an opinion. That is the entire input. Everything above runs on it.

An unrated lead is not a small gap. It is the loop stopping. The prediction has
nothing to be checked against, the platform hears nothing about whether the
money worked, and the next campaign starts as blind as the last one.

A month of ratings is the difference between a system that buys leads and a
system that learns what a good one looks like.

---

## In one paragraph

Your brokers already know which leads were real. That knowledge has always died
in the CRM. This system carries it back to the platform that spent the money,
attached to the exact ad that produced each lead, on the day the broker says
it — so the next campaign is aimed at people like the ones who bought, and the
one after that is better still. Everything else in the product exists to make
sure the numbers it shows you along the way are ones you can actually act on.
