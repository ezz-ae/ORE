import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H2, H3, Lede, P, Card, Grid, SpecTable,
  Guardrail, Steps, Callout, SectionHeading, NextPages, Eyebrow, TextLink,
} from '@/components/business/ui'
import { SystemLoop } from '@/components/business/diagrams'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'The whole path from a property in your inventory to a closed deal, and how the result of that deal changes who the next campaign looks for.',
  alternates: { canonical: '/business/how-it-works' },
}

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From a listing to a closed deal, in order"
        lede={
          <>
            This page follows one property all the way through the system — what happens to it,
            what the system decides on its own, and where it stops and asks a person. Nothing here
            is abstract: each stage is a screen somebody uses.
          </>
        }
        meta={[
          { k: 'Stages', v: 'Three' },
          { k: 'Automatic', v: 'Preparation and detection' },
          { k: 'Needs a person', v: 'Anything that starts spending' },
        ]}
      />

      <Section className="pb-16">
        <SystemLoop />
      </Section>

      {/* ── Stage one ───────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Stage one"
          title="Deciding what is worth advertising"
          lede={
            <Lede>
              Before anything is promoted, the system works out whether it should be. Most wasted
              property marketing is not bad targeting — it is a good budget pointed at a listing
              that was never ready to receive it.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The property is described completely, or the gaps are named',
                body: 'Price, payment plan, handover, developer, area, unit types, amenities, media, permit. Each property gets a data-quality reading that says precisely what is missing rather than a score nobody can act on.',
                detail: 'A missing handover date is not a cosmetic problem — it is the answer to the second question every off-plan buyer asks.',
              },
              {
                title: 'Ad-readiness is judged separately from completeness',
                body: 'A listing can be perfectly filled in and still be unfit to advertise — no permit, no page to send a click to, no usable image. Ad-readiness answers one question: if money were pointed at this today, would it be wasted?',
              },
              {
                title: 'Opportunity is ranked against evidence',
                body: 'Which properties deserve budget is decided from real signals — how the area is transacting, what the enquiry history looks like, how the price sits against comparable stock — rather than from whoever asked loudest this week.',
              },
            ]}
          />
        </div>
        <div className="mt-12">
          <Guardrail
            title="What stage one refuses"
            items={[
              <>It will not invent a missing figure to make a listing look complete. A blank stays blank and is reported as blank.</>,
              <>It will not mark a property ready to advertise when it has no valid advertising permit or the permit has expired.</>,
              <>It will not rank a property as an opportunity on the strength of enthusiasm. If the evidence is thin, it says the evidence is thin.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Stage two ───────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Stage two"
          title="Turning a listing into something that can carry money"
          lede={
            <Lede>
              A campaign is only as good as the page underneath it and the creative on top of it.
              Both are produced from the listing itself, so they cannot drift away from the facts.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The page is generated from the listing',
                body: 'One page per property, carrying the same prices, plans and images that are in your inventory. When the listing changes, the page is not left telling last month’s story.',
              },
              {
                title: 'The page is tested before it is allowed to carry advertising',
                body: 'A page missing the things a buyer needs in order to enquire is blocked from launch. This is a hard stop, not a warning banner — the most expensive mistake in property advertising is a working campaign pointed at a page that cannot convert.',
                detail: 'The block is specific: it names what is missing so it can be fixed in minutes rather than debated.',
              },
              {
                title: 'The creative set is produced from the same source',
                body: 'Every size and placement the platforms require, generated from the listing’s own images and facts, so the advertisement and the page agree with each other.',
              },
              {
                title: 'The campaign is built, and the rules are checked',
                body: 'Targeting, budget and structure are assembled for Meta or Google. Before anything can go live it must pass the limits you set and the permit check.',
                detail: 'Google campaigns are always created paused. Nothing starts spending because a screen was opened.',
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Stage three ─────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Stage three"
          title="The lead, the deal, and what the system keeps"
          lede={
            <Lede>
              This is the stage that most tool-chains lose, because it is where the record has to
              survive being handed between three different systems.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The lead arrives already attributed',
                body: 'A click carries its campaign with it, so the enquiry that follows lands in the CRM knowing which advertisement produced it, for which project. Nobody has to reconstruct that later from memory or a spreadsheet.',
              },
              {
                title: 'It is owned within a known number of minutes',
                body: 'The lead is routed to an agent by your rules, and the clock on the first reply starts the moment it lands. An unowned lead is shown as an urgent state rather than sitting quietly in a list.',
              },
              {
                title: 'Duplicates and dead numbers are flagged, not deleted',
                body: 'The same buyer enquiring twice is recognised and marked, and a number too short to dial is called out. Neither is removed on the system’s own authority — a person decides.',
              },
              {
                title: 'The deal is closed with a reason',
                body: 'Won or lost, and why. That reason is the single most valuable piece of data the company produces, because it is what makes the next stage possible.',
              },
              {
                title: 'The result is fed back into who gets advertised to',
                body: 'The people who actually bought become the seed for finding more people like them. The audience narrows toward your real customers instead of the platform’s first guess.',
                detail: 'This is the return path in the diagram above, and it is the reason the second campaign should cost less than the first.',
              },
            ]}
          />
        </div>
      </Band>

      {/* ── Who decides ─────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Division of labour"
          title="What the system does alone, and what it must ask"
          lede={
            <Lede>
              The dividing line is consistent throughout: the system may prepare anything and may
              stop anything, but it may not start spending money on its own.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="Who decides what"
            rows={[
              { k: 'Done automatically', v: <>Scoring inventory, generating pages and creative, checking permits and readiness, attributing leads, timing replies, detecting duplicates, spotting worn-out creative, blocking search terms that took money and returned nothing.</> },
              { k: 'Proposed for approval', v: <>Budget increases and reallocation, new keywords worth buying, reassignment of a lead, anything that changes what a live campaign costs.</> },
              { k: 'Only ever a person', v: <>Connecting an ad account, setting the spending limits, launching a campaign live, replacing a creative that is currently winning, deleting records.</> },
            ]}
          />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-px sm:grid-cols-3">
          <Card kicker="Why" title="Stopping is reversible">
            Blocking a wasteful search term or pausing an under-performing ad set can be undone in a
            click. That is why the system is allowed to do it without waiting for anyone.
          </Card>
          <Card kicker="Why" title="Starting is not">
            A new bid spends real money against a forecast rather than a measurement. Money already
            spent cannot be recalled, so a person decides.
          </Card>
          <Card kicker="Why" title="A decision you cannot read is a decision you cannot trust">
            Every automatic action is written down in ordinary language with its reason, in the same
            place the money is reconciled.
          </Card>
        </div>
      </Section>

      {/* ── Honest expectations ─────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="What to expect"
            title="Where the gains actually come from"
          />
          <div className="space-y-5">
            <P>
              The system does not make advertising cheap by finding a trick inside Meta or Google.
              The platforms are the same for everyone. What changes is the quality of what you put
              into them and the speed with which mistakes are caught.
            </P>
            <P>
              Three things move the number. Money stops going to listings that were never fit to
              carry it. Wasted search traffic is cut continuously rather than at the end of the
              quarter. And each campaign starts from the evidence the last one produced instead of
              from zero.
            </P>
            <P>
              None of that is instant. The feedback loop needs closed deals before it has anything to
              learn from, which in off-plan property means the first meaningful improvement arrives
              after the first cycle of real sales — not in week one.
            </P>
          </div>
        </div>
      </Band>

      <Section className="py-16 lg:py-24">
        <Callout>
          Every stage exists to protect one join: the money that was spent, and the deal that came
          out the other end.
        </Callout>
      </Section>

      <NextPages
        items={[
          { href: '/business/platform/inventory', label: 'Inventory', blurb: 'Where stage one happens, in detail.' },
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'The spend rules and the two platforms.' },
          { href: '/business/lead-machine', label: 'Lead Machine', blurb: 'The product that contains all of it.' },
        ]}
      />
    </>
  )
}
