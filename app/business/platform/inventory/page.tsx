import type { Metadata } from 'next'
import {
  Section, Band, Lede, P, Card, Grid, Stat, SpecTable, Guardrail,
  Steps, SectionHeading, PageHeader, NextPages, Mono, Callout,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Inventory',
  description:
    'Every project you sell as one record — price, payment plan, handover, unit mix, permit — and the scores that decide whether that record is complete enough to advertise from.',
  alternates: { canonical: '/business/platform/inventory' },
}

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · Inventory"
        title="Every project you sell, on one record"
        lede={
          <>
            Most brokerages keep inventory as a spreadsheet plus whatever the developer last
            emailed. Here each project is one row holding the facts a salesperson actually quotes —
            the price a buyer pays, the payment plan, the handover, the unit mix, the advertising
            permit — and three scores that answer one question: is this record complete enough to
            build an advert from.
          </>
        }
        meta={[
          { k: 'Per load', v: 'Up to 2,000 projects' },
          { k: 'Data quality', v: 'Good at 80 and above' },
          { k: 'Ad-ready at', v: 'Readiness 70 and above' },
          { k: 'Opportunity', v: 'Recomputed nightly, 03:30' },
          { k: 'Permit warning', v: '5 days before expiry' },
        ]}
      />

      {/* ── The record ──────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The record"
          title="One row per project, and what is deliberately left out of it"
          lede={
            <Lede>
              Sources disagree about everything, including what a field is called. A handover date
              arrives under five different names depending on who sent it. So each field is read
              through a chain of places it might be, and accepted only when what is found is
              plausible — a handover is taken only as a four-digit year between 2020 and 2099, or a
              date that genuinely parses. Nothing found means the field stays empty.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What one project record holds"
            rows={[
              { k: 'Identity', v: <>Name, area, developer, status, and the slug the public project page is served from.</> },
              { k: 'Price', v: <>Starting and ceiling price in AED. Read from the price columns first, then from whatever the source sent, then from the first priced unit — so a project stored in an unusual shape still sorts and filters correctly.</> },
              { k: 'Payment plan', v: <>Four milestones as percentages: down payment, during construction, on handover, post-handover. The list also carries a short tag read off the plan — 1% Monthly, Post-Handover, or an X/Y split.</> },
              { k: 'Handover', v: <>The year the buyer gets keys. Searched across the handover date, handover, completion date, completion and the investment highlights, in that order.</> },
              { k: 'Unit mix', v: <>Unit types with their own prices and bedroom counts. Bedroom filtering reads inside this list, understanding a studio as 0 and &ldquo;5+&rdquo; as five or more.</> },
              { k: 'Rental yield', v: <>The expected yield as the source gave it. A yield of 7% or more carries a High Yield tag. Price bands are under AED 1M, AED 1M–2M, and AED 2M and above.</> },
              { k: 'Media', v: <>One hero image, plus a gallery and a brochure link where the source provided them. A brochure URL is stored only if it is a genuine http or https address; anything else is dropped and the download button stays hidden.</> },
              { k: 'Advertising permit', v: <>The Trakheesi permit number and expiry date every Dubai property advert legally requires, with its own validity state.</> },
              { k: 'Data confidence', v: <>Whether the record has been reconciled against Dubai Land Department figures or is still derived from portal data.</> },
              { k: 'Golden Visa', v: <>Marked on the record, and counted across a developer&rsquo;s profile.</> },
              { k: 'Everything else', v: <>Whatever the source sent that does not fit a named field is kept alongside the row rather than discarded, and read back through the same fallback chains.</> },
            ]}
          />
        </div>

        <div className="mt-14 max-w-[64ch] space-y-5">
          <P>
            The more useful half of that table is the part that is empty. Five fields on the
            inventory screen are blank on purpose, because filling them would mean inventing them.
          </P>
        </div>
        <div className="mt-8">
          <SpecTable
            caption="Fields that are deliberately empty"
            rows={[
              { k: 'Size range', v: <>No size is stored on the record, so the screen shows a dash. The alternative was repeating one identical made-up range across every project in the list.</> },
              { k: 'Last updated', v: <>No edit timestamp is read into the inventory view, so the column is blank rather than showing the row&rsquo;s creation date dressed up as an edit.</> },
              { k: 'Views, last 30 days', v: <>Reported as zero. There is no web-analytics feed behind this number, and it will not be inferred from lead counts to make the screen look busier.</> },
              { k: 'Total and available units', v: <>Not populated yet. The record returns nothing rather than a unit count nobody can stand behind on a call.</> },
              { k: 'Linked campaigns', v: <>Always zero today — the count is not yet wired to the advertising side. The data-quality flag that depends on it therefore fires for every project. Both are named here rather than left to be discovered.</> },
            ]}
          />
        </div>
      </Band>

      {/* ── Payment plans ───────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Payment plans"
          title="Four readings, in order, then nothing"
          lede={
            <Lede>
              A payment plan is the single fact a buyer asks about first and the single fact
              developers send in the least consistent form. It arrives as a tidy object, as a
              sentence, or as a list of named stages. All three are read into the same four
              milestones.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The four-key object',
                body: 'Down payment, during construction, on handover and post-handover already named. Values may be plain numbers or strings like 20% — both are read.',
              },
              {
                title: 'A description carried on that object',
                body: 'Where the four keys are absent but the object carries a sentence describing the plan, that sentence is read instead.',
              },
              {
                title: 'A plain sentence',
                body: <>A string on its own, of the shape <Mono>10% down / 50% during build / 40% on handover</Mono>, split into its parts and matched.</>,
              },
              {
                title: 'A list of named stages',
                body: 'A label and a percentage per stage. Each label is bucketed by the earliest keyword it matches, so “50% during build, balance on handover” counts as construction rather than handover.',
                detail: 'Where a segment carries no label at all, position decides: the first segment is the down payment, the last is handover, and anything in between is construction.',
              },
              {
                title: 'Otherwise, nothing',
                body: 'If none of the four readings produces a plan, the reader returns nothing and the landing page omits its payment section entirely. There is no default plan, because a default plan on a property page is a quoted price the buyer will hold you to.',
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Data quality ────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Data quality"
          title="A score for how complete the record is"
          lede={
            <Lede>
              Every project carries a completeness score out of 100, so an owner can see at a glance
              which listings are missing the things an advert and a landing page need. It is
              arithmetic, not judgement — here is the whole of it.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="How the completeness score is built"
            rows={[
              { k: 'Starting point', v: <>Half the project&rsquo;s market score. A project the pipeline never scored starts from 45 rather than from nothing, so a missing pipeline score is not read as a bad project.</> },
              { k: 'Hero image', v: <>Adds 20. Nothing to show means nothing to build creative from.</> },
              { k: 'Payment plan parsed', v: <>Adds 10 — and only if a real plan came out of the four readings above.</> },
              { k: 'Starting price', v: <>Adds 15.</> },
              { k: 'Unit types', v: <>Adds 5.</> },
              { k: 'Ceiling', v: <>Capped at 100. The score cannot exceed the parts it is made of.</> },
            ]}
          />
        </div>
        <Grid cols={3} className="mt-10 bg-white/[0.07]">
          <Stat value="80+" label="Good" note="Enough on the record to build a page and an advert from." />
          <Stat value="50–79" label="Needs work" note="Usable, but something an advert would want is missing." />
          <Stat value="0–49" label="Poor" note="Not enough to publish. Fill the gaps before any spend." />
        </Grid>
        <div className="mt-10 grid grid-cols-1 gap-px sm:grid-cols-2">
          <Card kicker="Flags" title="What the screen calls out">
            A record scoring under 60 is flagged for attention, alongside the specific fields it is
            missing. The point of the flag is that it names the field, so fixing it is a two-minute
            job rather than an investigation.
          </Card>
          <Card kicker="Known gap" title="Two flags are not yet real">
            The record only ever knows about one image, so the &ldquo;fewer than five images&rdquo;
            flag fires for every project that has any image at all. The &ldquo;no linked
            campaigns&rdquo; flag fires for every project, because that count is hard-coded to zero.
            Neither is wired to live data yet, and both are on screen — so they are named here
            rather than left to mislead.
          </Card>
        </div>
      </Band>

      {/* ── Fit to advertise ────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Fit to advertise"
          title="Inventory decides what may be advertised"
          lede={
            <Lede>
              This is the part that earns the record its place. A project does not receive
              advertising money because somebody wants it advertised. It receives money because the
              record is complete enough to make claims from, there is somewhere for the traffic to
              land, and the permit is valid today.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="How ad readiness is built"
            rows={[
              { k: 'Completeness', v: <>Seventy per cent of the data-quality score above. An incomplete record cannot become a complete advert.</> },
              { k: 'A landing page exists', v: <>Adds 20. Paid traffic with nowhere to land is wasted spend — which is the reason the screen itself gives, in those words.</> },
              { k: 'A hero image', v: <>Adds 10.</> },
              { k: 'Ceiling', v: <>Capped at 100.</> },
              { k: 'Ad-ready', v: <>70 and above. The inventory list sorts by this score by default, so the projects nearest to being advertisable sit at the top of the screen.</> },
            ]}
          />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              A landing page has its own address, separate from the project&rsquo;s. The inventory
              carries both, and reports the page as live only when its row is actually published
              now: the right status, and the current moment inside its publish window. A date bound
              nobody can read is treated as no bound, not as a closed window.
            </P>
            <P>
              &ldquo;Pending review&rdquo; appears only when somebody actually asked a manager for
              publish authorisation. A plain draft is a draft, and renders as a badge you cannot
              click rather than a link that would take a buyer to a 404. Staff still get an edit and
              preview link, because they are allowed to see an unfinished page and the public is not.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              On top of readiness, the whole inventory is ranked into four verdicts, each with one
              plain next action. The ranking blends ad readiness at 30%, landing-page status at 25%
              (live counts 100, pending review 70, draft 50, missing 0), lead momentum at 20% where
              80 leads in a month is full marks, return at 15% where a 10% yield is full marks, and
              data quality at 10%.
            </P>
            <P>
              A separate list surfaces the ones being ignored: any project with a yield of 7% or more
              and no landing page. One reason line in that ranking — the one about conversion rate —
              depends on page views, and page views are always zero, so it never appears. It is named
              here so nobody waits for it.
            </P>
          </div>
        </div>

        <Grid cols={4} className="mt-12 bg-white/[0.07]">
          <Card kicker="Scale" title="Put more behind it">
            Landing page live, ad readiness 75 or above, blended score 70 or above.
          </Card>
          <Card kicker="Launch" title="Ready to run">
            Ad readiness 60 or above, and a landing page exists.
          </Card>
          <Card kicker="Fix first" title="Not yet">
            No landing page, or data quality under 55, or no image to build creative from.
          </Card>
          <Card kicker="Hold" title="Everything else">
            Nothing is wrong with it, and nothing yet recommends it over the rest of the list.
          </Card>
        </Grid>
      </Section>

      {/* ── The permit ──────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Trakheesi"
          title="The permit is checked before an advert runs, not after"
          lede={
            <Lede>
              Every property advert in Dubai needs a valid DLD advertising permit. The record stores
              the number and the expiry date, and one function is the single check the advertising
              side calls before it launches a campaign, moves budget into one, or lets a trial
              continue.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The five permit states"
            rows={[
              { k: 'Valid', v: <>A number and an expiry are on file, and the expiry is still ahead. Advertising may run.</> },
              { k: 'Expiring', v: <>Five days or fewer remaining. It still runs, and it is surfaced now rather than on the morning it stops.</> },
              { k: 'Expired', v: <>Past its expiry. Advertising stops.</> },
              { k: 'No expiry on file', v: <>A number, but no expiry date. Its own state and its own warning — a permit with no expiry is never assumed to be fine.</> },
              { k: 'Missing', v: <>Nothing on file. Nothing may be built for this project.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            Days remaining are counted on Dubai&rsquo;s calendar day, not the server&rsquo;s. The
            scheduled jobs run in UTC, four hours behind Asia/Dubai, and a permit that lapsed this
            morning would otherwise stay usable for the last four hours of the Dubai day — which is
            exactly the window a campaign would keep spending in.
          </P>
          <P>
            The permit&rsquo;s QR code encodes the Land Department&rsquo;s own advertising-licence
            validation address for that specific permit, and the permit number is appended once to
            the advert&rsquo;s body copy at launch — once, not on every edit.
          </P>
        </div>
        <div className="mt-12">
          <Guardrail
            title="Before an advert may run"
            items={[
              <>A project with no permit, or an expired one, cannot have campaigns or keywords built for it. The check refuses at launch, at reallocation, and at the point a trial would otherwise continue.</>,
              <>A permit number is accepted only if it reads like a reference: 4 to 40 characters of letters, digits, dashes, slashes or spaces, starting and ending with a letter or digit. Junk becomes nothing, never a permit.</>,
              <>An expiry is accepted only as a real calendar date. <Mono>2026-02-31</Mono> is refused rather than rounded into February.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Zero protection ─────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Zero protection"
          title="A number the system does not have is never shown as zero"
          lede={
            <Lede>
              One set of formatting rules sits under every figure on the public site and in the
              inventory. They treat only a finite number above zero as real. Everything else becomes
              a dash, a plain sentence, or nothing at all — because &ldquo;AED 0&rdquo; on a property
              page and &ldquo;0% yield&rdquo; in a pitch deck are worse than silence.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              A property with no priced unit reads &ldquo;Price on request&rdquo;, not AED 0. A
              missing yield, score or count is an em-dash. A row whose only content is a missing
              number is hidden rather than rendered blank. A project with no geocoding does not drop
              a map pin at <Mono>0, 0</Mono> — which is in the Gulf of Guinea, not Dubai.
            </P>
            <P>
              The same rule governs the written read on a project. Before anything is generated the
              system builds a list of the facts it actually holds — project, area, developer, prices,
              payment plan, handover, expected yield, status, unit mix, Golden Visa eligibility — and
              the text may only quote from that list. It is told plainly that no transport, school or
              walkability data is stored, so the lifestyle section returns nothing rather than filler.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Aggregate figures follow it too. Each market statistic is computed independently and
              fails on its own: a figure that cannot be computed is simply absent from the page
              rather than defaulted to zero. Counts of 100 or more are floored to the nearest hundred
              and shown with a plus — 3,512 reads as 3,500+ — and anything under 100 is shown exactly,
              because a small number rounded is a small number misrepresented.
            </P>
            <P>
              None of this is a display convention that a future screen could forget. The public
              projects endpoint enforces it in the query itself: a project without an image or with a
              starting price of zero is not returned at all.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <Guardrail
            title="Numbers it will not invent"
            items={[
              <>The public projects endpoint will not return a project that lacks a hero image or has a starting price of zero. That is the query, not a formatting rule applied afterwards.</>,
              <>A landing page will not show an invented payment plan. If nothing real parses, the payment section is omitted entirely rather than filled with a plausible 20 / 50 / 30.</>,
              <>Size range stays blank rather than repeating one invented range across every project. Last updated stays blank because no edit timestamp is read.</>,
              <>Property page views are reported as zero because there is no analytics feed behind them, and they will not be derived from lead counts to fill the column.</>,
              <>A developer&rsquo;s project count is recounted from the projects table on every save, never typed in. The public directory filters on that count, so a typed number would decide whether a developer appears at all.</>,
              <>The developer star rating and trust score are never populated, so those badges never render anywhere on the public site.</>,
              <>An empty workspace renders an empty state. There is no demo or seed data, and the statistics row is hidden entirely, so a company on its first day is never shown 0 / 0 / 0 / 0.</>,
              <>A status filter appears only when at least one property actually carries that status. A filter that could never return anything is not offered.</>,
              <>The written project read may only repeat facts copied from the record. Any claim not on the allowed list is discarded, a summary that ends up citing nothing is thrown away, and a profile whose four sections all came back empty is not stored.</>,
              <>That text is never rewritten silently when someone opens the page. Regeneration is a button somebody presses or a weekly job — and a profile whose underlying facts have since changed is labelled stale rather than quietly refreshed.</>,
            ]}
          />
        </div>
      </Section>

      {/* ── Opportunity ─────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Opportunity"
          title="Which project deserves the next advertising dirham"
          lede={
            <Lede>
              Eight components, each scored out of 100 or left empty, each carrying a sentence naming
              the actual numbers it used. The overall figure is the weighted average of the
              components that exist — so you can always ask a score why it says what it says.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The eight components and their weights"
            rows={[
              { k: 'Price competitiveness · 15%', v: <>The starting price against the median of priced projects in the same area. Needs at least three area peers with prices, or it is left empty. Half the median scores 100, the median scores 50, half again above the median scores 0.</> },
              { k: 'Ad readiness · 15%', v: <>The inventory readiness score exactly as it stands. It is taken, never recomputed here, so the two screens can never disagree.</> },
              { k: 'Area momentum · 15%', v: <>Attributed leads and landing-page views for the area over the last 30 days, as a share of the last 60. Rising interest, measured rather than felt.</> },
              { k: 'Payment plan strength · 15%', v: <>Weighted seven to three. First the down payment, at two and a half points off for every percentage point of it — so 20% down scores 50 on that part — then the post-handover share, counted up to 30%.</> },
              { k: 'Proven performance · 15%', v: <>Attributed leads over the last 90 days, multiplied by four, so 25 leads is full marks. Left empty only when there is neither a lead nor a campaign to judge it on.</> },
              { k: 'Developer depth · 10%', v: <>Other projects by the same developer in the catalogue, 20 points each: five or more is full marks. A developer you already sell is a developer your team can already answer questions about.</> },
              { k: 'Scarcity · 8%', v: <>100 × 6 ÷ (6 + competing projects in the same area). No competitor scores 100, six peers about 50, eighteen peers about 25.</> },
              { k: 'Area demand · 7%', v: <>The area&rsquo;s share of enquiry volume, measured against the busiest area on the platform.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              A component with no data behind it is left empty with a sentence saying why. It is
              never defaulted to a middle value, because a middle value is a claim and an empty one
              is the truth. Missing components lower the coverage fraction shown beside the score,
              but they never drag the score down: the weights are shared out again across only the
              components that exist.
            </P>
            <P>
              Below two computable components out of eight there is no score at all — it reads
              &ldquo;insufficient data&rdquo;. Sorting by opportunity sinks unscored projects to the
              bottom of the list rather than treating a missing score as a zero and burying a good
              project under a bad reading.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The whole set is recomputed once a night at 03:30 and written down complete. The screen
              always serves the stored score together with the time it was computed, and never
              recomputes while you are looking at it — so two people opening the same project on the
              same morning see the same number and can talk about it.
            </P>
            <P>
              Two of the eight, scarcity and area demand, are newer than the wording dictionary, so
              they currently appear under their raw field names rather than a written label. That is
              cosmetic, and it is the kind of thing this page will say rather than tidy away.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Shared reference ────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Where the facts come from"
          title="One shared market reference, your own editable copy"
          lede={
            <Lede>
              Underneath every workspace sits a single read-only reference: the catalogue of
              projects, areas and developers, and the Land Department records a project&rsquo;s
              figures are reconciled against. Everyone reads the same market facts. Nobody can write
              to them. When you edit a project, you are editing your own copy of it.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What the confidence badge means"
            rows={[
              { k: 'DLD-verified', v: <>Reconciled with Dubai Land Department records.</> },
              { k: 'Estimated', v: <>Derived from portal data, not yet reconciled with the DLD.</> },
              { k: 'Neither', v: <>No badge renders at all. The field is never assumed to be populated, and an unstamped project is not quietly promoted to &ldquo;estimated&rdquo;.</> },
            ]}
          />
        </div>
        <Grid cols={2} className="mt-10 bg-white/[0.07]">
          <Card kicker="Areas" title="A page per community">
            Median price per square foot, average rental yield, an investment score out of ten,
            project count, nearby landmarks and reasons to invest. An area appears in the public
            directory only if at least one tracked project sits in it. Two honest limits: every area
            profile is marked freehold, and every landmark is typed as a mall, because the source
            data carries no landmark category.
          </Card>
          <Card kicker="Developers" title="A counted track record">
            Listings, active and completed projects, average yield, Golden Visa count, the year of
            their first project, and an on-time delivery rate — completed projects whose handover
            date has actually passed, over all completed projects. A developer who has completed
            nothing gets no rate at all rather than a flattering one.
          </Card>
          <Card kicker="Public API" title="Four read-only endpoints">
            Projects, areas, developers and a combined search, for white-label front ends. Projects
            are returned only with an image and a price above zero: 100 rows by default, capped at
            200, cached a minute. Areas and developers return up to 200 rows, cached five minutes.
            Search needs at least two characters and returns at most 10 projects, 5 areas and 5
            developers. A failing endpoint returns an empty list, never a partial one.
          </Card>
          <Card kicker="Caps" title="What a caller actually gets">
            The public listing is capped at 96 rows however many are requested — the comparison
            screen asks for 1,000 and receives 96. White-label reads are restricted to the views
            that client is registered for, projected to allow-listed columns only, and capped at 500
            rows. A view outside the list is refused before the query is built.
          </Card>
        </Grid>
      </Section>

      {/* ── Onward ──────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Onward"
          title="A listing becomes a page, a page carries a campaign"
          lede={
            <Lede>
              Inventory is the first link in a chain, and every later link reads back from it. This
              is the whole path a project takes from an emailed brochure to a campaign spending real
              money.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The project arrives',
                body: 'Four ways in: upload a developer brochure, paste a page address, paste raw text, or fill the form by hand. One extraction contract produces the same fields from all four, with explicit instruction to return nothing where a field is not found. All four end at the same review screen before anything is saved.',
                detail: <>The link path fetches server-side behind guards: http and https only, the hostname refused if it resolves to a loopback, link-local, carrier-NAT or private address, a five-second timeout, a two-megabyte read cap, and the first 12,000 characters passed on for extraction. Brochure imports always get a slug prefixed <Mono>freehold-</Mono>, so an import can never overwrite a project somebody curated by hand.</>,
              },
              {
                title: 'The record is scored',
                body: 'Completeness, then readiness, then — overnight — opportunity. Nothing here is a judgement call: each score names the fields it counted and the fields it could not find.',
              },
              {
                title: 'A landing page is built from the record',
                body: 'The page takes its facts from the same row, which is why the payment section appears on some pages and not others, and why a project with no priced unit reads “Price on request” rather than carrying a number nobody can honour.',
                detail: 'When a brochure import creates the listing but the landing page fails, the screen says exactly that, with the real error, rather than reporting that nothing was created.',
              },
              {
                title: 'The advert is checked against the record before it runs',
                body: 'A valid permit today, a landing page that is actually live, and enough on the record to make the claims the creative wants to make. Any one of those missing and the campaign does not start.',
              },
              {
                title: 'The result comes back to the record',
                body: 'Leads are attributed to the project and counted over 30 and 90 days, feeding lead momentum, proven performance and area momentum on the next nightly pass. Page views are not part of that, because there is no page-view data — and a loop fed with an invented number is worse than a loop with one fewer input.',
              },
            ]}
          />
        </div>
        <div className="mt-14">
          <Callout>
            Nothing is advertised because somebody wants it advertised. It is advertised because the
            record behind it can support every claim the advert makes.
          </Callout>
        </div>
      </Band>

      <NextPages
        items={[
          { href: '/business/platform/landing-pages', label: 'Landing pages', blurb: 'What a page built from a listing contains, and what it leaves out.' },
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'The permit check and the spend limits, in the place they apply.' },
          { href: '/business/how-it-works', label: 'How it works', blurb: 'The whole path, from a project record to a signed deal.' },
        ]}
      />
    </>
  )
}
