import type { Metadata } from 'next'
import {
  Section, Band, H3, Lede, P, Card, Grid, Stat, SpecTable, Guardrail, Steps,
  PageHeader, SectionHeading, Callout, NextPages, Mono, TextLink,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Landing pages',
  description:
    'A standalone advertising page for every property, built from the listing itself — and the gate that refuses to let a campaign point at a page that is missing, unpublished or past its window.',
  alternates: { canonical: '/business/platform/landing-pages' },
}

export default function LandingPagesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · Landing pages"
        title="A page per property, and a gate in front of it"
        lede={
          <>
            Any project in your inventory can become a standalone advertising page, built from the
            listing&rsquo;s own record rather than typed into a page builder. Before a campaign is
            allowed to point at that page, the page itself is checked. If it does not exist, is not
            published, or its publish window has closed, the launch is refused and the reason names
            the page.
          </>
        }
        meta={[
          { k: 'Public address', v: '/lp/<slug>' },
          { k: 'Section types', v: '19, each self-hiding' },
          { k: 'Layouts', v: '3 — classic, campaign, signature' },
          { k: 'Languages', v: 'English, Arabic (RTL), Russian' },
          { k: 'Stops a launch', v: '4 of 6 verdicts' },
        ]}
      />

      {/* ── Creation ────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Where a page comes from"
          title="The listing writes the page"
          lede={
            <Lede>
              There is no blank canvas and no form to fill in. You choose a project you already hold
              in Inventory, choose a layout, and a complete campaign page is written and opens ready
              to edit.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The listing comes first',
                body: (
                  <>
                    The project is looked up by its slug. If nothing matches, the request returns a
                    404 and nothing is created &mdash; &ldquo;No project found matching X. It must
                    exist in Inventory before a landing page can be created for it.&rdquo; There is
                    no sample or seed record to fall back on, on this path or on the written-copy
                    path.
                  </>
                ),
              },
              {
                title: 'The sections fill themselves from the record',
                body: (
                  <>
                    Name, area, developer, starting price, rental yield, payment plan, unit types,
                    images, amenities and FAQs are read out of the project and placed into the
                    matching sections. One routine builds each section type, so all three layouts
                    receive identical data and any holder with nothing behind it hides itself.
                  </>
                ),
              },
              {
                title: 'You get two addresses, and they mean different things',
                body: (
                  <>
                    The edit address works immediately. The public address,{' '}
                    <Mono>/lp/&lt;slug&gt;</Mono>, works only once the page is published, and the
                    code says in as many words that it must never be presented as viewable before
                    then. The slug is the project and campaign name, capped at 80 characters, retried
                    as <Mono>-2</Mono>, <Mono>-3</Mono> and so on for up to fifty attempts until it
                    finds a free one.
                  </>
                ),
              },
              {
                title: 'It is a draft unless you may authorise publishing',
                body: (
                  <>
                    Every page is created as a draft. If the person creating it is allowed to
                    authorise publishing, it can go live; if not, it is held for someone who is.
                    Nothing appears at the public address until that happens.
                  </>
                ),
                detail: (
                  <>
                    Two other ways in. &ldquo;Create all missing&rdquo; walks every project that has
                    no page and does the same for each. Or start from the developer&rsquo;s brochure:
                    upload the PDF (30 MB limit), correct the details the system read out of it
                    &mdash; that confirmation step is mandatory &mdash; and the listing record and
                    its page are created together, because the page needs a project behind it. If the
                    listing is created and the page then fails, the error says exactly that instead of
                    reporting success.
                  </>
                ),
              },
            ]}
          />
        </div>
      </Band>

      {/* ── What is on the page ─────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="What renders"
          title="Nineteen sections, and the condition each one has to meet"
          lede={
            <Lede>
              Hero, description, gallery, units, market read, key facts, payment plan, ROI, why
              Dubai, amenities, location, Golden Visa, testimonials, developer profile,
              neighbourhood, concierge, FAQ, brochure download, lead form. A section with no real
              data behind it does not render an empty box. It disappears.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What has to be true before a section appears"
            rows={[
              { k: 'Gallery', v: <>At least two genuine http(s) image URLs, with the <Mono>/logo.png</Mono> fallback filtered out. Renders at most six. One image is already the hero, so below two the section hides.</> },
              { k: 'Units', v: <>Renders nothing when the project names no unit types. Bare type labels go to key facts instead, so no empty price-and-size cards ever reach a public page.</> },
              { k: 'Payment plan', v: <>Free text is only parsed into stages when the percentages sum between 95 and 105. Anything else means the structure is unknown and the section is omitted.</> },
              { k: 'ROI', v: <>Hides entirely when there is no real yield and no income figures, rather than showing four cards of em-dashes.</> },
              { k: 'Developer profile', v: <>Hides without a real developer name. Any statistic missing either a value or a label is dropped.</> },
              { k: 'Testimonials', v: <>Nothing renders unless real quotes exist.</> },
              { k: 'Market read', v: <>Hides &mdash; along with its live badge &mdash; when it has neither a summary nor bullets.</> },
              { k: 'Key facts', v: <>At most six items; laid out four across below five facts, three across above.</> },
              { k: 'Golden Visa', v: <>States the published threshold of AED 2,000,000 and nothing beyond it.</> },
              { k: 'Permit strip', v: <>Built from the listing&rsquo;s real Trakheesi permit number, with a scannable QR and a link to verify it with Dubai Land Department. Never invented.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Three things are re-read from the project on every single request: the gallery, the ROI
              figures and the brochure link. Enrich a listing at four in the afternoon and its pages
              carry the change immediately. The rest of the page body &mdash; including the key facts
              and the hero price chip &mdash; is the snapshot taken when the page was built.
            </P>
            <P>
              Read in English, Arabic right-to-left, or Russian, in a light or dark theme, chosen from
              the top bar. Fixed labels come from a static dictionary; the written content is
              translated once and cached. Any failure returns the original English page with its
              honest &ldquo;not translated&rdquo; flag attached, and that flag survives the cache, so
              a page never shows half a language.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              The editor shows a toggle for automatic pricing updates and the column behind it is
              stored, but nothing reads that flag. The live re-reads above happen either way. We would
              rather write that down here than let a toggle imply a mechanism that is not there.
            </P>
            <P>
              Default sections are only added in bulk to a page holding fewer than four sections.
              Above that, the only thing added is a missing lead form &mdash; so a page written for a
              specific audience is not quietly padded back out to a standard shape.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <Guardrail
            title="What it will not put on a page"
            items={[
              <>Invent a payment plan. Only a strict numeric split summing between 95 and 105 renders as stages; anything else means the structure is unknown and the section is left out.</>,
              <>Fabricate testimonials, or invent developer track-record statistics. The developer section is qualitative unless a figure carries both a value and a label.</>,
              <>Render placeholder image tiles. Only real image URLs count, and below two the gallery hides rather than padding itself out.</>,
              <>Show an ROI block of blank dashes, or a market read with a live badge and nothing to say.</>,
              <>Claim guaranteed returns. Any yield or ROI figure must be labelled projected or estimated.</>,
            ]}
          />
        </div>
      </Section>

      {/* ── Layouts and written copy ────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Shape and copy"
          title="Three layouts, four audiences, eight buyer intents"
          lede={
            <Lede>
              A layout is an ordered list of section types. The order it defines is preserved; only a
              page with nothing stored at all is sorted into a fallback order. The layout also sets
              the page&rsquo;s colour palette.
            </Lede>
          }
        />
        <Grid cols={3} className="mt-12 bg-white/[0.07]">
          <Card kicker="16 sections" title="Classic">
            The full brochure &mdash; market read, key facts, ROI, amenities, FAQ, concierge. For a
            warm buyer who wants depth before they will speak to anyone.
          </Card>
          <Card kicker="9 sections" title="Campaign">
            The lead form sits directly under the hero, with the payment plan and scarcity next. This
            is the one to point paid advertising at.
          </Card>
          <Card kicker="14 sections" title="Signature">
            Leads with visuals, amenities, neighbourhood and Golden Visa, then captures. Built for
            premium waterfront launches.
          </Card>
        </Grid>
        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <H3>Copy written for a chosen buyer</H3>
            <div className="mt-4 space-y-5">
              <P>
                Pick investor, luxury, end-user or generic, and the page is rewritten for that buyer:
                a different section order, a different headline, a different call to action, three
                paragraphs of description, and eight questions and answers specific to that project
                and that area. The project is read from the database, a per-section schema is
                enforced, and generation runs at temperature 0.7 with 8,192 output tokens inside a
                60-second limit. Restricted to admins.
              </P>
              <P>
                The instruction the model works under is not subtle:{' '}
                <span className="text-white">
                  every price, size, percentage and date must come from the project data verbatim; if
                  a number is not in the data, omit the field or omit the whole section &mdash; never
                  estimate a realistic-looking figure.
                </span>{' '}
                If the project holds no payment plan, that section is omitted entirely rather than
                described in general terms.
              </P>
              <P>
                With no key configured the route returns a plain unavailable response; if the model
                returns something unparseable or no sections at all, it fails. There is no path in
                which a failed generation quietly falls back to invented copy.
              </P>
            </div>
          </div>
          <div>
            <H3>The click can say who it is for</H3>
            <div className="mt-4 space-y-5">
              <P>
                An advertisement can carry the buyer type it targeted &mdash; investor, family,
                luxury, international and four more. The same page then leads with the sections that
                buyer cares about: returns first for an investor, amenities and the area first for a
                family. Every section the page has that is not on that list keeps its original
                relative order, and a listed type the page does not have is skipped.
              </P>
              <P>
                Nothing is added and nothing is hidden by intent. The alternative hero line only
                renders when every fact it cites is real on that listing &mdash; a price, an area, a
                yield, a genuine payment plan &mdash; and otherwise the page&rsquo;s own default line
                stays. No intent, or junk in the parameter, gives the exact default page.
              </P>
            </div>
          </div>
        </div>
      </Band>

      {/* ── The readiness gate ──────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The readiness gate"
          title="A campaign cannot point at a page that is not there"
          lede={
            <Lede>
              Before a campaign launches, the destination it will send people to is parsed and
              compared against that page&rsquo;s stored status and publish window. Four findings
              refuse the launch outright. Two let it through with a warning, because they describe
              choices somebody may be making deliberately.
            </Lede>
          }
        />
        <div className="mt-10 max-w-[68ch] space-y-5">
          <P>
            The reason this check exists is written into the module itself. Every paid click is an
            anonymous visitor. The impressions are real, the clicks are real and the invoice is real;
            the only symptom of a destination that returns a 404 is that no leads arrive &mdash; which
            reads exactly like a bad audience. A week can be spent rebuilding targeting to fix a
            broken link.
          </P>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="Six verdicts, four of which stop the launch"
            rows={[
              { k: 'No such page', v: <><span className="text-white">Blocked.</span> HTTP 400, naming the page: &ldquo;There is no landing page at /lp/&lt;slug&gt;. Every click on this campaign would land on a 404.&rdquo;</> },
              { k: 'Not published', v: <><span className="text-white">Blocked.</span> The page exists but is a draft, is pending publish approval, or is archived. None of those states serve the public.</> },
              { k: 'Window closed', v: <><span className="text-white">Blocked.</span> The page is published, but the end of its publish window has already passed, so it is dark to visitors now.</> },
              { k: 'No destination', v: <><span className="text-white">Blocked.</span> The campaign carries no destination URL at all.</> },
              { k: 'Closes soon', v: <><span className="text-white">Warning.</span> The publish window closes within seven days while the campaign would still be running. Seven was chosen over one because a warning the day before arrives after the week&rsquo;s budget is committed.</> },
              { k: 'Not one of ours', v: <><span className="text-white">Warning.</span> The destination is not a page on your domain &mdash; a developer&rsquo;s own microsite, for instance. A legitimate choice; it simply cannot be attributed back to the CRM.</> },
            ]}
          />
        </div>
        <div className="mt-12">
          <Guardrail
            title="How the gate behaves"
            items={[
              <>A host that merely contains your domain &mdash; <Mono>yourdomain.evil.com/lp/x</Mono> &mdash; is treated as not yours, so a slug is never read off a lookalike address and checked against the wrong page. A real subdomain is accepted.</>,
              <>The refusal names the page and says what would happen. It is a sentence an operations manager can act on, not an error code.</>,
              <>A landing page wired to ad campaigns cannot be deleted: HTTP 409, &ldquo;This landing page is wired to ad campaigns and cannot be deleted. Archive it instead.&rdquo; Deleting it would 404 live ad clicks and orphan the campaign history. The editor also requires the word delete to be typed first.</>,
              <>The check is pure &mdash; no network calls and no clock of its own &mdash; and runs in the automated suite on every change. The launch strip mirrors the same verdict, and a test asserts the two lists cannot drift apart.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Launch readiness strip ──────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Before the work, not after"
          title="Eight checks, shown on one line"
          lede={
            <Lede>
              The page state is one of eight things that decide whether a campaign can launch. All
              eight are shown at the top of the launcher as a single line naming the one thing
              standing in the way right now, with a link to the screen that fixes it.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What the strip checks"
            rows={[
              { k: 'Meta account', v: <>An advertising account is connected for this company.</> },
              { k: 'Facebook Page', v: <>A Page is selected, because Meta will not run the ad without one.</> },
              { k: 'Project', v: <>A listing is chosen and it is in Inventory.</> },
              { k: 'Trakheesi permit', v: <>A permit is on file for the listing. A missing expiry date warns rather than blocks: absence of evidence is not evidence of absence.</> },
              { k: 'Where the click lands', v: <>The landing verdict above, mirrored exactly.</> },
              { k: 'The advertisement', v: <>Creative and copy are chosen.</> },
              { k: 'Daily budget', v: <>Below AED 20 is blocked, because that is Meta&rsquo;s own minimum. Between AED 20 and AED 150 warns and is never blocked.</> },
              { k: 'Audience', v: <>A targeting definition exists.</> },
            ]}
          />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            Each row is in one of four states: satisfied, blocked, warning, or still to pick.
            Anything nobody has chosen yet reads &ldquo;still to pick&rdquo; and is never shown as an
            error &mdash; a page you have not reached is not a failure. Launch is refused while any
            row is blocked, and the headline names blocked rows first, then what is still to pick,
            then warnings.
          </P>
          <P>
            The three facts a browser cannot know for itself &mdash; whether Meta is connected, which
            Page is attached, whether the permit is valid, and the landing page&rsquo;s live state
            &mdash; are fetched read-only. Nothing in the readiness check writes to Meta and nothing
            in it costs money. The spend limits themselves are described in{' '}
            <TextLink href="/business/platform/advertising">Advertising</TextLink>.
          </P>
        </div>
        <Grid cols={3} className="mt-12 bg-white/[0.07]">
          <Card kicker="Budget" title="AED 20 blocks, AED 150 warns">
            AED 150 a day is the learning-phase floor, roughly fifty conversions a week. Spending
            under it is a decision somebody may be making on purpose, so it warns and lets you
            through. Spending under AED 20 is not a decision; Meta will not accept it.
          </Card>
          <Card kicker="Permit" title="Valid through the expiry date, Dubai time">
            A Trakheesi permit is treated as valid through the end of its expiry date in Dubai time,
            not midnight UTC. Reading it as UTC would stop a legally permitted campaign four hours
            early.
          </Card>
          <Card kicker="Live page test" title="Thirteen checks against the real page">
            Reachability, response time, HTTPS, title, meta description, mobile viewport, social
            preview image, WhatsApp link, lead capture, privacy policy link, hero imagery, and
            whether the Arabic and Russian translations actually worked. Fifteen-second fetch; under
            2,500 ms passes, under 5,000 ms warns, above that fails. No score is invented &mdash;
            every pass comes from the bytes the page returned, and the translation checks call the
            same routine the live page calls, so a failure means Arabic visitors really are seeing
            English.
          </Card>
        </Grid>
      </Section>

      {/* ── Publishing and addresses ────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Publishing"
          title="Draft, published, archived — and a window"
          lede={
            <Lede>
              A published page can carry a start date and an end date. Outside that window, or while
              it is a draft, the public address returns a 404 to everyone except signed-in staff, so
              an unfinished page cannot be shared by accident.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The title is withheld along with the page, so nothing leaks through metadata either. A
              member of staff previewing a draft sees an amber bar saying the page is not published,
              which means nobody mistakes a preview for the live article.
            </P>
            <P>
              If a listing has no page row at all, its address still resolves: the page builds itself
              live from the Inventory project of that slug &mdash; never from sample data &mdash; so
              a property has something at its address before anyone gets round to building one.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              When a project sells out, its page is not taken down. It stays live and shows a truthful
              sold-out badge, detected from live inventory. Unpublishing would 404 the campaign that
              is still running and give up the search ranking the page earned. The schema holds a
              column for unpublishing on sold-out; nothing reads it, and staying live is what ships.
            </P>
            <P>
              Landing pages and microsites carry no site navigation and are deliberately absent from
              the sitemap &mdash; they are advertising destinations, not pages you want a search
              engine ranking against your own catalogue. The internal system is disallowed to
              crawlers entirely.
            </P>
          </div>
        </div>
        <Grid cols={2} className="mt-12 bg-white/[0.07]">
          <Card kicker="/lp/<slug>" title="The landing page">
            The full advertising page described above: nineteen possible sections, three layouts,
            three languages, the permit strip, WhatsApp and call buttons, and the lead form.
          </Card>
          <Card kicker="/site/<slug>" title="Project microsite">
            A simpler one-page project site &mdash; hero, key facts, overview, up to six unit types
            with sizes and prices, a gallery of up to eight images, amenities, FAQs, and a link to the
            landing page when one exists. Prices come from real figures or read &ldquo;Price on
            request&rdquo;. One stated difference: unlike a landing page, a draft microsite is not
            hidden. It shows an amber draft bar to everyone who reaches it.
          </Card>
          <Card kicker="/l/<code>" title="Branded short links">
            Any long URL becomes a short on-brand link, with a click count. Codes are six characters
            from a 62-character alphabet, widened to seven after three collisions; custom codes are
            three to thirty-two characters. Only a genuine http(s) URL is accepted. An unknown code
            redirects to the site home rather than 404ing, because a link printed on an advertisement
            should never strand the person who typed it. Restricted to management and marketing.
          </Card>
          <Card kicker="QR" title="One code per page">
            For flyers, roadshow stands and open-house signs. The code is built against the canonical
            public address resolved on the server, not a value baked into the browser bundle, so it is
            correct regardless of how the site was built. Scans arrive tagged as QR traffic and an
            optional campaign label can be added, so those leads attribute correctly with no setup.
          </Card>
        </Grid>
      </Band>

      {/* ── Measurement ─────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Once it is live"
          title="How the page was read, attached to the lead it produced"
          lede={
            <Lede>
              A live page records what visitors do: page views, scroll depth, time on page, gallery
              opens, WhatsApp, call and brochure taps, which sections were opened, when the form was
              started and when it was submitted &mdash; along with where the visit came from.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="25/50/75/100%" label="Scroll milestones" note="Each recorded once per session." />
          <Stat value="15/45/120s" label="Time-on-page marks" note="Sent with keepalive, so late events survive the visitor leaving." />
          <Stat value="30 days" label="Visitor session" note="Held in the browser, so a return visit joins the same session." />
          <Stat value="32 hex" label="Stored address" note="The visitor IP is SHA-256 hashed and truncated. The raw address is never stored." />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            Campaign tags are first-touch and held for the session, because the language and theme
            switchers rebuild the address bar and a naive reader would lose the original source.
            Meta&rsquo;s placement value is lower-cased so that Feed and feed are counted as one
            surface. Where Meta, Google or TikTok pixels are configured they are injected, and the
            lead conversion shares one event identifier with the server-side event so the platform
            deduplicates instead of counting the same lead twice.
          </P>
          <P>
            Until the form is submitted the visitor is anonymous. Behaviour is recorded against a
            session identifier, a hashed address and the campaign tags &mdash; there is no name,
            phone number or email address in any of it, because none exists until somebody types one
            in. The field name was deliberately changed when the hashing was introduced, on the
            principle that a column name must not promise more privacy than the code delivers.
          </P>
        </div>
        <div className="mt-14">
          <SpecTable
            caption="Behaviour score — published fixed weights, summing to 100"
            rows={[
              { k: 'Reading depth', v: <>Up to 30, from how far down the page they actually got.</> },
              { k: 'Time invested', v: <>Up to 25 &mdash; 8 at fifteen seconds, 8 at forty-five, 9 at two minutes.</> },
              { k: 'Material engagement', v: <>Up to 25 &mdash; gallery 8, brochure 9, any section opened 8.</> },
              { k: 'Action signals', v: <>Up to 20 &mdash; a WhatsApp or call tap 10, starting the form 10.</> },
              { k: 'Buyer type', v: <>Derived from which sections were opened. Payment plan, ROI or price, or the brochure, reads as financial; gallery, amenities or location reads as lifestyle; both together reads as investor and end user.</> },
              { k: 'Purchase probability', v: <>Behaviour score &times; 0.6, plus 15 for a direct-contact tap, 10 for starting the form, 10 for financial engagement &mdash; then floored at 5 and capped at 90.</> },
              { k: 'Events read', v: <>At most 200 per session.</> },
            ]}
          />
        </div>
        <div className="mt-12">
          <Guardrail
            title="What the score will not do"
            items={[
              <>Guess. A lead with no linked page session gets nulls, not defaults. No number is better than a made-up one when a manager is deciding who to call first.</>,
              <>Block a lead. Scoring is fail-soft: any failure returns nulls and the lead is still captured.</>,
              <>Overwrite itself. A lead&rsquo;s first behaviour score and first declared advertising intent are never replaced by a later visit; a repeat enquiry can only fill fields that are still empty.</>,
              <>Read as certainty. Purchase probability is floored at 5 and capped at 90 in both directions, and it is a documented fixed-weight heuristic &mdash; not a model trained on outcomes. There is not yet enough closed-deal volume to calibrate one, and the code forbids describing it as though there were.</>,
            ]}
          />
        </div>
      </Section>

      {/* ── Edits and approvals ─────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Edits and approvals"
          title="An agent proposes, a manager decides"
          lede={
            <Lede>
              A landing page is an advertising destination with a permit number on it and budget
              pointed at it. An agent who spots a wrong handover date should be able to fix it in a
              minute. Nobody should be able to change what a paid campaign points at without the
              person who owns that budget seeing it first.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The broker edits and sends a proposal',
                body: (
                  <>
                    Brokers cannot change a live page at all, and that rule is applied on the server,
                    not by hiding a button. They open the editor, make their changes, add a note and
                    send it. One open request exists per broker per page; re-editing a submitted
                    request pulls it back to draft rather than creating a second one.
                  </>
                ),
              },
              {
                title: 'The approver previews it on the real page',
                body: (
                  <>
                    The proposal is rendered on the actual page exactly as it would publish, rather
                    than as a list of field changes to imagine. The preview is gated to staff: it only
                    overlays the proposal for a viewer holding a valid session.
                  </>
                ),
              },
              {
                title: 'Approval claims first, then writes',
                body: (
                  <>
                    The request flips from pending to approved atomically before the live page is
                    touched, so a concurrent pull-back or a second approver matches zero rows and the
                    live page is never changed without a recorded approval. If the write to the live
                    page then fails, the claim is rolled back to pending.
                  </>
                ),
                detail: (
                  <>
                    A proposal carrying only field changes never overwrites the section layout, so
                    approving an older proposal cannot revert somebody else&rsquo;s layout edits to a
                    stale snapshot. The claimed snapshot is applied exactly as it was reviewed, not
                    re-read at the moment of approval.
                  </>
                ),
              },
              {
                title: 'Publishing follows the same shape',
                body: (
                  <>
                    Someone who is not authorised to publish can still do all the work and press
                    Publish. The page becomes pending publish, stamped with who asked and when, and
                    the response says it was sent for approval. Pending publish is not a state that
                    serves the public, so the address keeps returning 404 until a manager releases it.
                  </>
                ),
              },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            Copy can also be changed by typing an instruction &mdash; &ldquo;make the headline more
            urgent and move the payment plan up&rdquo; &mdash; or by clicking the headline on the live
            preview and typing over it. The on-canvas edit still saves through the authenticated
            editor API; the preview is a view, not a second door.
          </P>
          <P>
            What the assistant is allowed to touch is a short, closed list, so the worst outcome of a
            bad instruction is wording you disagree with rather than a page that no longer renders.
          </P>
        </div>
        <div className="mt-12">
          <Guardrail
            title="Limits on the editing assistant"
            items={[
              <>Exactly five fields may change: headline, subheadline, call-to-action text, SEO title, SEO description. Anything else the model returns is dropped.</>,
              <>A requested layout change is checked type by type against the page&rsquo;s real sections. A section type the model invented is discarded, so it cannot break the page.</>,
              <>SEO title is capped at 60 characters and the description at 160 &mdash; stated in the instruction, not left to taste.</>,
              <>With no key configured it answers that it is unavailable, rather than producing something that reads like an answer.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Content workspace ───────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Content engine"
          title="Topics, articles and guides — and what they do not do yet"
          lede={
            <Lede>
              Alongside advertising pages there is a content workspace: ask for a fresh blog topic,
              have a 400 to 600 word article drafted for it, mark it published. It also holds area
              guides, developer profiles and page copy. Reading requires a session; writing or
              publishing is restricted to management and marketing roles, not every signed-in user.
            </Lede>
          }
        />
        <div className="mt-12">
          <Guardrail
            title="Stated limit"
            items={[
              <>No public page reads this store today. The public blog reads a different source, and the developer directory was deliberately rewired away from this table after a row was created, the confirmation appeared, and the public directory still listed nothing.</>,
              <>So an article marked published here is stored and visible to your team, and does not appear on the public website. That is the current state, and it is written here rather than discovered later.</>,
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            Separately, the words on the public marketing pages &mdash; the home hero, the about
            introduction, services, contact address, opening hours, the RERA number &mdash; can be
            changed without a code release. What is editable is a closed registry: the editor renders
            from it, the API validates against it, and an automated check walks it, so a mistyped key
            cannot store content that nothing will ever display.
          </P>
          <P>
            Every one of those fields falls back to the words built into the page. An empty table, a
            missing row or a blank field renders the site exactly as it was built, so the public site
            cannot go blank because a database is empty. Locale is stored even though the public site
            renders English only today, so translations are not lost the day it learns languages.
          </P>
        </div>
      </Section>

      {/* ── Onward ──────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Onward"
          title="Where a page shows up in the rest of the system"
          lede={
            <Lede>
              A landing page is not a deliverable on its own. It is the middle of a chain that starts
              at a listing and ends at a deal with a reason attached, and it is scored, joined and
              reported on in that context.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="The joins"
            rows={[
              { k: 'Ad-readiness score', v: <>Every listing carries 0&ndash;100. Ad readiness is data quality &times; 0.7, plus 20 for having a landing page, plus 10 for having images, capped at 100. Data quality is market score &times; 0.5, plus 20 for images, 10 for a payment plan, 15 for a starting price, 5 for named unit types, capped at 100. Having a page is worth 20 points of it.</> },
              { k: 'What to advertise next', v: <>Ad readiness carries a weight of 0.15 in the opportunity ranking, for the stated reason that spend on an unready listing is wasted. The ranking also reads real thirty-day page-view momentum from the landing analytics.</> },
              { k: 'Attribution', v: <>A lead is matched to its page by the landing slug it arrived with, or by the page prefix on its source field. A lead in CRM can therefore show which page produced it, and a page can be asked for its own leads.</> },
              { k: 'Lead quality', v: <>The behaviour score, buyer type, purchase probability and whether they engaged with the money sections travel with the lead into CRM, so the first call is informed by how the page was actually read.</> },
              { k: 'The dashboard', v: <>One list of every page: status, whether it is live right now, its schedule, leads produced, page views and form submissions. 100 rows by default, clamped between 1 and 500.</> },
              { k: 'Dead links', v: <>In Inventory, the public address is shown as a link only when the page is genuinely published. A draft renders as a badge that cannot be clicked, so a dead address is never copied into an advertisement.</> },
            ]}
          />
        </div>
        <div className="mt-14">
          <Callout>
            A landing page nobody can reach is indistinguishable, in every report you will read that
            week, from an audience that did not want the property.
          </Callout>
        </div>
      </Band>

      <NextPages
        items={[
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'The launch gate in the place it applies, and the limits on what can spend.' },
          { href: '/business/platform/inventory', label: 'Inventory', blurb: 'The listing behind every page, and the score that says whether it is fit to advertise.' },
          { href: '/business/platform/crm', label: 'CRM', blurb: 'Where the lead lands, what it carries with it, and who owns the first hour.' },
        ]}
      />
    </>
  )
}
