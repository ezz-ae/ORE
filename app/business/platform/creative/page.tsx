import type { Metadata } from 'next'
import {
  Section, Band, Lede, P, Mono, PageHeader, SectionHeading,
  Card, Grid, SpecTable, Guardrail, Steps, Stat, Callout, NextPages, TextLink,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Creative',
  description:
    'How Entrestate draws the ad files you run — every placement size, video and GIF, and brochure exports — from the listing you already hold, and what it refuses to print.',
  alternates: { canonical: '/business/platform/creative' },
}

export default function CreativePage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · Creative"
        title="The ad file itself, drawn from your own listing"
        lede={
          <>
            This is the part of the system that makes the pictures and videos you run as ads. One
            canvas engine draws every design at true ad resolution, so the file you download is the
            file Meta receives — there is no mock-up stage and no re-render later. The engine writes
            the wording. Every figure printed on a design comes from the project row or from
            something you typed.
          </>
        }
        meta={[
          { k: 'Placements', v: '1080×1350 · 1080×1080 · 1080×1920' },
          { k: 'Layouts', v: '8' },
          { k: 'Palettes', v: '8' },
          { k: 'Starting templates', v: '45' },
          { k: 'Ad languages', v: 'English, العربية, Русский' },
          { k: 'Video out', v: 'MP4 first, GIF for the rest' },
        ]}
      />

      {/* ── Where a design comes from ───────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The starting point"
          title="A design is made from a listing, and a listing can be made from a PDF"
          lede={
            <Lede>
              Nothing here begins with a blank canvas. A design begins with a project row — its
              price, its payment plan, its handover date, its photographs. If the project only
              exists as a developer&rsquo;s brochure, the brochure becomes the row first.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The brochure is read',
                body: (
                  <>
                    Drop in the PDF. The text layer is pulled out first because it is fast; a
                    designed brochure carrying under 200 characters of text falls through to a
                    vision model reading the pages as images, which is why the ones that are
                    entirely artwork still read. Files of <Mono>4.3 MB</Mono> or less post
                    directly; up to <Mono>30 MB</Mono> upload from the browser to storage and are
                    referenced by URL, because the hosting platform rejects request bodies over
                    about <Mono>4.5 MB</Mono>. Image-only PDFs above <Mono>14 MB</Mono> go through
                    a file API rather than being inlined.
                  </>
                ),
                detail: (
                  <>
                    One extraction contract serves both paths — the PDF and a pasted link or block
                    of text — returning name, slug, area, developer, price from, price to, ROI,
                    payment plan, handover date, description, highlights and amenities. The
                    instruction it runs under is explicit: if a field is not found, return null or
                    empty. It does not fill gaps.
                  </>
                ),
              },
              {
                title: 'It becomes a listing and a landing page',
                body: (
                  <>
                    The project is written into your inventory and its landing page is created from
                    the same facts. Brochure imports are namespaced with a <Mono>freehold-</Mono>
                    {' '}slug prefix so an import can never overwrite a curated inventory row that
                    shares its name.
                  </>
                ),
                detail: (
                  <>
                    If the project is created and the landing page is not, the result says so — a
                    partial success, reported as partial. Nobody re-runs a flow that already half
                    worked and ends up with two projects.
                  </>
                ),
              },
              {
                title: 'The listing fills the ad',
                body: (
                  <>
                    Picking a project in the ad studio prefills the top line, headline, price and
                    footnote. It only ever replaces values the system itself put there — every
                    field remembers whether it was auto-filled or typed, and anything you typed is
                    left alone.
                  </>
                ),
              },
              {
                title: 'The designs go into the ad set that already works',
                body: (
                  <>
                    Chosen designs are written into an existing ad set as new ads. The write reads
                    that ad set&rsquo;s own best-performing ad and changes exactly one thing: the
                    picture. Destination, lead form, phone number, landing URL, call-to-action and
                    caption are inherited. A blank caption field never overwrites the working
                    ad&rsquo;s words.
                  </>
                ),
                detail: (
                  <>
                    New ads arrive paused unless you deliberately tick to switch them on. One press
                    creates at most 6 ads, and each design&rsquo;s outcome is reported
                    individually, so one picture Meta rejects does not lose the ads that went
                    through.
                  </>
                ),
              },
            ]}
          />
        </div>
      </Band>

      {/* ── The full set ────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="One action, the whole set"
          title="Design once, get every shape Meta will run"
          lede={
            <Lede>
              The three placement shapes are not crops of one another. The picked design keeps its
              exact pixels and the other two are composed fresh from the same source photograph, so
              a story is laid out as a story rather than a feed ad with its head cut off.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What the engine produces"
            rows={[
              { k: 'Feed', v: <><Mono>1080×1350</Mono> — 4:5.</> },
              { k: 'Square', v: <><Mono>1080×1080</Mono> — 1:1.</> },
              { k: 'Story', v: <><Mono>1080×1920</Mono> — 9:16.</> },
              {
                k: 'Layouts',
                v: (
                  <>
                    8. Five general — <Mono>heroPrice</Mono>, <Mono>frame</Mono>,{' '}
                    <Mono>statFooter</Mono>, <Mono>splitCard</Mono>, <Mono>badge</Mono> — plus a
                    payment-plan family, <Mono>payBands</Mono>, <Mono>payBadge</Mono>,{' '}
                    <Mono>payReturn</Mono>, modelled on ads running in this market, where the
                    finance hook is read first and the total price is the largest thing on the page.
                  </>
                ),
              },
              {
                k: 'Palettes',
                v: <>8 — five classic, three high-contrast ones taken from payment-plan ads running in Dubai.</>,
              },
              {
                k: 'Generation defaults',
                v: (
                  <>
                    All 8 layouts and 3 of the 8 palettes. Composing 25 full-resolution canvases at
                    once froze mid-range phones, so the default is a set that finishes. Each render
                    yields to the browser between canvases.
                  </>
                ),
              },
              {
                k: 'Text direction',
                v: <>Detected from the headline. An Arabic headline flips the whole layout right-to-left; no separate template.</>,
              },
              {
                k: 'On-image copy limits',
                v: (
                  <>
                    Top line 40 characters, headline 60, footnote 48. On payment-plan designs:
                    finance hook 70, headline 80, total label 20, down-payment label 20, terms 70.
                  </>
                ),
              },
              {
                k: 'Overflow',
                v: (
                  <>
                    Every single-line field shrinks to fit and then ellipsises. Before you generate,
                    a warning names which layout-and-format combinations will cut your headline —
                    measured by the renderer itself, not estimated from a character count.
                  </>
                ),
              },
              {
                k: 'Permit QR',
                v: (
                  <>
                    Four corner positions, size from 8% to 20% of image width, 12% by default, on a
                    white rounded backing so it scans. Stamped onto all three placements, because
                    the permit is compliance and not a design choice.
                  </>
                ),
              },
              {
                k: 'Download',
                v: (
                  <>
                    One ZIP with the caption inside as a <Mono>.txt</Mono>. Not three download
                    prompts: Chrome asks whether you meant to download multiple files and Safari
                    kept only the first, so brokers were quietly leaving with one size out of three.
                  </>
                ),
              },
              {
                k: 'Shapes offered',
                v: (
                  <>
                    Only those the target ad set can actually run, read from its real placement
                    settings. An ad set with no vertical surface is never offered 9:16, and the
                    studio names which surfaces will crop the shape you picked before you press.
                  </>
                ),
              },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="8" label="Layouts shipped" note="Five general, three built for terms-led Dubai ads." />
          <Stat value="3" label="Placement sizes" note="Composed from one design, saved and zipped together." />
          <Stat value="45" label="Starting templates" note="15 recipes across three ad languages, each rendered live." />
          <Stat value="0" label="Figures written by the model" note="Prices, dates, yields and sizes come from the row or from you." />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            The template gallery is 15 recipes — a layout, a palette, a format and a buyer situation
            — offered in English, Arabic and Russian, which is 45 starting points. The thumbnails are
            not screenshots. Each one is composed live by the same engine that makes the real ad,
            using your own inventory photographs when you have them. Sample wording is stored against
            the ad&rsquo;s language rather than the interface&rsquo;s, so an agent working in an
            English dashboard can preview and build an Arabic ad.
          </P>
          <P>
            The six buyer situations are launch, monthly payment, ready to move, open house, family
            and income. Clicking one opens the studio with its format, layout, palette, wording and
            language already selected. The same engine draws the gallery thumbnails, the studio
            output, the reel frames and the ads pushed into a live ad set — which is why one project
            looks like one campaign rather than a folder of unrelated files.
          </P>
        </div>
      </Section>

      {/* ── The words ───────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="The words on the picture"
          title="It writes the wording. It does not write the numbers."
          lede={
            <Lede>
              You describe the ad in your own words and it returns the top line, headline and
              footnote that sit on the design, in whichever of the three languages you are working
              in. What it is handed is only what the application already knows: the project, the
              area, the price you typed, the payment plan.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            There are two writers, deliberately kept apart. The lifestyle and price writer is
            forbidden from using payment ratios such as &ldquo;60/40&rdquo;, because on that kind of
            ad it reads as desk jargon. The payment-plan writer requires them, because on a
            terms-led ad the ratio is the offer. Splitting them was cheaper than one prompt trying
            to be both.
          </P>
          <P>
            The price field is not something the writer is trusted to leave alone — it is a field it
            is instructed never to return at all. Your price is untouchable by construction rather
            than by good behaviour. Results arrive with an Undo in the confirmation, and every field
            is trimmed on a word boundary to its limit rather than mid-word.
          </P>
        </div>
        <div className="mt-12">
          <Guardrail
            title="What the writer is not allowed to do"
            items={[
              <>Invent a number, price, date, yield, size or amenity. It is handed the facts the application holds and instructed to write about those and nothing else.</>,
              <>Return a price at all, on lifestyle and price-led designs. The figure on the design is the one you typed, because there is no path by which the model could replace it.</>,
              <>Treat your brief as an instruction. It is appended below the rules inside quote fences and labelled as data describing what you want — never as instructions, whatever it says — and hard-truncated at 400 characters so an open text box cannot become an open prompt.</>,
              <>Add hashtags or emoji to text that is going to be drawn onto an image.</>,
              <>Overwrite something you typed. Listing prefill, brochure extraction and the writer all replace only values the application itself put there.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Video ───────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Motion"
          title="Listing photographs become a real video file"
          lede={
            <Lede>
              A slow push across each photograph, cross-fades between them, an opening title card and
              a closing offer card, in the same palette and type as your static ads. The preview is
              the export: frames are drawn on a canvas and recorded as they play, so what you watched
              is what was captured.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="Reel, autopilot, GIF and the editor"
            rows={[
              {
                k: 'Reel defaults',
                v: (
                  <>
                    30fps, 3 seconds per photograph (2, 3 or 4 selectable), a 2-second title card, a
                    2.5-second closing card and a 0.6-second cross-fade. The camera push can be
                    switched off. Any of the three ad formats.
                  </>
                ),
              },
              {
                k: 'Container',
                v: (
                  <>
                    MP4 (H.264 baseline) is attempted first and WebM only as a fallback. Meta accepts
                    MP4, MOV and GIF for ad creative and not WebM, and Safari cannot record WebM at
                    all — which previously made export impossible on every Mac and iPhone.
                  </>
                ),
              },
              {
                k: 'Automatic video ad',
                v: (
                  <>
                    From a project page, one button scripts the on-screen text from that
                    project&rsquo;s real facts, generates two shots of it, assembles the reel and
                    plays it. Each tick on the progress card is a completed call, not a timer.
                    Failures degrade: a failed script leaves the listing&rsquo;s own defaults, a
                    failed image leaves the ones that worked. It stops entirely only when zero frames
                    generated and the project has no photograph.
                  </>
                ),
              },
              {
                k: 'GIF caps',
                v: (
                  <>
                    480px longest edge, 8fps, 32 frames maximum — about 4 seconds of reel. It never
                    upscales. The estimated file size, dimensions and covered duration are shown on
                    the button before you start, and when it has to shorten the reel it says
                    &ldquo;first N seconds&rdquo; both before and after rather than quietly dropping
                    half of it.
                  </>
                ),
              },
              {
                k: 'Editing',
                v: (
                  <>
                    Trim, caption, closing call-to-action card and cover frame are stored as a recipe
                    on the library row and applied live by the player. The source file is never
                    re-encoded. Standard keys — space, I and O for in and out, J and L for a second,
                    arrows for a frame at 0.04s — and they are suppressed while you are typing, so an
                    I in a caption types an I instead of destroying the trim.
                  </>
                ),
              },
              {
                k: 'Compression',
                v: (
                  <>
                    Offered above 150 MB, targeting 1080 on the long edge at 2,500,000 bits per
                    second, done in the browser. The screen states two things up front: it runs in
                    real time, so a four-minute clip takes about four minutes, and audio is dropped.
                  </>
                ),
              },
              {
                k: 'Size limits',
                v: (
                  <>
                    Library upload caps at 2 GB, switching to multipart above 50 MB. A video going to
                    a Meta ad is capped server-side at 200,000,000 bytes.
                  </>
                ),
              },
              {
                k: 'Transcode wait',
                v: (
                  <>
                    79.5 seconds across 10 polls (1.5s, 2, 3, 4, 5, 7, 10, 12, 15, 20). A video ad is
                    only built once Meta reports the upload ready and a cover frame exists.
                  </>
                ),
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Documents ───────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Documents"
          title={<>A developer&rsquo;s brochure, made yours</>}
          lede={
            <Lede>
              The same brochure that filled the listing can be re-issued under your own name. Page
              operations are real structural edits to the document, not an image of it, with a live
              preview of the edited file.
            </Lede>
          }
        />
        <Grid cols={3} className="mt-12 bg-white/[0.07]">
          <Card kicker="Rebrand" title="Cover, logo, footer">
            The developer&rsquo;s contact band is covered, your logo and footer are placed, and
            pages are rotated, deleted, reordered or merged as structural edits to the PDF itself.
          </Card>
          <Card kicker="Stamp" title="Permit QR and number">
            The advertising permit QR and its number can be stamped on the first page, the last page
            or every page, drawn over a white backing so it stays scannable against artwork.
          </Card>
          <Card kicker="Reorganise" title="A client-ready version">
            A long developer document can be reorganised into a clean branded PDF, in English or
            Russian, and saved back to your library alongside everything else you have made.
          </Card>
          <Card kicker="Offer" title="A one-page draft offer">
            Built from the project&rsquo;s real figures, watermarked DRAFT, and carrying
            &ldquo;INDICATIVE — NOT A BINDING OFFER&rdquo; in the header band. It is a document for
            a conversation, and it says so on its face.
          </Card>
          <Card kicker="Presenters" title="One saved face per persona">
            Three on-camera personas ship — a luxury consultant, an investment advisor and a
            community specialist. Each has one face generated and saved for the whole company, and
            every later creative reuses it, so it is the same person every time rather than a new
            stranger per ad.
          </Card>
          <Card kicker="Storage" title="Everything lands together">
            Whatever tool made it — studio, reel, editor, PDF tools, generation — the file goes into
            the same library, which is also the pool the campaign side draws from.
          </Card>
        </Grid>
      </Band>

      {/* ── The pool ────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="What a campaign could run"
          title="Everything available to this campaign, deduplicated and counted honestly"
          lede={
            <Lede>
              One panel gathers the campaign&rsquo;s own kit, the project&rsquo;s photographs and
              brochure, your whole library, and the images already running on its live ads — then
              tells you how many genuinely new pieces you could add today.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              One tile per picture. Deduplication strips query strings and protocol before comparing,
              because those are cache-busters and expiring signed-URL parameters rather than
              different photographs. Where the same file arrives from two places the more specific
              source wins the tile, and the facts are merged, so a flag saying an image is already
              running can never be lost in the merge.
            </P>
            <P>
              &ldquo;Unused&rdquo; means unused. Images already live in the campaign are shown and
              marked, sorted last, and never counted as new material. An ad set wants between 3 and 6
              ads in rotation; the panel shows at most 60 tiles, and one press creates at most 6 ads.
              The readiness count in the header and the count in the recommendation are the same
              number, so the two can never disagree with each other on screen.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              What can become an ad is a property of the file rather than a guess. Images and videos
              launch. A brochure PDF routes to the ad studio instead of offering a button that would
              fail — a PDF is not a creative in any ad system; it is where a design&rsquo;s numbers
              come from.
            </P>
            <P>
              There is also the option to compose rather than push. Instead of running a bare
              photograph, each chosen picture is drawn into a finished ad — headline band, price
              block, terms — from that project&rsquo;s own price, payment plan and handover year,
              with a different layout and palette per design so three of them are a set rather than
              three copies. The layout is chosen by what the row can support: price and plan earns
              the terms-led family, price alone earns the price-led family, neither earns the
              name-led family. It is off by default, and disabled outright when the campaign has no
              project behind it. A design with no facts to print is a filter, not an ad.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Which design won ────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Evidence"
          title="Which design won, and whether there was a race at all"
          lede={
            <Lede>
              Meta reports what an ad did. It never reports what an ad was. So the design decision
              behind every ad — its layout, its argument and its palette — is written down at the
              moment the ad is created, which is the only point at which it is known for certain.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              That record is written, never inferred. An ad with no recorded recipe is left out of
              the ranking rather than reverse-engineered from its JPEG, because a wrong guess teaches
              the opposite of the truth. Recording is deliberately silent and best-effort: an ad that
              reached Meta is a real ad spending real money, and a lost note is a lost lesson, not a
              lost ad. Ads launched before this record existed are simply absent from the history
              rather than back-filled.
            </P>
            <P>
              A recipe needs 2,000 impressions before it can be called proven or poor, and the
              analysis reads at most the 300 most recent recipes per project.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              A design becomes a contender only once it has spent at least what one lead costs on
              that campaign — calculated across the designs that have actually produced a lead, not
              from the leader&rsquo;s own cost per lead. Below that line it is labelled{' '}
              <span className="text-white">Too early</span> with the exact amount it still needs. It
              is never labelled losing.
            </P>
            <P>
              A winner needs at least 2 contenders. A single design that received real budget while
              the others got pocket change gets no badge, because there was no comparison. The rule
              exists because of a live case: a design given AED 26 on a campaign where a lead cost
              AED 106 was shown as beaten when it had never really run — and every row in that panel
              carries a Pause button, so the badge was an invitation to switch off two designs on the
              strength of a race that never happened.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="Before anything is declared"
            rows={[
              { k: 'Minimum spend to be judged', v: <>One campaign lead price. Below it, the row reads Too early with the shortfall in AED.</> },
              { k: 'Minimum contenders', v: <>2. One funded design and two starved ones is not a race.</> },
              { k: 'Minimum impressions', v: <>2,000 before a recipe can be called proven or poor.</> },
              { k: 'History depth', v: <>The 300 most recent recorded recipes per project.</> },
              { k: 'Unrecorded ads', v: <>Excluded from ranking. Never guessed at from the rendered image.</> },
            ]}
          />
        </div>
      </Band>

      {/* ── Fatigue ─────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Fatigue"
          title="It tells you the creative is worn out. It does not swap it."
          lede={
            <Lede>
              When the average person has seen an ad three times, further spend is largely buying
              repeat impressions of the same picture. At a frequency of 3.0 the system says so, in
              the activity log, with its reasoning and the argument it would use next.
            </Lede>
          }
        />
        <div className="mt-12">
          <Grid cols={3} className="bg-white/[0.07]">
            <Card kicker="The honest condition" title="Zero leads is not fatigue">
              Four conditions are checked, and the third is the one that matters: a worn-out ad that
              has produced no leads is not worn out — it never worked. A second angle against the
              same audience would spend more money on the same wrong thing, so none is proposed.
            </Card>
            <Card kicker="A different argument" title="Not a rewording">
              The next angle is picked from an opposition table — investor against lifestyle, yield
              against end-user, urgency against golden visa — so the second creative argues something
              different rather than saying the same thing in new words. When every angle has been
              tried, it returns nothing instead of recycling.
            </Card>
            <Card kicker="Where it stops" title="Two arms per project">
              Creative arms are capped at 2 per project, counted from the campaigns themselves rather
              than from a stored counter that could drift away from reality.
            </Card>
          </Grid>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            The limit is worth stating plainly, because it is a limit and not a feature. Today the
            engine records the decision and the chosen angle in the activity log and tells the
            operator to refresh the creative. No code path launches the sibling campaign. The design
            of that sibling — same targeting, same budget scale, only the argument moves, the winner
            left untouched — exists in the module and is not executed.
          </P>
          <P>
            The reason a person decides is the same reason new ads arrive paused. Switching creative
            inside an ad set that is mid-learning is a spending decision, and it stays with whoever
            owns the budget. Stopping waste is reversible in a click; starting a new bid is not. The
            same division runs through the{' '}
            <TextLink href="/business/platform/advertising">advertising rules</TextLink>.
          </P>
        </div>
      </Section>

      {/* ── Refusals ────────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Fixed behaviour"
          title="What it refuses to make"
          lede={
            <Lede>
              These are not preferences in a settings screen. They are conditions in the code, and
              each one exists because the alternative was worse in a specific, observed way.
            </Lede>
          }
        />
        <div className="mt-12">
          <Guardrail
            title="It will not"
            items={[
              <><span className="text-white">Print a figure it was not given.</span> Prices, dates, yields, sizes and amenities come from the project row or from your own typing. The model writes wording.</>,
              <><span className="text-white">Render a payment-plan design with a gap in it.</span> Those layouts stay unselectable until the headline, finance hook, total price and down-payment percentage are present — plus the return figure on the returns layout — and the tooltip names exactly what is missing. An ad with a blank where the price belongs looks finished, which is precisely why it goes out to a paying audience.</>,
              <><span className="text-white">Let a project make a claim its own row cannot support.</span> No price, no price-led layout. No yield figure, no yield argument. No handover date, no urgency argument. Each withheld item shows the exact fact that is missing.</>,
              <><span className="text-white">Infer golden-visa eligibility from a price threshold.</span> The inventory has no eligibility column, so that argument stays withheld rather than being deduced from how expensive something is.</>,
              <><span className="text-white">Invent media.</span> Every tile in the pool is a file that already exists in your account. The generative half composes a design over a real photograph; it does not produce a photograph of a building that was never built.</>,
              <><span className="text-white">Launch a brochure as an ad.</span> A PDF is permanently excluded from launchable items and routed to the ad studio instead.</>,
              <><span className="text-white">Re-run an image that is already live.</span> It is shown and marked, but cannot be selected — adding it again would create a duplicate ad and make the frequency problem worse than the thing it was meant to fix.</>,
              <><span className="text-white">Switch new ads on by itself.</span> They are created paused unless you explicitly choose otherwise.</>,
              <><span className="text-white">Add ads to an ad set it cannot read a destination from.</span> If the ad set has no existing ad, or its ads use per-placement creative, it refuses with a plain explanation instead of guessing — guessing a destination is how a lead-form campaign quietly becomes a link-click campaign.</>,
              <><span className="text-white">Build a video ad while Meta is still processing the file.</span> It waits for a ready status and a cover frame; an unknown or missing status is read as still processing, never as ready. Without a cover frame the ad renders as a black rectangle.</>,
              <><span className="text-white">Offer a shape the target ad set cannot run.</span> Where nothing this studio designs for is bought by that ad set, it returns an empty list as a real answer rather than defaulting to a shape that fits nothing.</>,
              <><span className="text-white">Encode a bare permit number into a QR.</span> A recognised permit reference — 4 to 40 alphanumeric characters with dashes or slashes — is converted to the official validator URL first, because a QR holding the string 12345 scans to nothing. Anything else is encoded exactly as you typed it, since pasting your own link is a deliberate different action. Permit references are never fabricated.</>,
              <><span className="text-white">Crown a winner without a race.</span> One lead&rsquo;s worth of spend and at least 2 contenders, or the row says Too early with the shortfall.</>,
              <><span className="text-white">Guess what an ad was made of.</span> Recipes are written at creation. Unrecorded ads are excluded from the ranking rather than reverse-engineered.</>,
              <><span className="text-white">Hide a truncation, a shortening or a partial failure.</span> Overflowing text ellipsises visibly and is warned about beforehand; a GIF that could not cover the whole reel says which seconds it covered; a placement set that saved two of three formats says so; compression states in advance that it runs in real time and drops audio.</>,
              <><span className="text-white">Fake a result when generation fails.</span> When every image provider fails, the collected diagnosis from each attempt is returned with the specific fix, rather than a bare failure or a placeholder image.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Callout ─────────────────────────────────────────────────────── */}
      <Section className="py-16 lg:py-24">
        <Callout>
          Every word on these designs is written by a machine. Every number on them is written by
          you.
        </Callout>
      </Section>

      <NextPages
        items={[
          {
            href: '/business/platform/advertising',
            label: 'Advertising',
            blurb: 'Where these designs go, and the limits on what may spend money.',
          },
          {
            href: '/business/platform/landing-pages',
            label: 'Landing pages',
            blurb: 'The page the ad points at, and the gate that blocks weak ones.',
          },
          {
            href: '/business/platform/inventory',
            label: 'Inventory',
            blurb: 'The project rows every design is printed from.',
          },
        ]}
      />
    </>
  )
}
