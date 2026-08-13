import type { Metadata } from 'next'
import {
  Section, Band, Grid, Lede, P, Mono, PageHeader, SectionHeading, Card,
  SpecTable, Guardrail, Steps, Stat, Callout, NextPages, TextLink,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'CRM & leads',
  description:
    'How an enquiry enters the system, who it belongs to, how long it sat before someone answered it, and what it turned into — with the thresholds and the refusals stated.',
  alternates: { canonical: '/business/platform/crm' },
}

export default function CrmPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · CRM"
        title="Every enquiry, and who answered it"
        lede={
          <>
            This is the working system for every enquiry the business receives. It takes leads in
            from your site, from Meta lead forms, from a spreadsheet and from an agent typing after
            a phone call; it decides who owns each one; it keeps a call list that says what is
            overdue and why; and it records the deal when one closes. The thresholds below are the
            ones the code actually uses.
          </>
        }
        meta={[
          { k: 'Lead identity', v: 'Last 9 digits of the phone' },
          { k: 'Overdue', v: '72 hours since last contact' },
          { k: 'Reassignment grace', v: '24 hours' },
          { k: 'Agent capacity', v: '12 leads' },
          { k: 'Stage vocabulary', v: '8 stages, database-enforced' },
        ]}
      />

      {/* ── Capture ─────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Capture"
          title="Four ways in, one row out"
          lede={
            <Lede>
              A lead arrives from a form on your site, from a Meta instant form, from the database
              you are moving off, or from an agent typing it in. Whichever door it came through, it
              lands in the same table, under the same duplicate check, with the same fields.
            </Lede>
          }
        />
        <Grid cols={2} className="mt-12">
          <Card kicker="Website and landing pages" title="Name and phone, or a 400">
            <p>
              The form posts to <Mono>/api/leads</Mono>. A name and a phone are required; both
              missing is rejected. The row keeps the full UTM set — source, medium, campaign, term,
              content, id — plus the referrer, a device record and the country, region and city the
              request arrived with.
            </p>
            <p className="mt-3">
              If the person already has an open lead, matched on the last nine digits of the phone or
              a lowercased email, no second record is created. The enquiry is written on their
              existing timeline as a repeat enquiry.
            </p>
          </Card>
          <Card kicker="Meta instant forms" title="Four sweeps a day, plus a button">
            <p>
              The sync runs at 01:15, 07:15, 13:15 and 19:15, and on demand from Pull forms in the
              CRM. It reads every non-deleted form on the connected account with that form&rsquo;s own
              Page token, and matches field keys tolerantly, so a question labelled &ldquo;Phone
              number (WhatsApp)&rdquo; or <Mono>your_full_name</Mono> still maps.
            </p>
            <p className="mt-3">
              Deduplication is a partial unique index on <Mono>meta_lead_id</Mono>, not a check
              before insert, so a scheduled sweep and someone pressing the button cannot both create
              the same person. The sweep is incremental: a per-form watermark with a ten-minute
              overlap, a 45-second wall-clock budget, and it resumes on the next run.
            </p>
          </Card>
          <Card kicker="Bulk import" title="Up to 2,000 rows a call">
            <p>
              Restricted to management roles plus marketing. Phones are reduced to digits with the
              last nine kept, statuses are mapped onto the CRM vocabulary by keyword — win, won and
              sold become closed; lost, dead and junk become lost; anything unrecognised becomes new
              — and budgets are stripped to a number.
            </p>
            <p className="mt-3">
              The response separates <Mono>inserted</Mono>, <Mono>skippedExisting</Mono>,{' '}
              <Mono>unreachable</Mono>, <Mono>duplicatesInFile</Mono> and <Mono>empty</Mono>. A row
              carrying a name but no phone and no email is counted as unreachable and reported back,
              never created. Re-running the same file duplicates nobody.
            </p>
          </Card>
          <Card kicker="Typed in" title="The call that came direct">
            <p>
              An agent creating a lead by hand goes through the same insert, the same phone
              normalisation and the same automation as every other path. There is no second, looser
              code path for records people make themselves.
            </p>
          </Card>
        </Grid>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            Everything downstream of the insert — the behaviour score, the Meta conversion event, the
            ad snapshot, the HubSpot mirror, the automation engine, the internal email and WhatsApp
            alerts — is fail-soft or fire-and-forget. A third party having a slow afternoon cannot
            cost you a lead, and a failing automation rule is logged and skipped rather than allowed
            to block intake.
          </P>
          <P>
            A Meta form lead with no phone and no email is skipped and counted as skipped. Meta
            saying thirty leads while the CRM holds none and the sync reports no error is not a state
            this system can produce.
          </P>
        </div>
      </Band>

      {/* ── Attribution ─────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Attribution"
          title="A row shows the most specific true thing it has, and stays quiet below that"
          lede={
            <Lede>
              The useful question about a lead is not only who they are. It is which ad they saw
              before they gave you their number — and whether the system actually knows that or is
              filling a column to avoid an empty cell.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              A whole list of leads is bucketed across campaigns in one pass, under one rule: the
              platform campaign id beats the campaign name. A lead is matched by <Mono>utm_id</Mono>{' '}
              first, by campaign name second, and — as a last-resort recovery for leads captured
              while the ad launcher wrote the id into the name field — by a name that looks like a
              platform id, at nine digits or more, strict enough that a campaign genuinely called
              2024 can never match.
            </P>
            <P>
              A lead belongs to exactly one campaign, or to none. Never two. Every campaign asked
              about gets a count including zero, because &ldquo;none&rdquo; and &ldquo;not
              asked&rdquo; are different things on a screen and should not look the same.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              What the row prints follows the same discipline. Only a project slug that actually
              names a real project earns the project line; an unverified string falls through to the
              campaign name, and from there to nothing. &ldquo;Unknown&rdquo; and &ldquo;General
              enquiry&rdquo; are stripped even when they are stored in the data, because a word that
              appears on every row teaches the reader to stop reading the column. If Meta cannot be
              reached, the row says less rather than something untrue.
            </P>
            <P>
              The ad set&rsquo;s targeting and the ad&rsquo;s copy are frozen against the lead at the
              moment it registers. The ad set can be edited an hour later, and then nothing would be
              able to say what the person actually arrived through.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="What arrives with a lead"
            rows={[
              { k: 'Identity', v: <>Name and phone. The last nine digits, digits only, are the identity: <Mono>+971 50 123 4567</Mono>, <Mono>0501234567</Mono> and <Mono>971501234567</Mono> are one person.</> },
              { k: 'Lead code', v: <>A generated column backed by a Postgres sequence — <Mono>FH-0001</Mono>, four digits padded, prefix set per deployment. It cannot drift out of step with the sequence, and a database that has already issued codes keeps them.</> },
              { k: 'Ad attribution', v: <>The six UTM fields, plus <Mono>meta_ad_id</Mono> and <Mono>meta_adset_id</Mono> for form leads. Leads synced before those columns existed are repaired quietly on later sweeps.</> },
              { k: 'Declared intent', v: <>The <Mono>?intent=</Mono> carried by the click, validated against a fixed vocabulary and written fill-if-empty only. A later click from a different ad never overwrites the first.</> },
              { k: 'Session', v: <>Referrer, a device record, and the country, region and city the request arrived with.</> },
              { k: 'Reading behaviour', v: <>Behaviour score, buyer intent, purchase probability and whether pricing was opened — or four nulls when there is no linked landing session. Not defaults. Nulls.</> },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            For leads that came through a landing page, the behaviour score is built from up to 200
            recorded events on that session, with fixed weights that sum to 100: reading depth up to
            30 (scroll at 25, 50, 75, 100), time invested up to 25 (dwell at 15s, 45s, 120s),
            material engagement up to 25 (gallery, brochure, any section opened), action signals up
            to 20 (a direct-contact tap, the form started).
          </P>
          <P>
            Buyer intent comes from which sections were opened: financial ones — payment plan, ROI,
            price, brochure — together with lifestyle ones — gallery, amenities, location — read as
            investor and end user; one alone reads as one of them; neither returns null rather than a
            guess. Purchase probability rises with the score, lifts on direct-contact signals, and is
            floored at 5 and capped at 90 so it can never be read as certainty. A lead&rsquo;s first
            behaviour score is the record: a later session can fill an empty one, never replace one
            that exists.
          </P>
        </div>
      </Section>

      {/* ── Ownership ───────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Ownership"
          title="Every lead has an owner, or the absence of one is on the screen"
          lede={
            <Lede>
              A broker only ever sees leads assigned to them. That makes an unassigned lead invisible
              to the entire sales floor, which is why the overview raises a counted banner naming
              exactly that, in those words, rather than leaving it for someone to notice in a month.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Ownership is filtered in SQL on both possible keys — user id and email — so a lead
              cannot appear in a list and then return nothing on its own page. Unassigned leads can
              be claimed by any leadership role from the assignment board.
            </P>
            <P>
              Automatic distribution ships switched off. Turned on, it hands a new lead to an agent
              the moment it arrives by one of five rules: round robin by fewest assigned in the last
              24 hours, load-balanced by fewest open leads, performance-weighted by approved and
              closed deals with ties going to the lowest load, area or specialty match against the
              project slug, interest and country, or a source-to-agent map.
            </P>
            <P>
              A daily cap per agent filters out anyone already at it — unless that would leave nobody
              eligible, in which case the cap is ignored rather than the lead dropped. Working hours
              are evaluated in Asia/Dubai, and outside them the lead goes to the fallback agent. Each
              assignment writes an activity row and emails the broker. Shipped defaults: manual mode,
              round robin, no cap, working hours off at 09:00–19:00, no fallback.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Rules can be written on top of that: if the source is Meta and the budget is at least
              two million, assign to the closers. Conditions cover source, status, priority, country,
              budget in AED, project, landing page, assigned agent, hours since created and hours
              since last contact, combined with ALL or ANY, run in sort order with an optional
              stop-on-match. Each rule shows how many times it has actually fired.
            </P>
            <P>
              One limit, stated because you would otherwise find it yourself: of the six trigger
              events the editor offers, only <Mono>lead.created</Mono> is wired today. A rule saved
              against <Mono>lead.updated</Mono>, <Mono>lead.status_changed</Mono>,{' '}
              <Mono>lead.unattended</Mono>, <Mono>deal.stage_changed</Mono> or{' '}
              <Mono>campaign.cpl_exceeded</Mono> will not fire, and the condition fields{' '}
              <Mono>campaign.cpl</Mono> and <Mono>deal.stage</Mono> resolve to null in the evaluator.
            </P>
            <P>
              The capacity board shows each agent&rsquo;s live load in one query: total assigned
              leads, leads marked hot, wins in the last 30 days, overdue follow-ups, and utilisation
              against a fixed capacity. Specialty is not a label someone typed — it is the project or
              interest that agent&rsquo;s own leads ask about most.
            </P>
          </div>
        </div>
        <Grid cols={4} className="mt-12">
          <Stat value="12" label="Leads per agent" note="The fixed capacity utilisation is measured against." />
          <Stat value="65%" label="At capacity" note="Still assignable, but the board says so." />
          <Stat value="90%" label="Overloaded" note="Utilisation at or above this reads as overloaded." />
          <Stat value="24h" label="Reassignment grace" note="A team leader cannot take a new lead off an agent inside it." />
        </Grid>
        <div className="mt-12">
          <Guardrail
            title="What a team leader cannot do"
            items={[
              <>Take a lead off an agent within 24 hours of it being assigned. The refusal is HTTP 409 and returns the exact timestamp it unlocks, so the screen can say &ldquo;unlocks in 6h&rdquo; using the same decision function the server enforces.</>,
              <>Take a lead the agent has already worked — any logged call, meeting, viewing, WhatsApp, email, SMS or message, any recorded last-contact time, or any status past new. However stale it has gone, moving it needs authority the role does not have.</>,
              <>Reach outside their own team. A lead held by an agent on another team is refused.</>,
              <>Escape the record. Refusals are logged with actor, role, action, target and reason, not only approvals — a leader repeatedly probing the grace window is a fact the log keeps. A failed log write never blocks the action it describes.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── The first hour ──────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Response"
          title="The first hour, measured rather than remembered"
          lede={
            <Lede>
              Response time is the one number a sales floor argues about and nobody can produce.
              Here it has a definition, and the definition is narrow enough to be worth quoting.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The clock starts at assignment, not at arrival',
                body: 'Assignment time is the earliest assignment row on the lead, falling back to lead creation for leads that arrived already assigned. A lead that was never assigned has no clock at all — it is not a fast response and not a slow one.',
              },
              {
                title: 'First response has a definition',
                body: 'The earliest activity on the lead authored by its assigned agent after assignment. Nothing else counts.',
                detail: (
                  <>
                    These do not count as a response: <Mono>assignment</Mono>, <Mono>created</Mono>,{' '}
                    <Mono>repeat_inquiry</Mono>, <Mono>whatsapp_received</Mono>. A system row is not
                    a reply, and an inbound message from the lead is not the agent answering.
                  </>
                ),
              },
              {
                title: 'The queue decides the order of the day',
                body: 'Breached promises first, worst first. Then band: leads rated 6 or higher, then unrated, then rated 3–5. Then rating inside the band, then hours overdue. Unrated sits deliberately in the middle, because unknown is not bad.',
              },
              {
                title: 'Overdue is 72 hours since last contact',
                body: 'One constant, shared by the queue, the team metrics and the leader coach, so they cannot quietly disagree. Marking a follow-up done writes the last-contact time, which resets the window legitimately. Snoozes of 4 hours, 24 hours, 3 days and 7 days are stored in the database, not the browser.',
              },
              {
                title: 'The target is a number an admin sets, and the default is none',
                body: 'Per-agent figures are medians across all their assigned leads, closed ones included; an agent with no responded leads gets no row rather than a zero, and a lead assigned but never answered reports null minutes rather than zero.',
                detail: 'The shipped default SLA target is null. Response times are measured from day one; nothing is flagged as a breach until someone decides what the promise is.',
              },
            ]}
          />
        </div>
        <Grid cols={3} className="mt-12">
          <Card kicker="05:00 UTC, daily" title="The overdue email">
            Each agent receives their own open leads with no contact for 48 hours, excluding snoozed
            ones, up to 500 rows across the run and at most 25 per email, each with a days-overdue
            figure and a direct link.
          </Card>
          <Card kicker="Leadership digest" title="Three things worth a manager reading">
            The overdue leads nobody owns; agents who have overdue follow-ups and have not logged in
            today, measured against today&rsquo;s Asia/Dubai date; and campaigns spending real money
            with almost nothing to show — 30-day spend of AED 200 or more with fewer than three
            leads, CPL quoted. Both management checks are fail-soft: Meta not connected produces no
            report rather than an error.
          </Card>
          <Card kicker="Set aside" title="Never deleted, never hidden">
            Blocked, archived, poorly rated and undialable leads move to a labelled, counted second
            list with the reason stated and a Call anyway button. A suspected duplicate only
            qualifies when the number also fails to dial. A breached response promise overrides every
            set-aside reason there is.
          </Card>
        </Grid>
      </Section>

      {/* ── The record ──────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The record"
          title="One timeline, three consumers"
          lede={
            <Lede>
              Every call, message, note, stage change and assignment is written to a single activity
              table. Three separate parts of the system read that table, which is the reason they
              cannot disagree about what happened.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The response clock reads it to find the first reply. The reassignment check reads it to
              answer one question — has this lead actually been worked. The training-integrity scan
              reads it to find leads terminated in bursts. One timeline, three answers that agree.
            </P>
            <P>
              The activity screen returns the 100 most recent rows joined to each lead&rsquo;s name
              and phone, filterable by type, with per-agent and per-type breakdowns. A broker session
              sees only activity on their own leads.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The lead page itself is server-rendered and scoped in SQL: contact details, stage and
              temperature, the landing-session read, the campaign and the exact ad, the timeline,
              scheduled viewings, the deal if there is one, the live risk flags, and the actions to
              call, message, rate, snooze, reassign or convert.
            </P>
            <P>
              The next-best-action strip on that page is a stated four-branch rule over real lead
              state — snoozed until X, make first contact, book a viewing, follow up. It is not a
              model, and it is not described as one.
            </P>
          </div>
        </div>
        <Grid cols={3} className="mt-12">
          <Card kicker="wa.me link-out" title="No setup at all">
            A link opens the agent&rsquo;s own WhatsApp with the number cleaned to digits and a
            message pre-filled. No API, no credentials, no business account, and it works on every
            deployment.
          </Card>
          <Card kicker="In-CRM inbox" title="A limit worth knowing before you buy">
            The full inbox holds one persistent WhatsApp connection for the Node process, linked by
            scanning a QR once. A serverless deployment cannot hold that socket open between
            invocations, so this half needs a long-running server. Its messages live in process
            memory, not a table.
          </Card>
          <Card kicker="Public-web research" title="Evidence or nothing">
            On request, a lead can be researched against the public web — employer, title, industry,
            city. If the reply carries no grounding metadata, meaning no search actually ran, every
            claimed fact is discarded. Facts without a source URL are dropped, and nationality and
            family are kept only with an explicit source, never inferred from a name.
          </Card>
        </Grid>
      </Band>

      {/* ── Duplicates ──────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Data quality"
          title="Two records, one person — and numbers that will not dial"
          lede={
            <Lede>
              Every brokerage that has run for a year has the same two problems in its database. Both
              are handled by stating what is suspected, never by deciding it.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="How a duplicate is decided"
            rows={[
              { k: 'Clustering key', v: <>The last nine digits of the phone, with a minimum of seven digits. Leads already marked lost are excluded from clustering.</> },
              { k: 'Which one is primary', v: <>The record with the higher intent score. The other becomes the candidate to merge into it.</> },
              { k: 'Confidence', v: <>High when a second field corroborates — the same email, or the same normalised name. Medium when only the phone matches. The pair is shown side by side and the level is stated.</> },
              { k: 'Merging', v: <>Always a human click. The duplicate is set to lost with a note naming the primary. Nothing is deleted: the record stays in the database with its history and leaves the active queues.</> },
              { k: 'Not a duplicate', v: <>Writes <Mono>duplicate_dismissed_at</Mono> on both rows, so the dismissal survives a reload and follows the person to another device instead of being re-raised tomorrow.</> },
              { k: 'Wrong number', v: <>A phone that is present but under seven digits. Counted on the overview and flagged on the row.</> },
              { k: 'Scope', v: <>The duplicate count and the per-row risk flag are computed across the whole table, not the page currently on screen.</> },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The order in which a lead can be set aside is an order of certainty. Blocked and archived
            come first, because someone decided them. A poor rating comes next, because an agent who
            spoke to the person decided it. Only after that comes same person — and it applies only
            when the record is also undialable, because a suspected duplicate someone rated well is
            still worth a call.
          </P>
          <P>
            An undialable number applies only when nobody rated the lead 6 or higher. A lead rated
            9/10 with a mistyped phone is a data-entry problem, not a bad lead, and the queue treats
            it as one.
          </P>
        </div>
      </Section>

      {/* ── Pipeline and deals ──────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Pipeline"
          title="Eight stages, and a close that records a number"
          lede={
            <Lede>
              The stage vocabulary — new, contacted, qualified, viewing, negotiation, converted,
              closed, lost — is a database check constraint, not a list in a settings screen. Nothing
              in the product can write a ninth.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The summary is computed from the database in one pass: hot leads, urgent follow-ups
              (new or contacted with no contact for 48 hours), new, closed, conversion rate as closed
              divided by total, duplicate risk, wrong numbers, and the stuck stage — the active stage
              holding the most leads untouched for seven days or more.
            </P>
            <P>
              Average time to close comes from real approved and closed deals. With none, the figure
              is an em dash and the words &ldquo;No closed deals yet&rdquo;. Conversion rate with no
              leads is null and renders as a dash. Neither is filled in with a plausible number, and
              a demo database does not produce a demo statistic.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The commission waterfall is subtraction with no assumed split rate anywhere in it:
              agency gross minus referral minus cashback gives net; net minus expenses minus growth
              gives distributable; distributable minus the broker payout gives company net. Each line
              takes either an explicit AED amount or a percentage of its own base.
            </P>
            <P>
              Recording a payment recomputes payment status — unpaid, partial, paid — and moves an
              approved deal to closed on its own once the agency commission is fully received.
              Co-agent deals credit both agents&rsquo; finance totals, and an agent&rsquo;s share is
              clamped to 1–100%. A lead can be converted into a deal once.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="From won lead to closed deal"
            rows={[
              { k: 'pending_step1', v: <>Where an agent&rsquo;s deal enters. Documents and KYC are checked here: signed booking form, passport, Emirates ID, developer receipts, KYC. Restricted to sales manager and admin.</> },
              { k: 'pending_step2', v: <>Documents verified, awaiting final sign-off. Restricted to CEO and director. The two steps are held by deliberately different roles, so nobody verifies their own verification.</> },
              { k: 'approved', v: <>Where a deal created by a management role enters directly, because the person who could approve it created it. Commission is now expected, not yet received.</> },
              { k: 'closed', v: <>The agency commission has been received in full. This transition is a consequence of a recorded payment rather than someone deciding the deal feels finished.</> },
              { k: 'rejected', v: <>Available at either step, and it stores the reason with the deal. Without one, the pipeline would show a deal that vanished and nothing on the floor would be able to say why — the reason is the difference between a record and a rumour.</> },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch]">
          <P>
            The same thinking applies to the other end. If an agent marks more than three leads lost
            within five minutes, a prompt offers to drip them into a nurture sequence instead. It
            never blocks the action — an agent who means it ignores it and carries on.
          </P>
        </div>
      </Band>

      {/* ── The feedback loop ───────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Feedback"
          title="What the sales floor decides is what the advertising learns"
          lede={
            <Lede>
              Most CRMs record an outcome and stop. Here, one tap after the call travels back to the
              ad platform, so it optimises for people who turn into business rather than for people
              who are good at filling in forms.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The rating scale, as written in the code"
            rows={[
              { k: '0–2', v: <>Stop buying this. These feed the exclusion audience.</> },
              { k: '3–5', v: <>Neither. Nothing is sent.</> },
              { k: '6–7', v: <>Good. This is the threshold that earns a qualified-lead event.</> },
              { k: '8–9', v: <>Exactly the lead we want. Seed material for a lookalike.</> },
              { k: '10', v: <>The agent is saying this became a deal.</> },
              { k: 'Zero is a rating', v: <>Only null is unrated. A zero is a judgment someone made and is counted as one. The rating is validated 0–10 and rejected otherwise, and it stores who rated it and when.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              A status of qualified, viewing, negotiation, converted or closed — or a human rating of
              6 or higher — earns a qualified-lead event. Converted or closed status, or a genuinely
              approved or closed deal, earns a purchase event, which outranks qualified. Only a real
              closed deal&rsquo;s property value rides on that purchase event.
            </P>
            <P>
              An agent tapping 10/10 seeds an audience and fires no purchase. A seed is reversible; a
              purchase event claiming a sale happened is not.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The write-back is one-way and once per stage. Moving a lead backwards sends nothing,
              because there is no un-qualify event and a send cannot be retracted. The stage is
              recorded before the send and released again if the send fails, so a retry is possible
              and a duplicate &ldquo;this lead was worth two million&rdquo; is not.
            </P>
            <P>
              The event id is deterministic — <Mono>{'fh-<stage>-<leadId>'}</Mono> — as a second line
              of defence, so a replayed webhook or an over-eager retry cannot double-count the same
              outcome.
            </P>
          </div>
        </div>
        <Grid cols={4} className="mt-12">
          <Card kicker="Step 1" title="Rated">
            Done as soon as anyone has rated anything. This is the only step the sales floor
            controls, and it is the one everything else depends on.
          </Card>
          <Card kicker="Step 2" title="Told">
            Events actually sent, compared against leads that earned one by any route — rated well,
            moved to qualified or deeper, or closed. Not against the rating count, so a closed buyer
            nobody got round to rating still counts in the denominator.
          </Card>
          <Card kicker="Step 3" title="Seeded">
            Measured on people Meta reported as matched, not on the number uploaded. A value-based
            lookalike needs 100 matched people before it works; a suppression list is useful from 20,
            because there is no modelling in it to degrade.
          </Card>
          <Card kicker="Step 4" title="Targeted">
            An audience nothing points at changes no delivery. With Meta not connected, steps two to
            four report blocked with a reason rather than sitting at waiting and looking broken.
          </Card>
        </Grid>
        <div className="mt-12 max-w-[68ch] space-y-5">
          <P>
            The seed itself is built from the whole funnel — status, deal value, blocked, phone,
            behaviour, rating — not from the rating column alone. Outcomes outrank opinions. Leads
            terminated in a burst, meaning five or more marked lost or blocked by one person inside
            fifteen minutes over a ninety-day lookback, are subtracted before any of it is used as a
            training signal, so an end-of-shift inbox purge cannot poison campaign quality scoring.
            That scan assigns no blame and changes no lead; it reports and excludes.
          </P>
          <P>
            The other direction is the exclusion audience. Every non-archived lead with an email or a
            phone is SHA-256 hashed by the same code that hashes a lookalike seed and uploaded to an
            audience named &ldquo;Already in your CRM&rdquo;, so campaigns stop paying to advertise
            to people you are already talking to. Nothing readable leaves. Refreshes append rather
            than rebuild, because someone who entered the CRM last month should stay excluded whether
            or not they appear in today&rsquo;s query. The rules that then spend against it are on{' '}
            <TextLink href="/business/platform/advertising">Advertising</TextLink>.
          </P>
        </div>
      </Section>

      {/* ── Refusals ────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Limits"
          title="What this CRM refuses to do"
          lede={
            <Lede>
              Capability lists are easy to write and impossible to verify. These are the refusals —
              the places where the system does less than it could, on purpose, and where you can hold
              it to that.
            </Lede>
          }
        />
        <div className="mt-12">
          <Guardrail
            items={[
              <>A broker only ever sees leads assigned to them, filtered in SQL on both ownership keys. Asking for someone else&rsquo;s lead returns a plain 404, never a 403 — so the response cannot be used to work out whether a lead exists.</>,
              <>Brokers cannot reassign. A request from a broker session carrying <Mono>assigned_broker_id</Mono> is rejected before anything else is evaluated.</>,
              <>Only the paying account owner can delete a lead. Admins, directors, sales managers and team leaders can archive, and the API says so in plain words. Every attempt, permitted or refused, is written to the authority log.</>,
              <>No lead is ever filtered or deprioritised by anything inferred about who the person is. Guessing a background from a name is illegal in housing, wrong constantly, and teaches the system nothing. Only recorded human judgments — a rating, an archive, a block — and mechanical facts, such as a number that cannot be dialled, move a lead out of the queue. Origin and nationality are not read, not stored, and are not a lever anywhere in the audience path.</>,
              <>A breached response promise outranks every quality judgment. A lead past the SLA target with no reply is never set aside, however poorly it is rated, because the breach is a fact about the company rather than about the lead.</>,
              <>A row never shows a placeholder dressed as a fact. Unverified project strings, &ldquo;Unknown&rdquo; and &ldquo;General enquiry&rdquo; are stripped rather than printed.</>,
              <>Duplicates are never merged automatically, and a merged record is marked lost rather than deleted. Its history stays.</>,
              <>Meta is never told something irreversible on a guess. The write-back is one-way and once per stage, and there is no invented negative signal: sending a purchase with a value of zero would teach the platform the person converted, so junk is handled by exclusion only.</>,
              <>Lead intake is never blocked by anything downstream of it. Behaviour scoring, the conversion event, the ad snapshot, the CRM mirror, the automation engine, the alerts and the write-back are all fail-soft or fire-and-forget.</>,
              <>The lead list is capped at 1,000 rows and says so, returning the true total and a truncated flag, so the screen reads &ldquo;showing 200 of 443&rdquo; rather than looking like leads went missing.</>,
              <>Archived and blocked leads are still returned by the list on purpose — quietly dropping them would change every team-analytics denominator — but they are flagged so each screen can decide.</>,
              <>Behaviour intelligence returns nulls rather than defaults when there is no linked session, and purchase probability is documented in code as a fixed-weight heuristic. A build check forbids describing it as trained on outcomes until there are enough closed deals to calibrate one.</>,
              <>Meta form leads receive no automated acknowledgement. The website path emails the person back; the ad-form path deliberately does not, because messaging a consumer is a consent and tone decision that should be switched on knowingly.</>,
              <>The assistant that answers questions about the pipeline is grounded on a live database snapshot, capped at 150 words, and instructed not to invent project names, phone numbers or prices. With the model unavailable it says so and points you at the pipeline, rather than guessing.</>,
            ]}
          />
        </div>
        <div className="mt-14">
          <Callout>
            Every rule on this page answers one of three questions: who owns this lead, how fast was
            it answered, and what did it turn into.
          </Callout>
        </div>
      </Band>

      <NextPages
        items={[
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'Where the ratings go, and what may spend against them.' },
          { href: '/business/platform/analytics', label: 'Analytics', blurb: 'The same numbers, read across the whole floor.' },
          { href: '/business/security', label: 'Security & control', blurb: 'Who can see what, and what can spend.' },
        ]}
      />
    </>
  )
}
