import type { Metadata } from 'next'
import {
  Section, Band, Grid, Lede, P, Mono, PageHeader, SectionHeading, Card,
  SpecTable, Guardrail, Steps, Stat, Callout, NextPages, TextLink,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Intelligence',
  description:
    'The assistant docked on every screen: what it may read, what it may do, what it is refused, and the checks that run on its answer before you see it.',
  alternates: { canonical: '/business/platform/intelligence' },
}

export default function IntelligencePage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · Intelligence"
        title="The assistant, and the code that checks it"
        lede={
          <>
            There is one assistant in this platform. It is docked on every screen, it reads the live
            records the signed-in person is already allowed to see, and it can run the same internal
            actions the buttons on those screens run. What separates it from a chat window is that
            ordinary code inspects its answer before you read it: every figure is traced back to your
            own data, every link is checked against the list of pages that exist, and a sentence
            claiming it launched something is replaced when nothing launched. This page is mostly
            about those checks, and about what it is refused.
          </>
        }
        meta={[
          { k: 'Default autonomy', v: 'Level 1 — advisory' },
          { k: 'Figures traced', v: 'Every number of 10 or more' },
          { k: 'Link allow-list', v: '205 real routes' },
          { k: 'Actions', v: '27 tools, 7 destructive' },
          { k: 'Budget step', v: '±15%, floor AED 50' },
        ]}
      />

      {/* ── What it is ──────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The assistant"
          title="One conversation, docked on every screen"
          lede={
            <Lede>
              It opens with <Mono>⌘J</Mono> or <Mono>Ctrl-J</Mono> and it is a single conversation,
              not a separate chat per page — what you asked about on the CRM screen is still there on
              the campaigns screen. It answers questions, drafts messages and plans, and runs real
              actions. It has no other job.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The actions are not a description of the product. They are 27 internal tools across
              five groups — advertising, landing pages, CRM, creative, research — and each one calls
              the same function the interface calls when a person presses the button. A tool that
              cannot run returns an honest error rather than a simulated success.
            </P>
            <P>
              Seven of the 27 are marked destructive: pause a campaign, resume a campaign, set an ad
              set budget, add an automation rule, create a lead form, launch a campaign, edit an ad.
              Those seven are the ones the autonomy setting below governs. The other twenty read,
              draft and report.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              A turn is capped at five tool calls, with a breaker that tells the assistant its
              previous identical call has already been answered rather than spending the budget on
              retries. When a turn hits that ceiling, the reply says in plain language what got done
              and invites you to continue.
            </P>
            <P>
              Where the model runs is your decision, not ours. A company with its own Google Cloud
              project connected has every request routed through that project — its terms, its
              region, its audit trail, its quota. A plain API key is the fallback for a workspace
              that only has one. If neither is configured, the platform says so by name rather than
              degrading quietly.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="What it is handed on each turn"
            rows={[
              { k: 'The screen you are on', v: <>A text snapshot of the visible page, captured each turn, so &ldquo;this campaign&rdquo; resolves to what is in front of you. The screen is named as ground truth: if a tool result disagrees, it is instructed to re-list and find the matching record rather than ask you for an id.</> },
              { k: 'Your own records', v: <>A slice of the business assembled on the server for your role, and nothing outside it. Each piece fails soft — a source that is unreachable leaves the rest of the answer intact instead of breaking the chat.</> },
              { k: 'The conversation', v: <>Stored per account and owner-scoped: reading a conversation you do not own returns nothing, even with the id. The last 200 messages are kept, the last 20 turns are replayed on a resumed chat, and the history list shows the 50 most recent.</> },
              { k: 'What you attach', v: <>A PDF, a photo, a screenshot with a box drawn around the part you mean, or a voice note — about 12 MB each. Audio becomes an exact transcript, an image a description, a PDF its key facts. The extracted text rides with that one message and the slot then clears.</> },
              { k: 'Hard caps', v: <>The injected live context is truncated at 12,000 characters and each tool result shown back to the model at 6,000. Chat is limited to 20 requests per user per 60 seconds; file and voice ingest to 20 per minute.</> },
            ]}
          />
        </div>
        <Grid cols={3} className="mt-12">
          <Card kicker="The lane chip" title="Chosen by a rule, not a model">
            A chip in the composer, or the wording of your question, shifts the focus between
            advertising, sales and technical debugging. The match is a plain expression on the text —
            deterministic, and it costs nothing. The lane only swaps which brief is used; tools stay
            gated by role and by autonomy on the server, so a lane cannot widen what a session may
            do.
          </Card>
          <Card kicker="No stage directions" title="Its private notes are stripped">
            The model may write a private working field. That field is removed on the server before
            anything is rendered. Raw JSON, code, stack traces, field names, ids and API errors are
            banned from anything a non-developer reads, and bare internal tool names are filtered out
            at parse time and again when an old conversation is re-read.
          </Card>
          <Card kicker="Reply shape" title="Short, or behind a button">
            A good turn is one or two short text blocks plus at most one plan or one set of actions,
            with a soft ceiling around 120 words before the rest is offered as a button. If the
            output comes back malformed, the readable parts are salvaged and the fallback is one
            sentence: it lost its train of thought, ask again.
          </Card>
        </Grid>
      </Band>

      {/* ── Autonomy ────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Autonomy"
          title="One dial, set by management, held on the server"
          lede={
            <Lede>
              How far the assistant may act without asking is a single setting with three positions.
              It ships at the most cautious one. Neither the model nor the browser can raise it, and
              it is enforced where the action executes rather than in the wording of a brief.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Level 1 — advisory',
                body: (
                  <>
                    The default. Any of the seven destructive actions returns{' '}
                    <Mono>confirmation_required</Mono> unless you have confirmed that exact action in
                    your own words. It can plan a campaign, price it, write the copy and show you the
                    change — it cannot apply it.
                  </>
                ),
                detail: 'This is also the value the system falls back to if the setting cannot be read at all. A failure to read the dial is treated as the most restrictive answer, never as permission.',
              },
              {
                title: 'Level 2 — semi-autonomous',
                body: 'Destructive actions run without per-action confirmation, with one exception that is never waived: resuming or activating spend always needs an explicit human yes. Pausing waste is reversible in a click; restarting a bid is not.',
              },
              {
                title: 'Level 3 — autopilot',
                body: 'Destructive actions run unconfirmed, and only at this level does the unattended nightly pass run at all. Below it, nothing is applied automatically — the system proposes and a person applies with one click.',
                detail: 'The nightly pass runs at 04:30, after the lead sync and the advertising cycle. The first thing it does is read the autonomy level and skip entirely if it is below 3.',
              },
            ]}
          />
        </div>
        <div className="mt-12">
          <SpecTable
            caption="Where the dial lives"
            rows={[
              { k: 'Storage', v: <>One row in one table, constrained by the database to a single row and to the values 1, 2 or 3. It is read on every turn.</> },
              { k: 'Who may change it', v: <>Management roles only, through one endpoint. The model is given a description of what it may attempt and no means of changing what that is.</> },
              { k: 'Where it is enforced', v: <>In the code that executes a tool, not in the instructions given to the model. A prompt that talks its way past the brief still meets the same executor.</> },
              { k: 'Budget clamp', v: <>At levels 2 and 3 a budget change is clamped on the server to ±15% of the current daily budget, with a floor of AED 50 — after the request has been made, regardless of what was asked for.</> },
              { k: 'Audit', v: <>Every unconfirmed destructive action is written to the Library as a readable note naming the action, the parameters and the outcome. The nightly pass writes the same record for everything it applies.</> },
              { k: 'What the nightly pass will not touch', v: <>Campaigns created by the automated advertising side. If it cannot read which campaigns those are, it does nothing at all rather than guess — an empty ownership list would otherwise read as &ldquo;nothing is owned&rdquo;, and could restart an ad that was stopped for an expired permit.</> },
            ]}
          />
        </div>
        <div className="mt-12 max-w-[68ch]">
          <P>
            The same three limits that govern any other spend decision still apply above this one:
            the daily ceiling, the most that may move in a single change, and the quality floor below
            which a campaign may not receive more money. Those are on{' '}
            <TextLink href="/business/security">Security &amp; control</TextLink>.
          </P>
        </div>
      </Section>

      {/* ── Evidence ────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Evidence"
          title="Every figure is traced, or the whole report is withheld"
          lede={
            <Lede>
              This is the part worth reading twice. When the assistant reports on performance, each
              number in the answer is individually traced back to your live data before the answer is
              shown. If even one number cannot be traced, you do not get a corrected report — you get
              no report, and a plain statement of which figures could not be traced.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Grounded',
                body: 'The exact value appears in a tool result, or in the live context injected for this turn. The number was read from your data during this exchange, not recalled from anywhere else.',
              },
              {
                title: 'Derived',
                body: 'The value is a ratio, percentage, sum or difference of two grounded values, within a 0.5% rounding tolerance, searched over at most 40 grounded numbers. Arithmetic on your own figures counts as traceable; the working is kept.',
              },
              {
                title: 'Ungrounded',
                body: 'Neither. It cannot be shown to have come from your data or from arithmetic over it.',
              },
              {
                title: 'What happens then',
                body: 'One ungrounded figure discards the entire reply. What reaches you instead is a correction naming the untraceable figures. The code states the trade on purpose: a withheld true number costs a follow-up question, and an invented one costs trust in every number after it.',
                detail: 'The audit runs for every session, including roles that hold no tools at all — those are the sessions with the least data behind them and therefore the most likely to fill a gap.',
              },
            ]}
          />
        </div>
        <Grid cols={4} className="mt-12">
          <Stat value="10" label="The floor for checking" note="Figures below 10 are treated as noise and ignored, so ordinary sentences are not blocked." />
          <Stat value="40" label="Values searched" note="The largest set of grounded numbers a derivation is tested against." />
          <Stat value="0.5%" label="Rounding tolerance" note="Wider than this and the figure does not count as derived." />
          <Stat value="1" label="Untraceable figure" note="Enough to withhold the report it appeared in. There is no partial credit." />
        </Grid>
        <Grid cols={3} className="mt-12">
          <Card kicker="How we know this" title="The drawer under the answer">
            An answer that made numeric claims carries a line you can open to see each number and
            where it came from — read from your live data, or calculated from it with the arithmetic
            shown. The interface renders that audit as it was produced; there is no second place
            where it could say something different.
          </Card>
          <Card kicker="Verified" title="All, or the badge is not set">
            The badge appears only when every figure in the answer is grounded or derived. An earlier
            version set it when any single number was grounded, which meant one true spend figure
            could decorate nine invented ones with a verification mark. That was removed.
          </Card>
          <Card kicker="Campaigns you do not have" title="Named, or discarded">
            If the answer names a campaign your account does not hold, the answer is thrown away and
            you are shown the campaigns you actually have. The match is deliberately loose in both
            directions, so an abbreviation of a real name is not treated as an invention — and the
            check stays silent when there is no known list to compare against, because an accusation
            with nothing behind it is its own kind of error.
          </Card>
        </Grid>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Two further checks read the finished reply for claims about actions. The first catches
              first-person initiation and background-process language — starting an import, something
              running securely in the background, something taking several hours — and fires whenever
              no destructive action actually executed that turn. The second catches first-person
              creation claims — created, launched, published, generated, built, set up, posted — and
              fires when no tool that creates, launches, publishes, generates, adds, sends or saves
              succeeded.
            </P>
            <P>
              Both exist because of specific reports. One operator was told a multi-hour CRM import
              was running; nothing was running, and the platform has no background jobs to run. One
              client reported that the chat said a campaign had launched and nothing had happened. In
              both cases the sentence is now replaced with a correction stating what really ran and
              where the real feature lives.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Where these checks stop is stated rather than hidden. The figure trace runs only when
              the reply reads like a performance report — when it mentions spend, leads, budget, cost
              per lead, return on ad spend, impressions, reach, conversions or revenue — so ordinary
              conversation is not held up by it. The creation check is first-person only on purpose:
              a status line reading that a campaign is live is a legitimate answer from a list tool,
              and suppressing it would block true statements.
            </P>
            <P>
              The action tripwires match English phrasing only. The code says so plainly, and calls
              itself a partial net. That is also the reason the off switch further down this page
              exists: a business running real money through these screens is entitled to a control
              that does not depend on any net holding.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Links ───────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Links"
          title="It can only send you to pages that exist"
          lede={
            <Lede>
              A wrong link is a small failure that does a large amount of damage. Somebody follows
              the assistant to a page that is not there, and from then on they check everything else
              it said. This was a real report — every link the chat offered returned a 404 — and it
              is now closed by a list rather than by care.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The three rules every link must pass"
            rows={[
              { k: 'It must be internal', v: <>The address has to begin with <Mono>/</Mono>. There is no case in which the assistant links you off the platform — an external address is rejected outright, not checked and allowed.</> },
              { k: 'The route must exist', v: <>A build step walks the application and writes the canonical list of every navigable route — currently 205 patterns. Every link is checked against that list before the reply is returned. The list is regenerated as part of the build, so it cannot drift away from the real product.</> },
              { k: 'A record link needs the record', v: <>If the link points at a specific lead, form, project, property, landing page, campaign, deal or audience, that record&rsquo;s id or slug must have come back from a tool during this same exchange. A plausible-looking id is not a link.</> },
              { k: 'When a link fails', v: <>The words are kept and the link is dropped: the block is downgraded to plain text, and a button that would have navigated becomes an ordinary chat button. You lose a shortcut, never the answer.</> },
            ]}
          />
        </div>
      </Section>

      {/* ── Output ──────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Output"
          title="What survives the conversation"
          lede={
            <Lede>
              A chat that produces only chat is a toy. Three things the assistant makes are ordinary
              records in your account afterwards — they open, they are edited, and they are still
              there when the conversation is gone.
            </Lede>
          }
        />
        <Grid cols={2} className="mt-12">
          <Card kicker="The Notebook" title="Drafting against sources you tick">
            <p>
              A separate workspace where you choose which of your own data may be read — live
              projects, CRM leads, market figures, campaign performance, your earlier threads,
              uploaded files — and it drafts offers, comparisons, WhatsApp messages and ad copy from
              exactly those.
            </p>
            <p className="mt-3">
              Each ticked source builds a real retrieval, not a summary: up to five matched project
              records at 1,400 characters each plus the top twelve selling projects, the eight
              highest-yielding areas and six below-market projects, campaign attribution over 90
              days, up to eight earlier threads and twenty uploads. The panel names what it is
              reading while it works.
            </p>
          </Card>
          <Card kicker="Notes and receipts" title="Written where you can find them">
            <p>
              Research notes it saves go to the Library as ordinary documents. Every destructive
              action taken without a confirmation is written there too, naming the action, the
              parameters and the outcome, so an unattended change on a Tuesday has an answer on
              Wednesday.
            </p>
            <p className="mt-3">
              Under each reply, what it actually did is listed in words — checked your campaigns,
              pulled campaign results, paused the campaign, changed the budget. A failed action gets
              no receipt at all. It is logged on the server instead, because a success chip over a
              failure was an observed defect and not an acceptable one.
            </p>
          </Card>
          <Card kicker="Landing pages" title="A draft, and it says so">
            <p>
              A landing page made from chat is created as a draft and returns a real edit link. It is
              instructed never to present the public address as live until you publish it yourself.
              Listings and brochures it cannot create at all — no tool exists, so it is told to point
              you at the builder rather than describe having done it.
            </p>
          </Card>
          <Card kicker="Suggested questions" title="Named from your screen, or absent">
            <p>
              Instead of generic starters, the panel offers two to four short questions that name
              what is on the screen in front of you. It is forbidden from inventing a name or a
              number that is not in the screen text, capped at nine words each, and returns nothing
              at all — leaving the static defaults in place — when there is less than 40 characters
              on screen, when you are not signed in, or when the rate limit is reached.
            </p>
          </Card>
        </Grid>
      </Band>

      {/* ── Roles ───────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Roles"
          title="The same question, answered from a different slice"
          lede={
            <Lede>
              A broker and a director asking the identical question get different answers, because
              they are handed different data. The role is read from the verified session cookie and
              mapped on the server. The request carries no role field at all, so a browser cannot
              claim a higher one, and the tool list is filtered by role before it is even described
              to the model.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What each role is handed"
            rows={[
              { k: 'Broker', v: <>A snapshot of their own book: their leads, which are new, which are hot, viewings scheduled, follow-ups untouched for more than 72 hours, and what has closed. Advice is restricted to their leads, follow-ups, viewings and closing.</> },
              { k: 'Sales manager', v: <>Team performance and the company pipeline, alongside the same lead-level detail. Assignment and approval questions are answerable here and not below it.</> },
              { k: 'Marketing', v: <>Advertising performance, the state of each integration, and the lead-machine summary. Campaign and creative work sits here.</> },
              { k: 'Owner, director, admin', v: <>All of the above plus finance totals, server health and launch blockers — the operational questions nobody else should be asked to answer.</> },
              { k: 'Signed out', v: <>Forced to viewer. No tools at all. The figure trace still runs on the answer.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The scoping is not only about what is hidden. A broker is never told to fix billing,
              connect an integration, resolve a DNS record or manage another agent — their context
              excludes company infrastructure entirely, and the written brief forbids that advice
              even if they ask for it. Sending a salesperson to reconfigure a domain is the kind of
              helpful answer that costs an afternoon and a live campaign.
            </P>
            <P>
              Beyond the general assistant there are seven named specialists — web design, web
              management, marketing, CRM advice, platform operations, data — each with its own brief
              and its own list of roles permitted to use it. A role that is not on that list is told
              the skill is not available at their access level, rather than being handed a thinner
              version of the same answer.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              You can also point your own assistant at the platform. A personal token lets Claude,
              ChatGPT or Gemini read your business from your own chat application. The token carries
              the role — the caller cannot send one — and every write funnels through a single agent
              action that stages it for approval inside the platform. Write tools are not callable
              directly, and while autonomy is below level 2 the money-moving tools are removed from
              an outside assistant entirely.
            </P>
            <P>
              That executor fails closed. An empty role set denies every gated action rather than
              assuming the caller is the owner. The wider rules about who may see what, and what may
              spend, are on{' '}
              <TextLink href="/business/security">Security &amp; control</TextLink>.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Refusals ────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Limits"
          title="What the assistant refuses to do"
          lede={
            <Lede>
              This is the list to hold us to. Every line is a place the assistant does less than it
              could, on purpose, and most of them were written after something went wrong rather
              than in advance.
            </Lede>
          }
        />
        <div className="mt-12">
          <Guardrail
            items={[
              <>It will not show you a figure it cannot trace. Every number of 10 or more in a performance answer must appear in the data pulled that turn, or be simple arithmetic over figures that do. One untraceable figure withholds the entire report.</>,
              <>It will not mark an answer verified unless every figure in it is traceable. The badge is all or nothing.</>,
              <>It will not hand you a link to a page that does not exist, and it will not link off the platform at all. Any address that does not begin with <Mono>/</Mono> is rejected.</>,
              <>It will not tell you it started a background job. There are no background jobs, no import capability and no long-running processes behind the chat, and a tripwire replaces the sentence with a correction pointing at the real screen.</>,
              <>It will not claim it created or launched something unless a creating action actually succeeded. Otherwise the reply is replaced with a list of what genuinely ran that turn.</>,
              <>It will not discuss a campaign your account does not have. If it names one, the answer is discarded and you are shown the campaigns you hold.</>,
              <>It will not act on money without permission at the default setting. At level 1, every pause, resume, budget change, rule addition, form creation, campaign launch and ad edit requires that you confirmed that exact action in your own words.</>,
              <>It will never resume or activate spend without an explicit human yes at level 2, whatever else that level allows to run unattended.</>,
              <>It cannot move a budget by more than ±15% of the current daily figure in one step, with a floor of AED 50, clamped on the server after the request is made.</>,
              <>It cannot raise its own permissions. The autonomy level is a single server-side row that only management can change, and the role comes from the verified session cookie rather than from the request.</>,
              <>It cannot create a listing or a brochure — no such tool exists, so it is instructed never to say it did, and to point you at the builder.</>,
              <>A landing page it makes is a draft, never a live page, until you publish it.</>,
              <>It will not coach a broker on company infrastructure. Server health, launch blockers, integrations and the company pipeline are absent from their context, and the advice is forbidden in writing as well.</>,
              <>It will not read across people. Sales agents see only their own leads, the Notebook pipeline is scoped to the same book, and a conversation you do not own returns nothing even with its id.</>,
              <>It will not list the segments inside a pattern audience in a chat answer. It describes who the audience reaches instead — reciting the recipe in chat is the same leak as publishing the specification.</>,
              <>It will not show you internal machinery. Raw JSON, code, stack traces, field names, ids and provider errors are banned from anything a non-developer reads; a provider failure is translated into something actionable, with the original kept in the server log.</>,
              <>A failed action never receives a success receipt.</>,
              <>The Notebook will not invent a project name, a price, a handover date or a yield. Asked for verified project data with no sources ticked, it says it does not have live project data in this session and names the tick box that would give it some.</>,
              <>An outside assistant connected over a token gets no money-moving actions at all below autonomy level 2, and can never call a write action directly.</>,
              <>Nothing here runs automatically below autonomy level 3. The nightly pass reads the level first and skips.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Uncertainty ─────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Doubt"
          title="How to tell when it is guessing"
          lede={
            <Lede>
              The honest answer is that you should not have to tell. The system is built so that the
              cases where it does not know are visible in the answer itself, in the same words every
              time. Here is what those look like, so you can recognise one when it appears.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The shapes a shortfall takes"
            rows={[
              { k: 'A withheld figure', v: <>Cost per lead with no leads is null, never zero. A quality score is not produced until at least 5 attributed CRM leads exist. Frequency is withheld below 1,000 impressions, and the reason is stated where the number would have been.</> },
              { k: 'A rule that will not fire', v: <>Rate-based automation compares the confidence bound facing the threshold rather than the point estimate, so a rule cannot act on a sample too small to support it. Nothing happens, and that is the correct outcome.</> },
              { k: 'A named gap', v: <>Asked for project data with no sources ticked, the Notebook says it does not have live project data in this session and names the control that would give it some. It does not answer from memory.</> },
              { k: 'A marked draft', v: <>Any detail the drafted copy could not fill from your data is left marked <Mono>[VERIFY BEFORE SENDING]</Mono> rather than completed with something plausible.</> },
              { k: 'Silence', v: <>Screen suggestions return nothing rather than guess when there is too little on the page. An attachment the server has no key to read is reported as unavailable rather than described.</> },
              { k: 'A lost thread', v: <>When the output comes back malformed, the readable parts are kept and the rest is one sentence asking you to put the question again. It is not smoothed over into an answer.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Two things on this page are advisory rather than absolute, and it is worth saying so
              directly. The action tripwires match English phrasing, so a claim made in another
              language may pass them. The campaign check stays silent when there is no list to
              compare against. Both are nets. The figure trace and the link list are not — they
              either pass or the content does not reach you.
            </P>
            <P>
              Because they are nets, there is an off switch. One setting silences everything the
              assistant writes in sentences, across the whole workspace, before any model is called.
              Every screen, every panel and every button keeps working exactly as before, and every
              number on those screens still comes from the ad platform or from your own database. A
              company that would rather not run the sentences at all can have the rest without them.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The rules on this page are not only written down. Around eighty checks run on every
              build with no model, database or network involved, and the ones covering the assistant
              replay the actual incidents that caused them: the transcript in which a campaign was
              invented, the figures from a screenshot of a fabricated performance report, one
              operator&rsquo;s own monthly export — 8 ad sets, AED 5,088 spent, 26 leads — as a
              regression fixture.
            </P>
            <P>
              The same suite locks the provider routing, refuses a cheaper model tier as the default
              because that tier produced wrong-entity answers on this workload, and regenerates the
              link allow-list so it cannot fall out of step with the real application. A rule that
              fails the build is the only kind that stays true.
            </P>
          </div>
        </div>
        <div className="mt-14">
          <Callout>
            A withheld true number costs you a follow-up question. An invented one costs you every
            number after it.
          </Callout>
        </div>
      </Section>

      <NextPages
        items={[
          { href: '/business/security', label: 'Security & control', blurb: 'Who can see what, and what can spend.' },
          { href: '/business/platform/analytics', label: 'Analytics', blurb: 'The figures the assistant is required to trace back to.' },
          { href: '/business/platform/crm', label: 'CRM & leads', blurb: 'The records it reads, and who owns each one.' },
        ]}
      />
    </>
  )
}
