import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H2, H3, Lede, P, Card, SpecTable,
  Guardrail, Steps, Callout, SectionHeading, NextPages, ButtonLink, Eyebrow,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Getting started',
  description:
    'What the first thirty days look like: the trial, moving your records in, connecting accounts, and the first campaign that spends real money.',
  alternates: { canonical: '/business/getting-started' },
}

export default function GettingStartedPage() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="The first thirty days, honestly"
        lede={
          <>
            Nobody moves a brokerage onto new software in an afternoon. This is the sequence that
            works, what each week actually demands of your team, and the two points where most
            migrations stall. Read it before you start rather than after.
          </>
        }
        meta={[
          { k: 'Time to first screen', v: 'Under a minute' },
          { k: 'Time to first live campaign', v: 'Usually week three' },
          { k: 'Your effort', v: 'Heaviest in week two' },
        ]}
      />

      {/* ── Day one ─────────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Day one"
            title="Everything is real except the spending"
          />
          <div className="space-y-5">
            <P>
              The trial creates your workspace, your address and your own database while you wait.
              The market reference is already loaded, so the inventory, the search and the pages have
              something real in them from the first screen.
            </P>
            <P>
              What is not connected is the money. No ad account is linked, so no campaign can spend.
              This is deliberate — it lets you walk the entire path, including launching campaigns
              and generating pages, with nothing at risk while people are still learning where things
              are.
            </P>
            <P>
              Spend the first day looking around rather than configuring. The parts that matter later
              — inventory quality, roles, spending limits — are easier to decide once you have seen
              what they affect.
            </P>
          </div>
        </div>
      </Band>

      {/* ── The four weeks ──────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The sequence"
          title="Four weeks, in the order that works"
          lede={
            <Lede>
              The order matters more than the speed. Each week depends on the one before it, and
              skipping ahead is what produces a live campaign pointing at a page nobody checked.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Week one — the shape of your business',
                body: 'Decide which projects you actually sell and get them into the inventory properly: prices, payment plans, handover dates, permits, media. Add your team and give each person a role. Nothing is advertised this week.',
                detail: 'The data-quality view is the week-one worklist. It names exactly what is missing on each property and what that missing field prevents — start at the top and work down.',
              },
              {
                title: 'Week two — your records move in',
                body: 'Bring your existing leads across. They arrive deduplicated against each other, with unreachable rows reported rather than silently dropped. Historic contacts land in the same pipeline your team will use tomorrow.',
                detail: 'This is the heaviest week and the one most likely to stall. A brokerage with several thousand historic leads should expect a day of genuine attention, not an hour.',
              },
              {
                title: 'Week three — pages and tracking',
                body: 'Generate the landing pages for the properties you intend to advertise, and fix whatever the readiness check blocks. Connect Meta, Google and WhatsApp. Set the spending limits — the daily maximum, the maximum any single change may move, and the quality floor.',
                detail: 'The limits must exist before anything goes live. Until they do, the automatic side is not permitted to spend at all, which is the correct default but a confusing one if you did not expect it.',
              },
              {
                title: 'Week four — the first real campaign',
                body: 'Launch against a property that passed every check, with a test lead pushed through first to confirm the whole round trip: click, page, form, CRM, attribution, alert. Then watch it rather than adjusting it.',
                detail: 'Resist the urge to optimise in the first week of a campaign. The delivery system needs a few days before its numbers mean anything, and a campaign changed daily never produces a readable result.',
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Where it stalls ─────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Two honest warnings"
          title="Where these migrations actually fail"
        />
        <div className="mt-12 grid grid-cols-1 gap-px lg:grid-cols-2">
          <Card kicker="Failure one" title="Nobody owns the inventory">
            The system will keep telling you which properties are unfit to advertise, and it is
            usually right. If no single person is responsible for fixing those gaps, the list grows,
            the team starts ignoring it, and campaigns get launched against the properties that are
            easy rather than the ones that are ready. Name the owner in week one.
          </Card>
          <Card kicker="Failure two" title="The old habits run in parallel">
            If leads continue arriving in a WhatsApp group as well as the CRM, the CRM will always be
            the incomplete copy — and every figure it produces will be wrong in a way nobody can
            explain. Pick the switchover date in week two and make it real.
          </Card>
        </div>
      </Band>

      {/* ── What we need ────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="What to have ready"
          title="Bring these and the first week is short"
        />
        <div className="mt-12">
          <SpecTable
            caption="Checklist"
            rows={[
              { k: 'Your project list', v: <>The developments you actually sell, with prices, payment plans and handover dates. A spreadsheet is fine.</> },
              { k: 'Permit numbers', v: <>The Trakheesi permit and expiry for anything you intend to advertise. Without these, advertising is blocked — correctly.</> },
              { k: 'Your lead history', v: <>Exported from whatever holds it today. Phone or email per row is the minimum for a row to be usable.</> },
              { k: 'Your team list', v: <>Names, emails and what each person should be allowed to see.</> },
              { k: 'Ad account access', v: <>Admin on the Meta business account and the Google Ads account you intend to use.</> },
              { k: 'Your brand', v: <>Logo, and the colour you want carried across every screen.</> },
              { k: 'Your spending limits', v: <>The most you are willing to spend in a day, and the most any single change may move.</> },
            ]}
          />
        </div>
      </Section>

      {/* ── Support ─────────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="What you get from us"
            title="During the first month"
          />
          <div className="space-y-5">
            <P>
              The product is built to be self-served, and most of it is. The parts where a
              conversation genuinely helps are the inventory decisions in week one and the ad-account
              connection in week three, and we would rather have those two conversations properly
              than send a welcome sequence.
            </P>
            <P>
              Inside the product there is a guided tour on each screen the first time it is opened,
              and an assistant that can be asked what a screen is for. The written guide covers each
              application in the same plain terms this site uses.
            </P>
            <P>
              For a dedicated deployment, or a company moving several offices at once, setup is
              planned with you before anything begins.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Expectations ────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading eyebrow="Setting expectations" title="What month one will and will not show" />
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <Guardrail
            title="Be realistic"
            items={[
              <>Month one gives you a clean pipeline, attributed leads, and campaigns that cannot spend outside your limits. That alone is usually worth the move.</>,
              <>It does not give you a cheaper cost per lead yet. The feedback loop needs closed deals before it has anything to learn from.</>,
              <>Screens will look emptier than a demonstration until your own history is in. This is the system declining to invent figures, not a fault.</>,
              <>The first month will surface problems in your data that existed before the software arrived. That is uncomfortable and it is the point.</>,
            ]}
          />
          <div className="space-y-6">
            <Card kicker="When the loop starts paying" title="After the first cycle of sales">
              The audiences built from closed deals only become useful once there are closed deals to
              build them from. In off-plan property that is a matter of months, not weeks — and it is
              the reason the second quarter usually reads better than the first.
            </Card>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/signup">Start a trial</ButtonLink>
              <ButtonLink href="/business/contact" variant="ghost">Talk it through first</ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <Section className="pb-16 lg:pb-24">
        <Callout>
          The first month is not about advertising better. It is about being able to see what you
          were already doing.
        </Callout>
      </Section>

      <NextPages
        items={[
          { href: '/business/lead-machine', label: 'Lead Machine', blurb: 'What you are actually starting.' },
          { href: '/business/pricing', label: 'Plans', blurb: 'What it costs once the trial ends.' },
          { href: '/business/how-it-works', label: 'How it works', blurb: 'The full path, stage by stage.' },
        ]}
      />
    </>
  )
}
