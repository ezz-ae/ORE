import type { Metadata } from 'next'
import {
  Section, Band, Eyebrow, H3, Lede, P, Mono, PageHeader, SectionHeading,
  Card, Grid, SpecTable, Guardrail, Steps, Stat, Callout, NextPages, TextLink,
} from '@/components/business/ui'
import { SpendAuthority } from '@/components/business/diagrams'

export const metadata: Metadata = {
  title: 'Advertising',
  description:
    'How Entrestate builds and runs campaigns inside your own Meta and Google Ads accounts: what it creates, how a lead comes back attributed, which thresholds govern spend, and the launches it refuses outright.',
  alternates: { canonical: '/business/platform/advertising' },
}

export default function AdvertisingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform · Advertising"
        title="Your ad accounts, run to written limits"
        lede={
          <>
            Entrestate builds campaigns, audiences, lead forms and keyword plans inside the Meta and
            Google Ads accounts your company already owns. The useful part of what follows is not the
            list of things it makes. It is the list of things it refuses to make, and the number
            attached to each refusal.
          </>
        }
        meta={[
          { k: 'Channels', v: 'Meta (Facebook, Instagram) · Google Search' },
          { k: 'Runs unattended', v: 'Audience trials, budget rotation, negative keywords' },
          { k: 'Always a person', v: 'New keywords, creative swaps, placement changes' },
          { k: 'Hard floors', v: 'AED 50 daily budget · AED 30 cost cap' },
        ]}
      />

      {/* ── Starting position ───────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Starting position"
          title="You connect your own accounts. The invoice stays yours."
          lede={
            <Lede>
              There is no Entrestate ad account and no reseller margin. Campaigns are created inside
              your Meta Business account and your Google Ads account, billed by Meta and Google to
              your card. If you stop using this product tomorrow, every campaign, audience and lead
              form built here stays exactly where it is.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Meta connects through a token that is validated against the Graph API before it is
              stored, so a green &ldquo;Connected&rdquo; state means the token is live rather than
              merely typed. Google Ads credentials resolve environment-first —{' '}
              <Mono>GOOGLE_ADS_DEVELOPER_TOKEN</Mono>, <Mono>CLIENT_ID</Mono>,{' '}
              <Mono>CLIENT_SECRET</Mono>, <Mono>REFRESH_TOKEN</Mono>, <Mono>CUSTOMER_ID</Mono> —
              falling back to an in-app connection only when the environment is incomplete. The
              environment always wins, so an operations team can hold production keys outside the
              product entirely.
            </P>
            <P>
              Until an account is connected, nothing is invented. The Meta campaign list is empty
              rather than seeded with demo campaigns. The ad preview returns no iframe rather than a
              fabricated one. Google returns an all-zero report flagged as such. The old demo
              campaign, keyword and report arrays were deleted from the codebase, not hidden behind
              a flag.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              You can build an entire Google campaign before connecting anything. It is written
              locally with an id prefixed <Mono>local-</Mono>, and any id starting{' '}
              <Mono>local-</Mono> is always read and updated from the local table even after Google
              Ads is connected. A draft stays a draft; it cannot quietly become a live bid later.
            </P>
            <P>
              Internally the product meters ad budget in credits at a fixed rate of 1 credit to AED
              10 of funded daily spend, identical on both channels. The reservation is an atomic
              row-locked debit taken <em>before</em> the campaign is created. If the launch is
              refused, held, or falls back to a local draft that never serves, it is released. If
              that refund write itself fails, the response says <Mono>creditsRefunded: false</Mono>{' '}
              and reports the amount still held rather than reporting a clean outcome. Launching the
              same campaign request twice is refused with a <Mono>409</Mono>, because launching it
              again would double-charge the broker.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="Connection facts"
            rows={[
              { k: 'Google Ads API', v: <>v16. <Mono>googleAds:searchStream</Mono> for reads, <Mono>googleAds:mutate</Mono> for writes, with an OAuth access token refreshed per call.</> },
              { k: 'Meta Graph API', v: <>Conversions API on <Mono>v20.0</Mono> with an 8-second timeout. Audience uploads batched 5,000 rows per call.</> },
              { k: 'Minimum daily budget', v: <>AED 50 on Google, enforced at launch and again on a budget edit. AED 50 on the Meta launch route; Meta&rsquo;s own hard floor is AED 20, and anything under AED 150/day carries a learning-phase warning.</> },
              { k: 'Currency conversion', v: <>1 AED = 1,000,000 micros throughout the Google path. There is no second place where that arithmetic is written.</> },
              { k: 'Credits', v: <>1 credit = AED 10 of funded daily ad spend, whole credits only, one shared module so Meta and Google charge identically.</> },
              { k: 'Google launch state', v: <><Mono>status: &lsquo;PAUSED&rsquo;</Mono> is hardcoded. There is no code path in which a manual launch creates an enabled Google campaign.</> },
              { k: 'Meta launch state', v: <>Paused by default. The runbook recommends verifying the full lead round-trip with a Meta test lead before switching it on.</> },
            ]}
          />
        </div>
      </Section>

      {/* ── Meta build ──────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Meta"
          title="Campaign, ad set, creative, ad — or none of them"
          lede={
            <Lede>
              A Meta launch is four dependent objects. The common failure is that two of them are
              created, the third is rejected, and what remains on the ad account is a campaign
              nobody can explain. Every step here is wrapped so that a failure deletes what it
              already built.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The wizard becomes a payload',
                body: 'Property, objective, daily budget, audience, image, copy and lead form are validated as one object before a single Graph call is made. The campaign is created with budgets living on the ad set, not shared across it.',
              },
              {
                title: 'The refusals that happen before anything exists',
                body: (
                  <>
                    The daily budget must be a number and at least AED 50. A cost cap, if set, must
                    be above AED 30 per result. A form-destination campaign must carry a lead form
                    id. A call campaign must carry a phone number.
                  </>
                ),
                detail: (
                  <>
                    The AED 30 floor is not a preference. A real account shipped a cap of AED 7.50
                    per lead into a market where a property lead clears around AED 195. The ad set
                    read &ldquo;Active&rdquo;, sat in learning, and delivered nothing — and a bid cap
                    cannot be changed after launch, so the only exit was a relaunch.
                  </>
                ),
              },
              {
                title: 'The image is ingested, not linked',
                body: (
                  <>
                    Ad images are uploaded into the ad account and referenced by{' '}
                    <Mono>image_hash</Mono> rather than by URL. If the ingest fails the launch is
                    refused and the URL is named. A <Mono>blob:</Mono> or <Mono>data:</Mono> preview
                    URL is refused outright, described as what it actually is: the picture never
                    finished uploading.
                  </>
                ),
              },
              {
                title: 'Interest IDs are re-resolved by name',
                body: 'Every interest in the audience — base, narrowing groups and exclusions alike — is looked up by name against Meta’s live vocabulary before it is sent, so a retired ID is rewritten instead of failing the launch.',
                detail: 'The name is the contract and the ID is only a seed. Three consecutive live launches failed on stale IDs before that rule covered every place interests are stored.',
              },
              {
                title: 'Any failed step deletes the campaign',
                body: (
                  <>
                    On an error at any later step, the campaign is set to <Mono>DELETED</Mono> before
                    the error is re-thrown. No headless campaign is left behind on the ad account,
                    and the reserved credits come back.
                  </>
                ),
              },
            ]}
          />
        </div>
        <Grid cols={2} className="mt-12">
          <Card kicker="Instant forms" title="Questions built from the listing’s own facts">
            Four real-estate form templates, with budget bands derived from the property&rsquo;s
            actual price rather than a generic ladder, plus timeline and purpose. The Download button
            only appears when a real brochure file exists behind it. Meta writes the wording for
            name, email and phone itself and rejects custom labels on them — subcode{' '}
            <Mono>1892063</Mono>, translated on screen instead of shown raw. Existing Meta forms can
            be pulled in and duplicated.
          </Card>
          <Card kicker="Optimisation goal" title="The field labelled ‘max cost per lead’, made visible">
            That field becomes Meta&rsquo;s <Mono>bid_amount</Mono>, which caps the cost of whatever{' '}
            <Mono>optimization_goal</Mono> the ad set was given. On a WhatsApp ad the derived goal was{' '}
            <Mono>LINK_CLICKS</Mono>, so a cap of AED 150 per link click was no cap at all under a
            label promising one. Instant forms optimise on <Mono>LEAD_GENERATION</Mono>, call ads on{' '}
            <Mono>QUALITY_CALL</Mono>, a website objective on <Mono>OFFSITE_CONVERSIONS</Mono> when a
            pixel exists and <Mono>LANDING_PAGE_VIEWS</Mono> when it does not.
          </Card>
          <Card kicker="Video" title="Four conditions before a video ad may launch">
            The upload returns an id before the file is transcoded, and a creative built against a
            still-processing video is accepted by Meta and then fails to deliver — everything reports
            success and the money simply does not move. So: <Mono>video_status</Mono> must reach{' '}
            <Mono>ready</Mono>, a preferred thumbnail must have arrived (a video ad with no cover
            frame renders as a black rectangle in the feed), and <Mono>video_data</Mono> is populated
            as its own Graph shape rather than reusing the link shape, which silently drops the
            headline.
          </Card>
          <Card kicker="Geography and language" title="Residents, not tourists — and no silent widening">
            Location type is sent explicitly as <Mono>home</Mono> and <Mono>recent</Mono> on every ad
            set create, every update and every reach estimate, through one builder, so the estimate
            describes the audience the ad actually buys. Sending nothing inherited Meta&rsquo;s
            default and bought tourists; pinning residents-only turned out to be a deprecated option
            that did not stop delivery but silently blocked every subsequent edit to the ad set.
            Copy is written in <Mono>en</Mono>, <Mono>ar</Mono> and <Mono>ru</Mono> — the only
            languages the landing pages serve — while reach may additionally include{' '}
            <Mono>ur</Mono>, <Mono>es</Mono>, <Mono>de</Mono>, <Mono>fr</Mono> and <Mono>it</Mono>,
            because an Urdu speaker in Dubai reads the Arabic ad.
          </Card>
        </Grid>
      </Band>

      {/* ── No Advantage ────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Defaults"
          title="Every Meta automation is switched off by name"
          lede={
            <Lede>
              Meta&rsquo;s &ldquo;Advantage&rdquo; features are opt-out, and several of them switch
              themselves on when a field is left blank. Leave placements unset and Meta buys
              everywhere, including third-party apps. Leave audience expansion unset and Meta
              delivers outside your targeting. Leave creative options alone and Meta rewords your
              headline and recolours your image.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="What is sent on every launch"
            rows={[
              { k: 'Platforms', v: <>Facebook and Instagram. Audience Network is deliberately absent from the allowed list, and nothing in the payload opts you into it.</> },
              { k: 'Positions', v: <>Facebook: <Mono>feed</Mono>, <Mono>facebook_reels</Mono>. Instagram: <Mono>stream</Mono>, <Mono>story</Mono>, <Mono>reels</Mono>. Those surfaces are the whole buy — &ldquo;automatic&rdquo; placement here means this set, never Meta&rsquo;s everything.</> },
              { k: 'Audience expansion', v: <><Mono>targeting_automation.advantage_audience</Mono> is always <Mono>0</Mono>.</> },
              { k: 'Creative enhancements', v: <>Meta removed the single <Mono>standard_enhancements</Mono> off-switch (subcode <Mono>3858504</Mono>), so 13 features are opted out one by one: image touch-ups, video auto-crop, brightness and contrast, CTA enhancement, text optimisations, image templates, adapt-to-placement, media type automation, product extensions, description automation, text overlay, site extensions and inline comment.</> },
              { k: 'Failure mode of a typo', v: <>The placement builder never returns an empty object. An unknown or empty platform list falls back to the allowed set, so a typo produces &ldquo;ran on Facebook and Instagram&rdquo;, never &ldquo;ran everywhere&rdquo;.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>Why this is worth the trouble</H3>
            <P>
              An expanded audience is no longer the audience you tested. The ad set that
              &ldquo;won&rdquo; was measured on a population you never chose and cannot reproduce, so
              the result cannot be carried into next month&rsquo;s plan. The same applies to a
              rewritten headline: you learn that something worked, not what.
            </P>
          </div>
          <div className="space-y-5">
            <H3>Reading an ad set back</H3>
            <P>
              Placement is fixed on the ad set; an ad cannot change it. So when you add an ad, the
              screen reads the ad set&rsquo;s own targeting spec back from Meta and offers only the
              design shapes those surfaces can use, naming any that would be cropped. Two traps are
              encoded there, both of the &ldquo;absent means everything&rdquo; kind: an empty{' '}
              <Mono>publisher_platforms</Mono> is not &ldquo;no placements&rdquo;, it is automatic
              placements including Audience Network; and a platform named without its positions means
              every position on that platform.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Lead sync and attribution ───────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Attribution"
          title="A Meta lead lands in the CRM with the ad that produced it"
          lede={
            <Lede>
              The gap most agencies never close is between the platform&rsquo;s lead count and your
              own records. This is the mechanism that closes it, and the specific ways it is built to
              fail loudly rather than quietly.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Meta pushes an ID; the content is never trusted',
                body: (
                  <>
                    The webhook verifies Meta&rsquo;s <Mono>x-hub-signature-256</Mono> HMAC against
                    the app secret using a timing-safe comparison. An invalid signature is a{' '}
                    <Mono>401</Mono>, and in production a missing secret is treated as invalid rather
                    than as &ldquo;verification off&rdquo;. The lead is then re-pulled with our own
                    Graph token, using the Page token matching the entry so a lead from a second Page
                    is read with the right credential.
                  </>
                ),
              },
              {
                title: 'Fields are matched tolerantly, not exactly',
                body: (
                  <>
                    Exact aliases first, then tolerant matching:{' '}
                    <Mono>phone|mobile|whatsapp|tel</Mono> maps to phone, and anything containing{' '}
                    <Mono>mail</Mono> maps to email. A localised or custom question key such as
                    &ldquo;Phone number (WhatsApp)&rdquo; no longer makes a lead look contact-less.
                  </>
                ),
                detail: 'A lead with neither phone nor email is dropped and counted as skipped, so “Meta says 30, the CRM has 0, and there is no error anywhere” is a sentence with an answer.',
              },
              {
                title: 'The insert is deduplicated by the database',
                body: (
                  <>
                    A partial unique index on <Mono>meta_lead_id</Mono> enforces it, because an
                    insert guarded by a &ldquo;where not exists&rdquo; is not atomic and the cron and
                    the on-view sync could both fire at once. Attribution is stored as{' '}
                    <Mono>utm_id</Mono> alongside <Mono>meta_ad_id</Mono> and{' '}
                    <Mono>meta_adset_id</Mono>.
                  </>
                ),
              },
              {
                title: 'It enters the same queue as any other lead',
                body: 'Newly inserted leads run through the identical assignment and distribution automation as a lead from a landing page. There is no separate, quieter Meta inbox for them to sit in.',
              },
              {
                title: 'A sweep runs four times a day as a safety net',
                body: (
                  <>
                    At <Mono>01:15</Mono>, <Mono>07:15</Mono>, <Mono>13:15</Mono> and{' '}
                    <Mono>19:15 UTC</Mono> every form is re-checked, and the webhook subscription is
                    re-asserted on each run because Meta can drop it without saying so.
                  </>
                ),
              },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>The Google side is a tracking template</H3>
            <P>
              Google campaigns are created with a campaign-level tracking template of{' '}
              <Mono>
                {'{lpurl}?utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_id={campaignid}'}
              </Mono>
              . Those are ValueTrack parameters substituted at serve time, which is why the campaign
              id can be referenced inside the same atomic mutate that creates the campaign. Final
              URLs are left untouched.
            </P>
            <P>
              This exists for a measurable reason: before it, this account had accumulated 571 CRM
              rows reading &ldquo;General enquiry&rdquo; with no campaign attached, because the
              landing URLs carried no <Mono>utm_id</Mono>.
            </P>
          </div>
          <div className="space-y-5">
            <H3>And the verdict goes back</H3>
            <P>
              When your team qualifies a lead or closes a deal, that verdict is sent to Meta as a
              QualifiedLead or Purchase event, so the optimiser stops buying more of whatever merely
              produced form submissions. Landing-page leads are also re-fired server-side sharing the
              browser pixel&rsquo;s event id, so Meta deduplicates the pair rather than counting two.
            </P>
            <P>
              Deal value is attached only to the Purchase event. Sending the eventual value on
              qualification would teach Meta that qualification is the money, and it would optimise
              for form answers instead of closings. Each stage fires at most once, and the whole path
              is fire-and-forget and never throws — an ad platform must not be able to fail a CRM
              write.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Audiences from closed deals ─────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The feedback loop"
          title="Audiences seeded from deals you actually closed"
          lede={
            <Lede>
              Meta can only optimise on what it can see, which is a form submission. Your CRM knows
              which of those people answered the phone, qualified, and signed. Turning the second
              list into targeting is the only part of this system a media agency cannot reproduce,
              because they do not hold your pipeline.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              The cohort is derived on the server from funnel outcomes. Outcome dominates the score —
              closed outranks qualified, which outranks engaged — and the broker&rsquo;s 0&ndash;10
              rating and the landing-session behaviour score sit under it as supporting evidence, not
              as the verdict. A lead rated 9 who was later blocked scores zero. A lead who bought but
              was never rated is still in the seed.
            </P>
            <P>
              A value-based audience weights each person by what they were worth, so a closed AED 4m
              buyer counts for more than someone who answered the phone once. That flag must be set
              when the audience is created — Meta cannot add it later — and every weight is at least
              1, because Meta silently drops zero-value rows.
            </P>
            <P>
              Before anything is sent, the review screen returns the cohorts with their counts and no
              identifiers at all: the top 20 in the seed and the top 20 excluded. A seed can be
              argued with before it leaves.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Only SHA-256 hashes leave the server. Email is lowercased and trimmed before hashing;
              phone is normalised to digits with the country code first — a leading{' '}
              <Mono>00</Mono> stripped, a 10-digit local number starting <Mono>0</Mono> rewritten to{' '}
              <Mono>971…</Mono>, a 9-digit number likewise. No name, no rating, no CRM note, no
              status, no lead id in the clear. On a value-based seed a weight travels too, and
              nothing else. Uploads require an explicit <Mono>confirm: true</Mono> on every audience
              endpoint.
            </P>
            <P>
              Two suppression lists work the other way. One holds everyone already in your CRM so you
              do not pay again to acquire someone your team is already talking to. The other holds
              the people your own brokers rated worthless, and it is attached to every launch
              automatically rather than offered as an option — there is no bad-lead event in the
              Conversions API, and a Purchase of value zero would teach Meta the person converted,
              which is the opposite of the truth.
            </P>
            <P>
              The response says plainly that Meta populates a lookalike over several hours, and that
              a suppression audience must be attached as an exclusion. Nothing applies it for you.
            </P>
          </div>
        </div>
        <Eyebrow className="mb-6 mt-12">Seed floors, and what they mean</Eyebrow>
        <Grid cols={4}>
          <Stat value="20" label="Custom audience minimum" note="Contacts. Below this the upload is refused with the shortfall stated." />
          <Stat value="100" label="Lookalike minimum" note="Matched people — Meta’s own hard floor, not ours." />
          <Stat value="1,000" label="Below which a lookalike is not really a lookalike" note="Closer to broad targeting than to a similarity model. Said on screen." />
          <Stat value="50%" label="Assumed match rate on a hashed list" note="Used to tell you what your list will actually resolve to before you upload it." />
        </Grid>
        <div className="mt-6">
          <P>
            An account with 26 leads has no lookalike available to it at any level of cleverness. The
            system states the shortfall rather than building something that will quietly
            underperform. The lookalike ratio is clamped to 0.01&ndash;0.20 — the top 1% to 20% most
            similar — defaulting to 0.03 from a form seed and 0.01 from a deal-derived seed, with the
            country as a two-letter code defaulting to <Mono>AE</Mono>. A seed can be assembled from
            up to 100 selected forms at once, uploaded 5,000 rows per call.
          </P>
        </div>
      </Section>

      {/* ── Google Search ───────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Google Search"
          title="Keywords interpolated from your inventory, never invented"
          lede={
            <Lede>
              A keyword is a real bid with real money, so nothing here is written from a guess. Each
              ad group corresponds to one buying intent and points at that project&rsquo;s own
              landing page. Anything that could not be built is printed with the reason it was
              withheld.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Seven ad group kinds are generated from stored fields only — project name, area plus
              type, developer, payment plan, handover year, budget band and Golden Visa. A group
              whose field is blank is withheld and labelled with one of ten reasons:{' '}
              <Mono>noName</Mono>, <Mono>noArea</Mono>, <Mono>noDeveloper</Mono>,{' '}
              <Mono>noPaymentPlan</Mono>, <Mono>noHandover</Mono>, <Mono>noPrice</Mono>,{' '}
              <Mono>belowVisaThreshold</Mono>, <Mono>noLandingPage</Mono>, <Mono>noPermit</Mono>,{' '}
              <Mono>permitExpired</Mono>. An invented area name is a real bid with real money.
            </P>
            <P>
              Keywords are claimed first-come across groups in descending intent order, so two of
              your own ad groups never bid against each other on the same phrase. Anything over
              Google&rsquo;s 80-character limit is dropped here rather than uploaded and silently
              rejected there.
            </P>
            <P>
              Which projects get planned at all comes from the opportunity score: a floor of 45,
              ranked, top 10 per plan. Projects that were never scored are reported separately from
              projects that scored badly, because &ldquo;we have not looked at this&rdquo; and
              &ldquo;this is not worth buying&rdquo; have different answers.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Golden Visa keywords are generated only when the stored starting price is at or above
              AED 2,000,000 — the real government threshold. Below it, the keyword promises something
              the property cannot deliver: a wasted click and a false claim in a live ad.
            </P>
            <P>
              Budget-band keywords round the real starting price <em>up</em> — to the nearest 500,000
              above AED 1m, to the nearest 100,000 below it — so the account never buys &ldquo;under
              1.5m&rdquo; for a 1.6m property.
            </P>
            <P>
              No keyword is ever built from a competitor&rsquo;s name or a rival brokerage&rsquo;s
              brand. That is recorded in the code as a trademark exposure and an ethics line, not as
              a tuning choice you can switch back on.
            </P>
            <P>
              Broad match is never emitted by the planner. Broad is only defensible once automated
              bidding has real conversion data steering it; without that it is the fastest way to
              spend a Search budget on queries nobody meant. New phrases enter one way only: through
              the harvest below. Evidence first, bid second.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="What a Google launch enforces"
            rows={[
              { k: 'Atomicity', v: <>Budget, campaign, ad group, responsive search ad and keywords are one mutate using temporary resource keys. The whole structure lands, or none of it does.</> },
              { k: 'State', v: <>Created paused, every time, with no override.</> },
              { k: 'Bidding', v: <><Mono>TARGET_CPA</Mono> when asked, defaulting to an AED 50 target if none is supplied; otherwise <Mono>MAXIMIZE_CONVERSIONS</Mono>.</> },
              { k: 'Copy floors', v: <>Refused below 3 headlines or 2 descriptions. Uploads are capped at 15 headlines and 4 descriptions — Google&rsquo;s own limits — and generated copy is hard-truncated to 30 and 90 characters on the way back.</> },
              { k: 'Negative keywords', v: <>Five groups covering 39 phrases ship with every plan: rental (10), jobs (8), free and discount (5), not-buying (9), not-property (6). All emitted as PHRASE, never BROAD.</> },
              { k: 'Why phrase, never broad', v: <>A broad negative on <Mono>rent</Mono> would also block <Mono>current</Mono>, and a wrongly blocked query is invisible forever — no report can show what a query that never ran would have brought.</> },
              { k: 'The plan endpoint', v: <>Reading the keyword plan sends nothing to Google, and the panel has no upload button. A plan that uploaded itself on a read would spend money because somebody opened a screen.</> },
              { k: 'Audiences and extensions', v: <>Recorded locally only, even when Google Ads is fully connected, with &ldquo;Saved locally — apply it in Google Ads&rdquo; shown in all three languages. A name-and-type row is not a Customer Match upload and is not presented as one.</> },
            ]}
          />
        </div>
      </Band>

      {/* ── Search-term harvest ─────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The harvest"
          title="Block, buy, or watch — decided in a fixed order"
          lede={
            <Lede>
              The search-terms report holds what people actually typed, as opposed to what you bid
              on. Every term is judged in the same sequence, and the order is the safeguard: the
              cheap decisions are taken before the expensive ones get a chance.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'A decision a person already made is left alone',
                body: 'Anything Google has marked ADDED or EXCLUDED, or that already exists in your account, is skipped entirely. A machine that re-decides somebody’s decision every night is a machine that gets switched off.',
              },
              {
                title: 'A term that converted at or below 1.5× the target cost per lead is proposed to buy',
                body: 'Proposed as an EXACT match, because the exact phrase is what converted — phrase match would buy a wider set on a narrower result.',
              },
              {
                title: 'A converting term above that price is “watch”, never a negative',
                body: 'A term that produces leads is expensive, not junk, and those two conditions have different answers. Blocking it would remove the evidence you would need to fix its price.',
              },
              {
                title: 'A term containing a project or developer you sell is never blocked',
                body: 'Whatever the arithmetic says. A brand query with no conversion yet is still the best traffic in the account, and blocking it hands the name to whoever bids next. Matched on word boundaries, so the developer “Emaar” does not accidentally protect “emaarketing”.',
              },
              {
                title: 'Only then is a zero-conversion term blocked',
                body: 'And only if it spent 2× the target cost per lead or took 15 or more clicks. Negatives are ranked by spend so the biggest leak is at the top, and each one shows the AED figure it saves.',
              },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>Where the target price comes from</H3>
            <P>
              It is computed from the account&rsquo;s own Google spend and Google conversions, and it
              returns nothing below 5 leads — a cost per lead derived from two leads has an enormous
              error bar, and every negative is measured against it.
            </P>
            <P>
              With no target on file, the harvest blocks <em>nothing</em>. An account with no Google
              conversion tracking has zero conversions, so the calculation fails closed rather than
              substituting a guessed default that would cut queries which were working. That is said
              on screen, not left to be inferred from an empty list.
            </P>
          </div>
          <div className="space-y-5">
            <H3>The cap on additions is structural</H3>
            <P>
              At most 10 keywords are proposed per run, ranked cheapest cost-per-acquisition first,
              and the number cut by the cap is reported on screen rather than swallowed. The reason
              is not performance: adding every converting query produces thousands of
              one-impression keywords nobody can read, and an account nobody can read is an account
              nobody manages.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Spend control ───────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Spend control"
          title="Nothing autonomous moves money without a rule you wrote"
          lede={
            <Lede>
              The system can restructure campaigns for free all day. It cannot fund them. Every
              proposal to increase a budget — from a person or from the autopilot — passes the same
              deterministic gate, and the gate is deliberately dull: money authority must never come
              from a black box.
            </Lede>
          }
        />
        <SpendAuthority className="mt-12" />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              A rule reads: you may raise a campaign to at most AED X per day, in steps of at most
              AED Y, but only if cost per lead is under Z, CRM quality is at least Q, and there are
              at least N leads behind the number. Each satisfied rule authorises a ceiling of
              whichever is lower — the daily maximum, or the current budget plus the maximum single
              step. The most generous granted envelope wins, and the outcome is one of approved,
              capped, or blocked, each carrying a plain-language reason and the id of the rule that
              granted it for the admin log.
            </P>
            <P>
              A decrease or no change never needs authority. With no applicable rule, the answer is
              blocked and held for an admin. With no attributed signal — no cost per lead, or no
              leads at all — the answer is blocked regardless of what any rule permits, because we
              never fund on absent data. A gate referencing a metric we have no signal for fails
              closed, not open.
            </P>
            <P>
              Rules are stored org-wide, scoped either to everything or to a single project, with
              project rules adding to the general ones. If that read fails, it returns an empty list
              and therefore blocks — it does not crash the advertising screens, and it does not fall
              through to permissive.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Separately, campaign rules can watch the metric no ad platform can offer: lead quality
              from your own CRM. &ldquo;If quality drops below 60, pause; if quality is above 95,
              raise the budget.&rdquo; Cost per lead, lead count, spend, click-through rate and
              frequency are available too. These rules are <em>evaluated only</em> — applying the
              action is an explicit separate step through the same control endpoints a person uses.
            </P>
            <P>
              A rule fires on evidence, not arithmetic. Every rate is derived from raw counts through
              a confidence bound facing the threshold rather than the point estimate, so{' '}
              <Mono>cpl &gt; 300</Mono> on two leads fires only if even the optimistic end of the
              range is over budget. A rule that cannot be decided on the available evidence is
              returned as withheld, with its reason, and shown — being told what is not acting yet is
              what makes the ones that do act trustworthy.
            </P>
            <P>
              That design has a specific origin. The old function accepted a pre-computed cost per
              lead, both callers passed <Mono>{'leads > 0 ? spend / leads : 0'}</Mono>, and a
              campaign that produced nothing arrived as &ldquo;cost per lead: 0&rdquo;. A rule
              reading &ldquo;below AED 100, raise the budget&rdquo; treated it as the cheapest
              campaign in the account.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="Starting postures, labelled as rules of thumb rather than values from your account"
            rows={[
              { k: 'Conservative', v: <>AED 300/day ceiling, AED 50 maximum step, cost per lead under AED 120, quality at least 70, at least 10 leads.</> },
              { k: 'Standard', v: <>AED 750/day ceiling, AED 150 maximum step, cost per lead under AED 200, quality at least 55, at least 5 leads.</> },
              { k: 'Aggressive', v: <>AED 1,500/day ceiling, AED 400 maximum step, cost per lead under AED 350, quality at least 40, at least 3 leads.</> },
              { k: 'The quality floor', v: <>A quality score is withheld below 5 attributed leads, and withheld again when no attributed lead has been worked past &ldquo;new&rdquo; — an unworked funnel produced a small number that read as a verdict on the campaign when it was a verdict on the queue. Frequency needs 1,000 impressions before it is reported at all.</> },
              { k: 'Context for the numbers', v: <>A qualified property lead in Dubai off-plan typically costs roughly AED 100&ndash;400. The presets are shaped around that range; they are not computed from your account and are not presented as though they were.</> },
            ]}
          />
        </div>
        <div className="mt-10">
          <P>
            One honest limit, because it changes what the diagram above means today. The authority
            engine is currently wired to an advisory endpoint: it computes and displays what could be
            funded before a broker commits, rather than executing the budget change itself.
            Autonomous execution today runs through the autopilot&rsquo;s own hard daily cap, which
            is a separate mechanism described below. For callers who are not management, the reason
            string and the granting rule id are redacted from the response. The role boundaries are
            set out on <TextLink href="/business/security">Security &amp; control</TextLink>.
          </P>
        </div>
      </Band>

      {/* ── Permits ─────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Regulatory"
          title="No valid Trakheesi permit, no advertisement"
          lede={
            <Lede>
              A Dubai property advertisement must legally carry a valid DET/RERA Trakheesi permit
              number. This is enforced at three separate points, because a permit that was valid at
              launch can lapse while the campaign is still running.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Before the plan',
                body: 'The Google keyword plan builds nothing at all — not one keyword — for a project with no permit number or a permit whose expiry date has passed. It is stopped one step earlier than the live-campaign check, so the phrases are never even proposed.',
              },
              {
                title: 'At launch',
                body: (
                  <>
                    A Meta launch is refused with a <Mono>400</Mono> when the listing&rsquo;s permit
                    has already expired. The permit number is appended once to the ad&rsquo;s body
                    copy, and the launch readiness strip shows the permit state before you have
                    finished building, alongside the other three things your browser cannot know: is
                    Meta connected, is a Page selected, is the landing page published right now.
                  </>
                ),
              },
              {
                title: 'While it runs',
                body: (
                  <>
                    The expiry becomes the ad set&rsquo;s end time, written as an absolute instant
                    with an explicit <Mono>+04:00</Mono> offset —{' '}
                    <Mono>YYYY-MM-DDT23:59:59+04:00</Mono> — on every ad set the launch creates,
                    including each one in a placement split.
                  </>
                ),
                detail: 'Meta reads a bare timestamp in the ad account’s own timezone, which we never read. An ad account set to Los Angeles would keep a lapsed permit advertising for eleven hours longer than the law allows.',
              },
              {
                title: 'On the Dubai calendar, not the server’s',
                body: 'Expiry is compared against Dubai’s calendar day explicitly. The scheduled jobs run in UTC, four hours behind, which would treat a lapsed permit as still valid for the last four hours of the Dubai day.',
              },
              {
                title: 'Five days before, you are told',
                body: 'A permit within five days of expiry raises a renewal warning, so the permit can be renewed rather than the campaign being interrupted. A verification link deep-links the Dubai Land Department’s own validate-advertising-license page, and a QR code renders the same link for a printed asset.',
              },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>What counts as a permit</H3>
            <P>
              4 to 40 alphanumeric characters, with dashes and slashes permitted. Anything else is
              honestly reported as no permit rather than accepted as a plausible-looking one. An
              expiry is only accepted as a real <Mono>YYYY-MM-DD</Mono> calendar date. The resulting
              state is one of five: valid, expiring, expired, no expiry recorded, or missing.
            </P>
          </div>
          <div className="space-y-5">
            <H3>What a blank field does not do</H3>
            <P>
              A missing permit number and a missing expiry date are treated as absence of evidence,
              not as proof of a lapse. They are surfaced as loud warnings; they are never used to
              block a launch or auto-stop a running campaign. Refusing over a blank field would be
              its own kind of wrong, and it would train people to enter something rather than
              something true.
            </P>
            <P>
              In the autopilot, the compliance stop runs before every other check. It stops every
              affected trial rather than the usual one per project, it ignores both the protection
              logic and the spend gates, and it deliberately does not reallocate the freed budget to
              anything else. Not spending is always compliant.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Delivery truth ──────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Delivery"
          title="“Switched on” is not the same claim as “serving”"
          lede={
            <Lede>
              The two most expensive states in an ad account both look green in the platform&rsquo;s
              own dashboard: an ad the platform has given up optimising, and an ad that is approved,
              switched on, and being shown to nobody. Both are named here, and neither is inferred
              from a status field alone.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>Meta: fourteen states instead of two</H3>
            <P>
              Read from Meta&rsquo;s effective status — what Meta will actually do, rather than what
              was asked for — together with the learning-stage information and the delivery numbers.
              Six genuinely different situations hide inside &ldquo;Active&rdquo;. Learning carries
              progress against Meta&rsquo;s own threshold of 50 results.
            </P>
            <P>
              An ad set past its end time reads as finished, on an idle tone, and that check runs
              before everything else — our end times carry the permit window, and reading a
              deliberate compliance stop as a fault would put it in the same red as an ad reaching
              nobody.
            </P>
            <P>
              &ldquo;Not delivering&rdquo; is only claimed when Meta has actually reported
              impressions for the window and they are zero. An unknown number is not evidence of
              zero; the honest answer there is unknown, and that is what the screen says.
            </P>
          </div>
          <div className="space-y-5">
            <H3>Google: nine words and ten named blockers</H3>
            <P>
              Google exposes a primary status and its reasons — better than Meta&rsquo;s, because it
              names the blocker. These map to Serving, Learning, Capped, In review, Setup broken, Not
              serving, Paused, Ended and Switch on; and to ten blockers, each carrying a route into
              the screen where it gets fixed: budget capped, bid strategy, no keywords, keywords off,
              no ads, ads off, ads rejected, ads in review, landing page, nobody searching.
            </P>
            <P>
              Reasons are matched by substring on Google&rsquo;s enum names rather than exact
              strings, so a reason Google adds in a future API version does not silently read as
              &ldquo;no reason given&rdquo;. Where the primary status is absent, an enabled switch
              reads as unknown — deliberately not as delivering.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <SpecTable
            caption="How the numbers are counted"
            rows={[
              { k: 'Two windows, never mixed', v: <>Lifetime for reporting, because the answer to &ldquo;what did this campaign bring&rdquo; must never go down. A rolling 30 days for judgement — deliberately not a calendar month, which erases every campaign&rsquo;s history at midnight on the 1st and froze the autopilot for the first days of every month.</> },
              { k: 'Lead counting', v: <>One canonical function that never sums Meta&rsquo;s overlapping lead action types. Summing them once showed a campaign with 24 real leads as 120. It prefers the exact lead action, then a fixed priority list — never array order, because Meta does not guarantee it and pick-first made the total flip between runs.</> },
              { k: 'Absent versus zero', v: <>A campaign with no insights row is returned as null, not as a zeroed row. Zero spend is a measurement; absence is not one, and the screens print the difference.</> },
              { k: 'Impression share', v: <>Missed impressions are split between rank and budget, and one cause must hold 60% or more of the loss before it is named. Otherwise the verdict is &ldquo;losing to both&rdquo; — naming one alone would send somebody to do half a job. No verdict at all below 300 impressions.</> },
              { k: 'Google’s reporting clamps', v: <>Any share above 0.9 is clamped by Google to exactly 0.9, and below 0.1 to 0.0999. Those are bounds, not measurements, so the screen prints &ldquo;over 90%&rdquo; rather than a point estimate while the arithmetic still uses the value as reported.</> },
              { k: 'Auction Insights', v: <>Not offered. Competitor domains, overlap rate and position-above rate are not exposed through any Google API — the panel says so rather than showing an empty table.</> },
              { k: 'Cross-channel comparison', v: <>Google conversions are not leads; they can be any configured conversion action. Google trials are therefore judged on CRM leads attributed by <Mono>utm_id</Mono>, and both channels are compared on that one shared basis — otherwise the autopilot would pause a Google campaign that is working.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>Errors translated only where we have seen them</H3>
            <P>
              Meta&rsquo;s API errors are keyed by subcode to one plain sentence you can act on — the
              app is still in Development Mode, and here is the exact path to switch it live; the
              login can see the Page but cannot run ads from it, and here are the Business Settings
              steps; an interest was retired, so open the audience and press Check now; Meta could not
              download a linked image, so upload it instead. Rate limiting is answered as
              &ldquo;nothing is broken; wait a few minutes&rdquo;.
            </P>
            <P>
              Every entry is a fault this account genuinely produced. None were written from the
              documentation. A fault we have not seen is shown in Meta&rsquo;s own words, untouched,
              because inventing an explanation would be confidently wrong — and one subcode Meta
              describes as &ldquo;an unknown error occurred&rdquo; is answered as what it is: Meta
              refused this without saying why.
            </P>
          </div>
          <div className="space-y-5">
            <H3>The one error we refuse to interpret</H3>
            <P>
              Meta&rsquo;s subcode 33 reads &ldquo;object does not exist, cannot be loaded due to
              missing permissions, or does not support this operation&rdquo;. It is never treated as
              &ldquo;this campaign was deleted&rdquo;. A token that lost its read permission produces
              the identical error on a live campaign that is spending right now, so acting on it
              would be destructive on a guess. Unreachable means report it once, keep tracking,
              change nothing.
            </P>
            <P>
              The same instinct governs the placement audit and the overlap estimator: a placement
              that is merely young is undecided, never bad; and ad sets sharing no placement surface
              are skipped entirely rather than scored, because this product deliberately splits one
              audience across feed, stories and reels, and a naive estimate flagged the product&rsquo;s
              own correct structure as competing with itself on a screen a client was reading.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Autopilot ───────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Autopilot"
          title="What the ads machine may do while nobody is watching"
          lede={
            <Lede>
              You choose the projects and one hard daily spend cap covering Meta and Google together.
              It plans two or three audience trials per project from genuinely different sources,
              launches them, reads the results, asks your brokers to judge the leads, and moves
              budget from the trials that lose to the trials that win. The plan is written down as
              data before anything launches, and the engine executes that plan verbatim.
            </Lede>
          }
        />
        <Grid cols={2} className="mt-12">
          <Card kicker="Unattended" title="What it may do on its own">
            Launch the planned trials at or above AED 50/day each. Shift budget between them. Pause a
            losing trial — at most one per project per cycle, deterministically chosen. Block
            wasteful Google search terms once every 20 hours, attached at campaign level to the
            biggest-spending Search campaign, because a query wasting money in one ad group wastes it
            in every other group of the same campaign. Stop a campaign for a lapsed permit, ignoring
            every other gate. Raise an alarm.
          </Card>
          <Card kicker="Held for a person" title="What it must ask for">
            Adding a keyword. Swapping a creative it has reported as fatigued. Excluding a placement
            it has reported as draining. Pausing an ad stuck in review. Any budget increase that
            exceeds the cap. The rule underneath all of them: a negative only ever stops spend and
            undoes in one click, while a new keyword starts spend on a forecast rather than a
            measurement.
          </Card>
        </Grid>
        <div className="mt-12">
          <SpecTable
            caption="The thresholds it runs on"
            rows={[
              { k: 'Cycle', v: <>Twice a day, at 04:00 and 16:00 UTC, so a bad trial is caught in hours rather than after a full day of cap.</> },
              { k: 'Cap enforcement', v: <>Every mutation that can add spend re-reads the current active spend across both channels fresh, and skips with a logged &ldquo;cap enforced&rdquo; line rather than exceeding the cap. A cap that cannot fund the minimum honest structure returns &ldquo;not viable&rdquo; with a reason instead of a pretend plan.</> },
              { k: 'Human verdicts', v: <>Only decisive yes/no answers from a person count, and at least 3 are needed before broker judgement may condemn a trial (under 40% yes) or protect one (70% yes or above). Below 3, the screen says so and rotation falls back to metrics alone.</> },
              { k: 'Metric gates', v: <>A metric branch cannot act until the trial has spent at least 3× its daily budget. Cost-per-lead condemnation needs the trial above 1.5× the best sibling with at least 3 leads on both sides. Quality condemnation needs the trial under 40 while a sibling holds at least 60.</> },
              { k: 'Growth bounds', v: <>At most +50% of the trial&rsquo;s current daily budget per cycle, never beyond 3× what the plan approved for that trial, and nothing under AED 10 — below that, a live budget mutation is not worth making.</> },
              { k: 'Delivery grace', v: <>A campaign reading &ldquo;not delivering&rdquo; must persist for 24 hours before it is stopped; a new campaign legitimately reads that way during review and ramp. An ad in review past 48 hours is called out but never auto-paused.</> },
              { k: 'Stall alarm', v: <>Spending 3× the daily cap with zero leads anywhere raises a machine-stalled alarm, because at that point the problem is upstream of ad rotation. Repeat alarms are suppressed for 12 hours.</> },
              { k: 'Reported, never acted on', v: <>Creative fatigue at a frequency of 3.0, and placement drain — where the per-placement read is only made for trials that have already spent 3× their daily budget. Both are logged as observations.</> },
              { k: 'Exploration limit', v: <>A lifetime cap of 2 minted explore arms per project.</> },
              { k: 'Copy provenance', v: <>Each plan records whether the ad copy came from the model or from a deterministic template built only from the listing&rsquo;s real fields, and the screen labels which. Template output is never presented as AI.</> },
            ]}
          />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <H3>The brokers grade what the machine bought</H3>
            <P>
              For each lead a trial produced, the machine asks the broker who owns it one tap: was
              this real? If a lead has sat unmoved for three days, it asks the softer question
              instead — how likely would this person buy, 0 to 10 — deriving yes at 6 or above, no at
              4 or below, and leaving 5 neutral. Asking on day zero harvests noise, so it does not.
            </P>
            <P>
              The machine records its own suggested verdict alongside, and the screen says so:
              your judgement overrides it. The scale is labelled at both ends — 0 means stop buying
              leads like this, 10 means exactly what we want. Leads flagged by training-integrity
              checks are excluded so they cannot poison the loop.
            </P>
          </div>
          <div className="space-y-5">
            <H3>Everything it did is a sentence</H3>
            <P>
              The activity feed enumerates every kind of thing the machine can do: planned, launched,
              budget shifted, trial paused, trial resumed, observation, feedback requested, feedback
              answered, cap enforced, permit blocked, permit warning, delivery blocked, machine
              stalled, creative fatigue, placement drain, error. Each run writes a line with the real
              numbers, including the runs where nothing was blocked and why.
            </P>
            <P>
              A paused machine observes and does not touch the live account. And when Google is not
              connected, a Google trial degrades to a local paused draft and logs that it spends
              nothing until Google is connected — while Meta keeps running. Both halves of that
              sentence are stated rather than left to be discovered from a flat spend chart.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Guardrail ───────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="The limits"
          title="What this will refuse to do with your money"
          lede={
            <Lede>
              Collected in one place, because a limit is a commitment and these are the ones worth
              planning around. Each of them has cost somebody something to learn.
            </Lede>
          }
        />
        <div className="mt-12">
          <Guardrail
            items={[
              <>With no spend rule on file, nothing autonomous moves money. Absence of instruction is read as &ldquo;no&rdquo;, never as &ldquo;use your judgement&rdquo;.</>,
              <>No budget increase is funded on absent data. No attributed lead, or no cost-per-lead signal, blocks the increase whatever the rules permit — and a results gate referencing a metric with no signal fails closed.</>,
              <>No ad runs for a Dubai property on an expired Trakheesi permit, and ads whose permit lapses mid-flight are stopped. The freed budget is deliberately not reallocated: not spending is always compliant.</>,
              <>A missing permit number or a missing expiry date is treated as absence of evidence, not proof of a lapse. It warns loudly; it never blocks a launch or auto-stops a campaign.</>,
              <>Audience Network is never bought, and every Meta &ldquo;Advantage&rdquo; automation is opted out by name — audience expansion set to zero, all 13 creative enhancements individually opted out, placements named in full.</>,
              <>A launch is refused when a requested language cannot be resolved to Meta&rsquo;s locale IDs. Unnarrowed is not a smaller version of what was asked for; it is a different campaign, delivered to everyone while every screen still says &ldquo;Arabic&rdquo;.</>,
              <>A cost cap below AED 30 per result is refused. A cap that cannot win the auction leaves the ad set reading &ldquo;Active&rdquo; and delivering nothing, and a bid cap cannot be changed after launch.</>,
              <>A launch is refused when the landing page does not exist or is not published. Every paid click is an anonymous visitor, and a 404 produces no symptom except &ldquo;no leads&rdquo; — which gets misdiagnosed as a bad audience for a fortnight.</>,
              <>A lookalike is refused below 100 matched contacts and a custom audience below 20. The shortfall is stated rather than something being built that will quietly underperform.</>,
              <>No contact data leaves without an explicit confirmation, and only SHA-256 hashes leave at all: email, phone, and on a value-based seed a weight. No name, no rating, no CRM note, no status, no lead id in the clear.</>,
              <>Deal value is attached only to the Purchase event, never to qualification, and nothing is written back to Meta on inference — a human moves the card or rates the lead, because Meta has no way to take an event back.</>,
              <>The automated side blocks but never buys. Negatives apply unattended; proven search terms are counted and left for a person.</>,
              <>No keyword is ever built from a competitor&rsquo;s name, and no search term containing a project or developer you sell is ever blocked, whatever the arithmetic says.</>,
              <>Automation rules are evaluated only. Pausing a campaign or changing a real budget is a separate, explicit step through the same endpoints a person uses.</>,
              <>An unrecognised Meta error is shown in Meta&rsquo;s own words, and subcode 33 is never read as &ldquo;deleted&rdquo; — a token that lost its read permission produces the identical error on a campaign that is alive and spending.</>,
            ]}
          />
        </div>
        <div className="mt-14">
          <Callout>
            The system would rather spend nothing than spend on a number it has not earned.
          </Callout>
        </div>
      </Band>

      <NextPages
        items={[
          { href: '/business/platform/creative', label: 'Creative', blurb: 'Where the copy and the images come from, and how each one is labelled.' },
          { href: '/business/platform/crm', label: 'CRM', blurb: 'What happens to the lead after it arrives attributed.' },
          { href: '/business/security', label: 'Security & control', blurb: 'Who may spend, who may read a lead’s details, and how the keys are stored.' },
        ]}
      />
    </>
  )
}
