import type { Metadata } from 'next'
import {
  Section, Band, Grid, Lede, P, Mono, PageHeader, SectionHeading, Card,
  SpecTable, Guardrail, Steps, Stat, Callout, NextPages, TextLink,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Analytics & finance',
  description:
    'The four analytics views, how cost per lead and cost per deal are computed, the finance and credit ledgers, and the figures the system refuses to report because the evidence behind them is too thin.',
  alternates: { canonical: '/business/platform/analytics' },
}

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · Analytics & finance"
        title="Numbers you can defend in a meeting"
        lede={
          <>
            This is where the money and the outcomes are read together: four analytics views, a
            management layer for deals and return on spend, and a finance layer covering commission,
            expenses, payouts and the ad-credit account each agent spends from. Every figure is
            computed from your own records — leads, logged activity, approved deals, ledger rows.
            Where something has not been recorded, the screen shows a dash rather than a zero, and
            the pages below explain exactly where that line falls.
          </>
        }
        meta={[
          { k: 'Analytics views', v: 'Four, role-locked' },
          { k: 'Credit value', v: 'AED 10 of funded ad spend' },
          { k: 'Team metrics', v: 'Up to 50 brokers' },
          { k: 'Overdue follow-up', v: '72 hours' },
          { k: 'Missing figure', v: 'A dash, never a zero' },
        ]}
      />

      {/* ── The four lenses ─────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Four views"
          title="Four lenses, and the one you open depends on your job"
          lede={
            <Lede>
              The business is split into Company, Team, Market and Marketing. Which of them you can
              open is decided by your role, checked once when the page renders and again on the
              server when the data is actually requested.
            </Lede>
          }
        />
        <Grid cols={2} className="mt-12">
          <Card kicker="Company · admin, CEO, director, sales manager" title="What the business did">
            <p>
              Total leads, new leads in the last 30 days, conversions, closing rate, sales volume,
              commission, approved deals and deals still pending approval. Below the tiles: a 30-day
              daily-lead line, leads by source, and the pipeline funnel. Closing rate is closed
              divided by total — not a weighted figure, not a model.
            </p>
            <p className="mt-3">
              Clicking a source or a funnel stage opens the matching filtered list in the CRM, so a
              figure you doubt is one click from the rows behind it.
            </p>
          </Card>
          <Card kicker="Team · admin, CEO, director, sales manager" title="Who did it">
            <p>
              A comparison table a manager builds: pick the agents, pick the columns, apply a saved
              preset — Performance, Effort, Retention risk, Full — and save the result into the
              Notebook as a document. Twelve columns are available across leads, wins, response
              health, follow-ups, activity, tenure and load.
            </p>
            <p className="mt-3">
              Team metrics cover up to 50 brokers. Activity counts run on a rolling 30 days, and wins
              are leads closed or converted in the last 30 days.
            </p>
          </Card>
          <Card kicker="Market · admin, CEO, director, marketing" title="What Dubai did">
            <p>
              How many projects, areas and developers the platform tracks, the average gross rental
              yield, and the top five areas by coverage with median price and yield. Five independent
              aggregate queries, each of which fails soft to null.
            </p>
            <p className="mt-3">
              Yields are rounded to one decimal. Areas with zero yield or no mapped projects are
              excluded rather than shown as zero-yield areas.
            </p>
          </Card>
          <Card kicker="Marketing · admin, CEO, director, marketing" title="Where the leads came from">
            <p>
              Leads broken down by source, by country or by team member, over 7, 30 or 90 days:
              leads, conversions, conversion rate, share of hot leads, an average lead score and an
              average stated budget. Capped at 20 rows, ordered by lead count.
            </p>
            <p className="mt-3">
              The lead score is an average of a fixed mapping — priority 95, hot 80, warm 50,
              everything else 25. It is a weighting someone chose, and it is stated here so nobody
              mistakes it for a prediction.
            </p>
          </Card>
        </Grid>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            A marketing user who opens a Company link is not shown an error page. The layout filters
            the tabs by role and sends them to the first view they are entitled to. The same role
            lists are re-checked on every API route, so a pasted URL or a hand-made request returns
            403 rather than data.
          </P>
          <P>
            Two exclusions are worth stating plainly. Brokers are kept out of company-wide lead
            analytics entirely. And the marketing role can see channels but not people: the{' '}
            <Mono>By team member</Mono> breakdown is hidden in the interface and returns 403 from the
            API to anyone outside admin, CEO and director.
          </P>
        </div>
      </Band>

      {/* ── The join ────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The join"
          title="Spend on one side, closed deals on the other"
          lede={
            <Lede>
              Cost per lead is arithmetic anyone can do in a spreadsheet. Cost per deal is the one
              that decides budgets, and it is only computable when the money and the outcome live in
              the same system, tied by attribution that survives the months between the click and the
              cheque.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="How each half of the ratio is computed"
            rows={[
              {
                k: 'Ad spend, per month',
                v: (
                  <>
                    Two sources added together, so neither is missed nor counted twice: manual
                    finance entries in the <Mono>ad_spend</Mono> category, plus{' '}
                    <Mono>credits_allocated × 10</Mono> AED from the campaign allocation rows.
                    Allocations with status <Mono>cancelled</Mono> are excluded — those are
                    reservations that were refunded when a campaign never served, and counting them
                    reported spend that never happened.
                  </>
                ),
              },
              {
                k: 'What a credit is worth',
                v: (
                  <>
                    One credit is AED 10 of funded ad spend. A campaign costs daily budget ÷ 10,
                    rounded, minimum 1 credit. That is the only conversion between credits and money
                    anywhere in the system.
                  </>
                ),
              },
              {
                k: 'Cost per lead',
                v: (
                  <>
                    Spend divided by leads for that month, with months keyed on{' '}
                    <Mono>YYYY-MM</Mono> so they sort correctly. A month with no leads reads 0 rather
                    than attempting the division.
                  </>
                ),
              },
              {
                k: 'Gross commission',
                v: (
                  <>
                    Rolled up from deals in <Mono>approved</Mono> or <Mono>closed</Mono> status only.
                    A deal sitting at either approval step, or rejected, contributes nothing to any
                    finance total on any screen.
                  </>
                ),
              },
              {
                k: 'Return on ad spend',
                v: (
                  <>
                    <Mono>(gross commission − ad spend) ÷ ad spend × 100</Mono>. With no ad spend
                    logged, it renders as a dash with the line &ldquo;Log ad spend in Finance to
                    compute ROI&rdquo;. It does not divide by zero and does not show a placeholder
                    percentage.
                  </>
                ),
              },
              {
                k: 'Per-source attribution',
                v: (
                  <>
                    Leads, closed deals and conversion rate for every source, exportable as CSV, plus
                    a written line naming the highest-converting source and the highest-volume
                    source. They are frequently not the same source, which is the entire point of
                    printing both.
                  </>
                ),
              },
              {
                k: 'Monthly performance',
                v: <>The last 6 months of deals, sales value and commission, sitting under the ratio.</>,
              },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The return-on-spend page and the four one-click finance reports — sales and commission by
            month, lead-source analysis, expense breakdown by category, commission settlement — are
            built from the same management analytics payload. The numbers match across pages by
            construction rather than by anyone remembering to reconcile them.
          </P>
          <P>
            The attribution that carries a lead back to a specific campaign is described on{' '}
            <TextLink href="/business/platform/crm">CRM &amp; leads</TextLink>: one campaign per lead
            or none, never two, with the platform campaign id beating the campaign name. That rule is
            what makes a cost-per-deal figure worth quoting rather than worth arguing about.
          </P>
        </div>
      </Section>

      {/* ── People ──────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="People"
          title="Measuring a sales floor, and the limits of measuring people this way"
          lede={
            <Lede>
              Four of the twelve team columns are computed in the page rather than read from the
              database. Their formulas are below, including the places where a column will read low
              for a reason that has nothing to do with the agent.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The computed columns, and what they actually mean"
            rows={[
              {
                k: 'Conversion rate',
                v: (
                  <>
                    Wins in the last 30 days divided by total leads. The numerator is a 30-day window
                    and the denominator is every lead that agent has ever held. An agent with three
                    years of history and a good month still reads low. Worth knowing before the
                    column appears in a review.
                  </>
                ),
              },
              {
                k: 'Effort per lead',
                v: (
                  <>
                    Activity in the last 30 days divided by total leads, to one decimal place. The
                    same asymmetry between the two windows applies.
                  </>
                ),
              },
              {
                k: 'Response health',
                v: (
                  <>
                    One minus overdue follow-ups divided by total leads, clamped to 0–100. It
                    measures open promises rather than speed — an agent who answers quickly and then
                    lets follow-ups lapse scores badly here, correctly.
                  </>
                ),
              },
              {
                k: 'Load %',
                v: (
                  <>
                    The agent&rsquo;s lead count against a fixed capacity of 12. That 12 is hardcoded
                    in the page and is not configurable, so a floor that genuinely runs at 30 leads
                    an agent will read as permanently overloaded until it is changed in code.
                  </>
                ),
              },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The response clock has a narrow definition, which is the only kind worth quoting. It
              starts at the earliest <Mono>assignment</Mono> activity on the lead, or at lead
              creation for leads that arrived already assigned. It stops at the first activity on
              that lead authored by its assigned broker. Four activity types are explicitly excluded
              from counting as a response: <Mono>assignment</Mono>, <Mono>created</Mono>,{' '}
              <Mono>repeat_inquiry</Mono> and <Mono>whatsapp_received</Mono> — a system row is not a
              reply, and an inbound message from the lead is not the agent answering.
            </P>
            <P>
              The per-agent figure is a median, computed in Postgres with{' '}
              <Mono>percentile_cont(0.5)</Mono> over that agent&rsquo;s responded leads, all-time and
              including closed ones, and it is displayed alongside the number of leads it was drawn
              from. Broker identity is matched on user id or email, because assignments were
              historically stored either way. The detail view covers up to 500 open assigned leads.
            </P>
            <P>
              The first-response target is optional and ships off. It reads one company-wide number
              in minutes and returns null unless that number is finite and above zero. The screen
              says so in these words: &ldquo;No target set — response times are measured, but no lead
              is flagged as a breach until you set one.&rdquo; There is no per-team or per-agent
              target.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The per-agent 360 opens one person&rsquo;s whole record: lead stats — total, new,
              closed, hot, overdue past 72 hours, closing rate — the last 50 leads, the last 60
              activity entries, the last 50 deals, ad-spend totals and the last 20 campaigns. Six
              queries run in parallel, again matching the broker on both user id and email. It is
              restricted to admin, CEO, director and sales manager.
            </P>
            <P>
              Commission on that page is rolled up only from deals in approved or closed status, and
              outstanding is commission minus received, floored at zero. Ad spend in AED is derived
              as <Mono>credits_spent × 10</Mono>. From the same screen a manager can add ad credits,
              assign an existing unassigned lead, create a lead for that person, or add them as
              co-agent on a deal.
            </P>
            <P>
              The data-quality score — how cleanly an agent logs lost and blocked leads — is
              display-only by design. The product calls it &ldquo;a coaching signal, not a
              penalty&rdquo; in the tooltip, and it gates nothing: not lead assignment, not spend,
              not any automatic action. Colour bands are 80 or above green, 50 or above amber, below
              50 red.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Absent vs zero ──────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Absent is not zero"
          title="A figure that has not been recorded is shown as missing, never as nought"
          lede={
            <Lede>
              A zero is a measurement. It says someone looked for the events and there were none. A
              missing figure is a different statement entirely: nobody has recorded the thing yet.
              Printing the second as the first is the most common way a reporting screen misleads the
              person reading it, and it is the decision this whole area is built around.
            </Lede>
          }
        />
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The consequence of confusing them is specific and expensive. A median response time of
            zero would make the least responsive agent on the floor the fastest. A viewing rate of 0%
            makes an agent who holds viewings but does not log them look identical to one who holds
            none. A return on ad spend of 0% reads as a failed quarter rather than as an unfilled
            expense ledger. In each case a manager acts on a number that measured nothing.
          </P>
          <P>
            So the team page prints the rule under its own table, in these words: &ldquo;A dash means
            the underlying events have not been recorded yet — not zero.&rdquo;
          </P>
        </div>
        <Grid cols={3} className="mt-12">
          <Card kicker="Response time" title="Never 0 minutes">
            An agent with no responded lead has no row at all rather than a median of zero. A lead
            that was assigned and never answered reports null minutes, not zero minutes.
          </Card>
          <Card kicker="Viewing and offer rate" title="A dash with its reason">
            A percentage is rendered only when the underlying event count is above zero and the agent
            has leads. Otherwise the cell is a dash carrying &ldquo;No viewing outcomes recorded
            yet&rdquo; or &ldquo;No offers logged yet&rdquo;, and a footnote under the table repeats
            the rule.
          </Card>
          <Card kicker="Market statistics" title="Never a fake number">
            Every market aggregate resolves to null if its query fails, so a database problem renders
            a dash. The file states the reason: callers can render only the stats that exist, never a
            fake number.
          </Card>
          <Card kicker="Company tiles" title="An em dash until the data lands">
            Until both underlying calls return, every tile shows an em dash rather than 0, and each
            tile carries a &ldquo;live&rdquo; badge only once its own data has actually loaded.
          </Card>
          <Card kicker="Website traffic" title="An empty state, on purpose">
            Page views, sessions, devices and top pages stay an empty state until Google Analytics or
            Plausible is connected. The comment in the code reads: no fabricated visitor or pageview
            data is shown. The copy names which figures on the same page are already live — lead
            sources, conversions and ad spend.
          </Card>
          <Card kicker="Money reads" title="A failed read is not a zero balance">
            The credits API distinguishes &ldquo;this agent has no account yet&rdquo; from &ldquo;the
            read failed&rdquo; and returns 503 on the latter. The ledger endpoint returns 503 rather
            than an empty list, so &ldquo;no movements&rdquo; and &ldquo;we could not check&rdquo;
            never look the same on a money screen.
          </Card>
        </Grid>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The management dashboard follows the same rule at the top of the day: its tiles show
            loading skeletons rather than zeros, and a badge reads either &ldquo;Live data&rdquo; or
            &ldquo;Data unavailable&rdquo; depending on whether the call succeeded. The finance
            reports page says &ldquo;No data available yet&rdquo; rather than rendering a page of
            noughts.
          </P>
          <P>
            The cost of this rule is that these screens sometimes say less than a competitor&rsquo;s
            would. The return is that a blank cell stays visible as a blank cell until someone
            records the thing behind it — and then the number appears, correctly, for the first time.
          </P>
        </div>
      </Section>

      {/* ── Withheld ────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Withheld"
          title="Where the system refuses to give you a number"
          lede={
            <Lede>
              Some figures are absent because nothing has happened yet. Others are withheld because
              the evidence behind them is too thin to defend, and a thin number carries the same
              authority on a screen as a solid one. These are the thresholds, exactly as they are
              set.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="Refusals and their thresholds"
            rows={[
              {
                k: 'Median first response',
                v: (
                  <>
                    Computed over the agent&rsquo;s responded leads only. An agent with no responded
                    lead has no row. The count the median was drawn from is shown next to it, so four
                    minutes across two leads cannot be read as four minutes across two hundred.
                  </>
                ),
              },
              {
                k: 'Viewing and offer rate',
                v: (
                  <>
                    Rendered only when the event count is above zero and the agent has leads. The raw
                    counts sit underneath the percentage — <Mono>7 held / 40 leads</Mono> — so the
                    denominator is never hidden behind a percent sign.
                  </>
                ),
              },
              {
                k: 'Data-quality score',
                v: (
                  <>
                    Null until the agent has terminal lead marks inside the 90-day window. No marks,
                    no score, and the cell is a dash. Where there are marks:{' '}
                    <Mono>(1 − burst marks ÷ marks) × 100</Mono>.
                  </>
                ),
              },
              {
                k: 'Burst detection',
                v: (
                  <>
                    Five or more distinct leads marked lost or blocked by one person inside 15
                    minutes, over a 90-day lookback. Four leads, or five spread across an hour, is not
                    a burst and nothing is excluded.
                  </>
                ),
              },
              {
                k: 'First-response breach',
                v: (
                  <>
                    Never flagged at all until an admin sets a target in minutes. Response times are
                    measured from day one either way; without a target, nothing is marked late.
                  </>
                ),
              },
              {
                k: 'Return on ad spend',
                v: <>Withheld as a dash until ad spend has been logged, with the reason on the line beneath it.</>,
              },
              {
                k: 'Marketing breakdown',
                v: (
                  <>
                    Capped at 20 rows ordered by lead count. The period is 7, 30 or 90 days chosen
                    from a fixed table, and the grouping column from a fixed set, so nothing
                    user-supplied reaches the query. Leads by source lists the top 8.
                  </>
                ),
              },
              {
                k: 'Team scope',
                v: (
                  <>
                    Up to 50 brokers, activity on a rolling 30 days, wins counted as closed or
                    converted in the last 30 days, and up to 500 open assigned leads in the response
                    detail view.
                  </>
                ),
              },
              {
                k: 'Agent 360 depth',
                v: (
                  <>
                    The 50 most recent leads, 60 activity entries, 50 deals and 20 campaigns. It is
                    the most recent of each, and the screen does not imply it is all of them.
                  </>
                ),
              },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The burst detector is the single source of truth for both the per-agent data-quality
            score and the training-integrity panel, so the two can never disagree about what
            happened. The panel names the actor, the count and the time window, links to the leads
            involved, and states its own limits in its header: surfaced as information only, no
            action is taken against the people listed there.
          </P>
          <P>
            What it does do is remove those outcomes from the data that campaign quality scoring and
            lookalike audiences learn from. An end-of-shift inbox clear-out should not be allowed to
            teach your advertising what a bad lead looks like. It names no fault and changes no lead.
          </P>
        </div>
      </Band>

      {/* ── Finance ─────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Finance"
          title="Commission in, costs out, and the net position between them"
          lede={
            <Lede>
              One page holds net commission from approved deals, total operating expenses, the net
              position between them, and commission still owed to agents — with a breakdown across
              seven fixed categories and an expense ledger you edit in place.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Net position is net commission minus total expenses. Categories are fixed at seven —
              Ads, Commission, Salaries, Expenses, Transportation, Referrals, Other — and anything
              unrecognised normalises to <Mono>other</Mono> rather than creating a new category that
              nobody will ever sum. Each category carries its total plus a paid and pending split.
            </P>
            <P>
              Entries can be added, edited in place, toggled between paid and pending, or deleted.
              Edits keep any field you did not specify at its stored value rather than blanking it.
              Management roles only. The listing returns 500 entries by default and is hard-capped at
              1,000.
            </P>
            <P>
              Bills and invoices is the same ledger read as a bill list — total, paid, outstanding,
              a filter for all, paid or pending, and a CSV of whatever is currently on screen. There
              is no separate invoice table, which is why the two pages cannot drift apart.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The commission waterfall on each deal is a subtraction chain with no assumed split rate
              anywhere in it. Every line takes either a percentage or an explicit AED amount, and the
              amount wins when both are present. Every stage is floored at zero, and all the newer
              lines default to zero — so a deal entered with only the classic fields produces exactly
              the old figures.
            </P>
            <P>
              Payouts are derived, not stored: the list is built server-side from approved deals whose
              commission outstanding is above zero. Recording a payment adds to the received amount,
              recalculates the status as unpaid, partial or paid, and flips an approved deal to closed
              once the agency commission is fully received. It is management-only and requires a
              non-zero amount.
            </P>
            <P>
              The contract register — platform, data, agency, legal, service — derives its status from
              the end date on every read rather than storing it stale: expiring at 30 days or fewer,
              expired past the end date, renewal extends by one year. It is a register only, with no
              link to the ledger or to payments, and it starts empty. The schema carries an explicit
              note that there is no demo seed.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="The commission waterfall, line by line"
            rows={[
              { k: 'Agency gross', v: <>What the agency is owed on the deal. The top of the chain and the only figure not derived from another.</> },
              { k: 'less referral, less cashback', v: <>Gives net commission — what is left after the referrer and any cashback back to the client.</> },
              { k: 'less deal expenses, less growth', v: <>Gives distributable — net commission after costs booked against that specific deal and the growth-fund allocation.</> },
              { k: 'less broker payout', v: <>Gives company net. The agents&rsquo; share is entered, not inferred from a rate held somewhere in settings.</> },
            ]}
          />
        </div>
      </Section>

      {/* ── The ledger ──────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The ledger"
          title="A balance is derived from its history, never typed into a field"
          lede={
            <Lede>
              Every agent has an ad-credit account with a tier, a monthly quota and a running balance.
              That balance is not stored as an editable number: it is a view that sums the ledger with
              one shared formula — allocations, refunds, adjustments and earns add, spends subtract —
              and the same formula is re-derived under a row lock whenever a spend is authorised.
            </Lede>
          }
        />
        <Grid cols={4} className="mt-12">
          <Stat value="12" label="Starter" note="Monthly credits — AED 120 of funded ad spend." />
          <Stat value="18" label="Growth" note="AED 180." />
          <Stat value="25" label="Pro" note="AED 250." />
          <Stat value="40" label="Elite" note="AED 400." />
        </Grid>
        <div className="mt-6 max-w-[68ch]">
          <P>
            Those four quotas are described in the code as commercial terms set by pricing, not as
            anything derived from a platform constraint. They are a decision, and they are labelled as
            one.
          </P>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="Credit arithmetic, as it is set"
            rows={[
              { k: 'Credit value', v: <>1 credit = AED 10 of funded ad spend.</> },
              { k: 'Campaign cost', v: <>Daily budget ÷ 10, rounded, minimum 1 credit — derived once and used for both Meta and Google.</> },
              { k: 'Earned on a deal', v: <>1 credit per AED 1,000 of the agent&rsquo;s commission, minimum 1, stacked on top of the monthly quota rather than absorbed into it. Only the primary agent earns: deals carry a co-agent name but no co-agent id.</> },
              { k: 'Monthly top-up', v: <><Mono>max(0, quota − current balance)</Mono>, evaluated against the Asia/Dubai calendar month in Postgres rather than the server clock. A balance already above quota is left alone, so bonus credits are never clawed back.</> },
              { k: 'Once per month, exactly', v: <>The top-up row is written under reference <Mono>cycle:YYYY-MM</Mono>, and a unique index on broker, type and reference means a calendar month can be granted to an agent exactly once however many times the rollover is attempted. An agent away for five months gets one top-up, not five. No cron job is involved.</> },
              { k: 'Movement cap', v: <>A single ledger movement is capped at 1,000,000 credits — AED 10M of funded ad spend — as a fail-closed guard against a typo. Amounts must be whole, positive and finite; fractions, negatives, NaN and Infinity are rejected at the library boundary.</> },
              { k: 'Low-balance email', v: <>Fires at 20 or fewer credits remaining, and only above zero. Best-effort: a failure to send never blocks or reverses the spend it followed.</> },
              { k: 'Ledger depth', v: <>50 movements in the agent&rsquo;s own view, 100 in the management drill-down, re-fetched from the server after every change rather than patched in the browser.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Credits leave the balance before an ad ever runs. The debit is booked under a
              reservation reference inside a transaction that locks the account row and re-derives the
              balance from the ledger, so two simultaneous launches for the same agent queue behind
              each other and cannot both spend the same credits. If the launch then fails, or falls
              back to something that never serves, the reservation is refunded and the allocation row
              is cancelled.
            </P>
            <P>
              If the refund itself fails, the system says so: it logs the agent, the reference and the
              amount, leaves the credits held, and refuses to report a clean outcome. A 402 for
              insufficient credits is returned only when the balance is genuinely readable and
              genuinely too low — a null balance never triggers one, because telling an agent they are
              out of credits when a query errored would be a lie.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Company coin sits above that as a bank-style view: Treasury, Operations and Lead Machine
              accounts plus one per broker, each with a readable account number formatted{' '}
              <Mono>FH-kk-nnnnnn-c</Mono> with a Luhn check digit, so a single mistyped or transposed
              digit is rejected in the browser and again on the server before anything moves. Every
              movement is double-entry — exactly two equal and opposite postings — and one transfer
              function is the only code in the system that writes to that ledger. Transfers are capped
              at 1,000,000,000 coins, AED is held in fils so nothing rounds away, the page shows the 60
              most recent postings and a memo is capped at 200 characters.
            </P>
            <P>
              The books are audited on every page load. Debits and credits across the whole ledger must
              net to exactly zero, and each account&rsquo;s stored balance plus held must match what its
              own postings imply. Any mismatch replaces the summary with a red banner: &ldquo;The books
              do NOT balance: {'{n}'} coins unaccounted for, across {'{w}'} wallet(s). Nothing here
              should be trusted until that is resolved.&rdquo;
            </P>
          </div>
        </div>
        <div className="mt-14">
          <Steps
            steps={[
              {
                title: 'An agent submits the deal',
                body: 'It enters at pending_step1. Deals created by a management role skip this and start at approved, because the person who could approve it created it.',
              },
              {
                title: 'Documents and KYC are verified',
                body: 'Restricted to sales manager and admin. All five checklist items — signed booking form, passport, Emirates ID, developer receipts, KYC — must be ticked, or the request is rejected with a 400.',
              },
              {
                title: 'Final approval, by a different role',
                body: 'Restricted to CEO and director, so nobody signs off their own verification. Either step can reject, and the reason is stored with the deal.',
                detail: 'Each transition is a conditional update that only matches a deal in the exact status it expects. A stale screen or a double-clicked button returns 409 rather than approving twice.',
              },
              {
                title: 'The commission is recorded as received',
                body: 'Recording a payment is management-only and requires a non-zero amount. It adds to the received figure, recalculates unpaid, partial or paid, and moves an approved deal to closed once the agency commission is fully in.',
              },
              {
                title: 'Credits are earned, once',
                body: 'Reaching final approval or full payment awards the agent 1 credit per AED 1,000 of their commission, minimum 1.',
                detail: 'The deal id is the ledger reference, so the same deal can never pay out twice even if approve and close both fire. A failure to write the credit is logged and never fails the approval.',
              },
              {
                title: 'Coin requests move money before they are marked approved',
                body: 'Approving a top-up request performs the transfer and only then writes the approved state. If the source wallet lacks the funds the API returns 409 and the request stays pending — there is no state in which a request reads approved and no coin moved.',
              },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The caps the automated ads system may not cross are set on the same side of the product: a
            maximum daily budget, a maximum single increase, and conditions — cost per lead below a
            figure, quality at or above one, at least a set number of leads — that must hold before it
            acts. Three starting templates load into the builder for review before saving; nothing
            applies automatically. Every decision is listed with its reason and the before and after
            spend, labelled auto, capped or blocked, so a capped increase is visible as a cap rather
            than looking like the system chose that number. The rules themselves are covered on{' '}
            <TextLink href="/business/platform/advertising">Advertising</TextLink>.
          </P>
        </div>
      </Band>

      {/* ── The report ──────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The report"
          title="A written board pack that is handed its numbers"
          lede={
            <Lede>
              One button produces a board-style written report: an executive summary, a KPI table, ten
              recommended decisions each with a rationale and a named owner, team highlights, market
              context, a seasonal marketing calendar and key risks. It is saved to the Notebook and can
              be reopened.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Before the model is called at all, four live inputs are gathered: deal finance totals,
              per-agent team metrics, market statistics, and the lead summary with its top 8 sources.
              Those are passed as context alongside a system instruction to ground every number in the
              supplied live data and never invent figures. It runs at temperature 0.5 with a
              4,096-token output limit, and is available to admin, CEO, director and sales manager.
            </P>
            <P>
              The output is stored with the generator&rsquo;s email and a dated title, and is rendered
              in a fully sandboxed frame — <Mono>{'sandbox=""'}</Mono> — so model-generated HTML cannot
              run scripts or reach the application around it.
            </P>
            <P>
              Because the four inputs are the same objects the Company, Team and Market views read, a
              KPI in the report and the same KPI on screen come from one computation. A figure you
              want to check is on a page, and the rows behind that page are one click further.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The report builder is the manual counterpart: pick a type and a date range and download a
              real CSV, .xlsx or PDF. The type selector genuinely changes which sections are included —
              a header block, a year-to-date summary of leads, deals, sales value, commission and
              conversion, then monthly deals and leads by source — rather than only changing the
              filename. PDFs use the standard Helvetica font, so characters it cannot encode are
              stripped rather than silently corrupting the file.
            </P>
            <P>
              The date range filters monthly rows, and a month label that cannot be parsed is kept
              rather than quietly dropped, because a row disappearing from a financial export is worse
              than a row you have to look at twice. Report history contains only reports that were
              actually generated — an entry is written on real file creation, capped at 100 — but it
              lives in browser storage, so it is per-device and not shared across the team.
            </P>
            <P>
              Two honest notes about the surrounding screens. The daily briefing at the top of the
              management dashboard reads like prose but is assembled in the browser from the same tile
              values rather than written by a model. And the live events feed is derived from lead
              records rather than a stored event log — it shows what changed on leads, not everything
              that happened in the system.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Refusals ────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Limits"
          title="What this refuses to report, and what it refuses to move"
          lede={
            <Lede>
              These are the places where the reporting does less than it could, deliberately, and
              where you can hold it to that. Every one of them is a rule in code rather than a
              paragraph in a policy.
            </Lede>
          }
        />
        <div className="mt-12">
          <Guardrail
            title="Refusals"
            items={[
              <>A metric with no underlying events is a dash, never a zero. Median response time is null when nobody has responded; viewing and offer rates are null until viewings and offers are logged; the data-quality score is null until an agent has closed a lead out. The rule is printed under the table.</>,
              <>No first-response breach is ever flagged unless an admin has set a target. Response times are measured either way; without a target, nothing is late.</>,
              <>No website traffic figures are invented. Page views, sessions, devices and top pages stay an empty state until an analytics provider is connected.</>,
              <>Market statistics fail to a dash, not a placeholder. Every aggregate resolves to null if its query fails, so a database problem never renders as a market fact.</>,
              <>A failed credit read is never shown as &ldquo;no credits&rdquo;, and a failed ledger read is never shown as an empty history. Both return 503, so &ldquo;nothing here&rdquo; and &ldquo;we could not check&rdquo; cannot look the same on a money screen.</>,
              <>Credit allocation never reports a success the ledger did not record. On failure the API says the credits were not written and nothing was allocated, and it distinguishes a rejected amount from a write failure.</>,
              <>The same movement cannot be charged or credited twice. A unique index on broker, type and reference, plus a conditional insert inside a savepoint, means a double-clicked approval, a retried launch or a webhook firing twice books exactly one row.</>,
              <>There is no endpoint that sets a wallet balance. Every change to coin goes through one transfer function; the code states that a balance you can assign is the thing this replaced.</>,
              <>Only the owner account may issue coin, and only the Treasury may go negative. The Treasury&rsquo;s negative balance is exactly the coin in circulation; every other account is hard-limited to what it holds.</>,
              <>If the coin books do not balance, the page refuses to present a confident total and says so in red instead.</>,
              <>Deal approval is split across two different roles and cannot be short-circuited, and a deal can only advance from the exact status it is in. Recording a payment is management-only.</>,
              <>Cancelled campaign allocations are excluded from ad-spend totals. They are reservations that were refunded when the campaign never served, and counting them would report spend that never happened.</>,
              <>Brokers cannot read other people&rsquo;s deals and are excluded from company-wide lead analytics entirely. The marketing role cannot see per-person performance: the breakdown is hidden in the interface and returns 403 from the API.</>,
              <>The data-quality score gates nothing. It is a coaching signal, it does not affect lead assignment or spend, and the product says so where it is displayed.</>,
              <>Training-integrity detection assigns no blame and changes no lead. It removes affected outcomes from what the ads system learns from, and nothing else.</>,
              <>The report generator is instructed to ground every number in supplied live data and never invent figures, and its output is displayed with no script execution and no access to the application around it.</>,
            ]}
          />
        </div>
        <div className="mt-14">
          <Callout>
            A dash gets questioned. A zero gets believed. That is the whole reason this system prints
            dashes.
          </Callout>
        </div>
      </Band>

      <NextPages
        items={[
          { href: '/business/platform/crm', label: 'CRM & leads', blurb: 'Where every figure on this page starts: the enquiry, its owner, and what it turned into.' },
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'The spend these ratios are measuring, and the caps it runs under.' },
          { href: '/business/security', label: 'Security & control', blurb: 'Who can see which view, and what is allowed to move money.' },
        ]}
      />
    </>
  )
}
