import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H2, H3, Lede, P, Card, Grid, SpecTable,
  Guardrail, Steps, Callout, SectionHeading, NextPages, ButtonLink, Eyebrow,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Listing-to-Landing',
  description:
    'Your public property website and landing-page network, with the management desk and CRM behind it. Set up with you, on your own domain.',
  alternates: { canonical: '/business/listing-to-landing' },
}

export default function ListingToLandingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Product · Listing-to-Landing"
        title="The website buyers see, and the desk behind it"
        lede={
          <>
            Everything a buyer touches — your website, the property search, the area and developer
            guides, the page every advertisement points at, the form they enquire through — running
            on the same inventory your team works from, with the full management system and CRM
            behind it. Set up with you, on your own domain.
          </>
        }
        meta={[
          { k: 'For', v: 'Companies whose website is the shopfront' },
          { k: 'Runs at', v: 'Your own domain' },
          { k: 'Setup', v: 'With our team, on request' },
          { k: 'Includes', v: 'The full management desk and CRM' },
        ]}
      />

      {/* ── The problem ─────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Why this is a product"
            title="The website and the system are usually two different companies"
          />
          <div className="space-y-5">
            <P>
              A brokerage website is normally built once by an agency, handed over, and then slowly
              stops being true. A project sells out and the page stays up. A price changes in the
              CRM and not on the site. A new launch takes three weeks and an invoice to appear.
            </P>
            <P>
              Meanwhile the advertising points at pages the agency built, the enquiries land in an
              inbox, and the team works from a separate list. The website ends up as a brochure that
              happens to be online — expensive to change, and disconnected from the stock the
              company actually sells.
            </P>
            <P>
              This product removes the seam. The website reads the same inventory the team edits, so
              publishing a new project is a change in the system, not a project with a developer.
            </P>
          </div>
        </div>
      </Band>

      {/* ── What the public sees ────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The public side"
          title="What a buyer arrives at"
          lede={
            <Lede>
              Generated from your inventory and kept current by it, in English, Arabic and Russian,
              with Arabic laid out right to left rather than reversed by a plugin.
            </Lede>
          }
        />
        <Grid cols={2} className="mt-12 bg-white/[0.07]">
          <div className="bg-[#0A0C0F] p-7">
            <H3>Property catalogue and search</H3>
            <p className="mt-2.5 text-[0.9375rem] leading-[1.7] text-[#8F959D]">
              Every project you sell, filterable the way buyers actually shop — area, price, handover,
              developer, unit type. Sold-out stock is marked rather than silently removed.
            </p>
          </div>
          <div className="bg-[#0A0C0F] p-7">
            <H3>A page for every property</H3>
            <p className="mt-2.5 text-[0.9375rem] leading-[1.7] text-[#8F959D]">
              The page an advertisement points at: prices, payment plan, handover, floor plans,
              gallery, location and the enquiry form — all from the listing record itself.
            </p>
          </div>
          <div className="bg-[#0A0C0F] p-7">
            <H3>Area and developer guides</H3>
            <p className="mt-2.5 text-[0.9375rem] leading-[1.7] text-[#8F959D]">
              The pages that earn search traffic rather than paying for it, built on the same market
              reference the rest of the system uses.
            </p>
          </div>
          <div className="bg-[#0A0C0F] p-7">
            <H3>Enquiry capture</H3>
            <p className="mt-2.5 text-[0.9375rem] leading-[1.7] text-[#8F959D]">
              Every form on the public site writes into the CRM immediately, attributed to the page
              and the campaign that produced it — not to an inbox somebody checks.
            </p>
          </div>
        </Grid>
      </Section>

      {/* ── What the company gets ───────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="The private side"
          title="The management desk, included"
          lede={
            <Lede>
              This is not a website product with a contact form bolted on. Behind the public site is
              the same platform Lead Machine runs on, in full.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="Behind the site"
            rows={[
              { k: 'CRM and pipeline', v: <>Every enquiry, owned and timed, through to a closed deal with a reason recorded.</> },
              { k: 'Inventory', v: <>The single source the website reads from. Edit once; the public page follows.</> },
              { k: 'Advertising', v: <>Meta and Google campaigns built against the same listings, under the same spending limits.</> },
              { k: 'Creative', v: <>Advertisement sets, video and brochures produced from the listing.</> },
              { k: 'Analytics and finance', v: <>Spend against pipeline, cost per lead, commission and the monthly report.</> },
              { k: 'Roles', v: <>Agents, managers, marketing and directors each see the part of it they should.</> },
            ]}
          />
        </div>
      </Band>

      {/* ── Setup ───────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="How it is set up"
          title="Configured with you, not self-served"
          lede={
            <Lede>
              This product carries your public identity, so it is not something to switch on from a
              form. Setup is done with our team.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The inventory is agreed first',
                body: 'Which projects you actually sell, how they should be described, and what is missing. The website can only be as good as the records it reads from, so this comes before any design conversation.',
              },
              {
                title: 'The public site is fitted to your brand',
                body: 'Your identity across the whole public surface — the catalogue, the property pages, the guides, the forms. The system carries no vendor marking anywhere a buyer can see.',
              },
              {
                title: 'Your domain is connected',
                body: 'The site runs on your own domain rather than a subdomain, with certificates and search-engine basics handled as part of setup.',
              },
              {
                title: 'The team is put on it',
                body: 'Agents, managers and marketing get their roles, and the enquiries from the new site start landing in the pipeline with attribution intact.',
              },
              {
                title: 'Advertising is pointed at it',
                body: 'Campaigns are built against the same listings, sending traffic to pages that are checked before they are allowed to carry budget.',
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Honest limits ───────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading eyebrow="Straight answers" title="What to know first" />
          <Guardrail
            title="Honest limits"
            items={[
              <>It is a property website, not a general website builder. The pages are generated from an inventory model built for UAE real estate; it will not become a restaurant site.</>,
              <>The public site is only as current as your inventory. It removes the excuse for stale pages; it does not remove the work of keeping stock accurate.</>,
              <>Design is fitted within the system&rsquo;s structure. You get your identity across it, not a blank canvas — which is the trade that keeps every page consistent and fast.</>,
              <>Setup is a scheduled piece of work with our team, not an instant provision. If you need something running this afternoon, start a Lead Machine trial instead.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <H2>Starting a conversation</H2>
            <div className="mt-6 max-w-[52ch] space-y-5">
              <P>
                The useful first conversation is about your inventory and your current site, not
                about features. Bring the list of projects you sell and whatever your website is
                doing today.
              </P>
              <P>
                If you would rather see the system working before talking to anyone, a Lead Machine
                trial contains the same platform behind the scenes.
              </P>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/business/contact">Talk to us</ButtonLink>
              <ButtonLink href="/signup" variant="ghost">Try the platform first</ButtonLink>
            </div>
          </div>
          <div className="space-y-4">
            <Card kicker="Also worth reading" title="Landing pages in detail">
              How a page is generated from a listing, and the gate that blocks a weak page from
              carrying advertising.
            </Card>
            <Card kicker="Also worth reading" title="Inventory in detail">
              What the system holds about a property, and how it decides whether it is fit to
              advertise.
            </Card>
          </div>
        </div>
      </Section>

      <Section className="pb-16 lg:pb-24">
        <Callout>
          A property website should be the same thing as the inventory, viewed from outside. Anything
          else is a brochure with a delay built into it.
        </Callout>
      </Section>

      <NextPages
        items={[
          { href: '/business/platform/landing-pages', label: 'Landing pages', blurb: 'How a page is made and what blocks a weak one.' },
          { href: '/business/platform/inventory', label: 'Inventory', blurb: 'The record everything else reads from.' },
          { href: '/business/lead-machine', label: 'Lead Machine', blurb: 'The same platform, self-served.' },
        ]}
      />
    </>
  )
}
