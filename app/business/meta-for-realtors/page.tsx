import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H2, H3, Lede, P, Card, SpecTable,
  Guardrail, Steps, Callout, SectionHeading, NextPages, ButtonLink, Mono,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Meta for Realtors',
  description:
    'Meta advertising run properly for a single agent: campaigns built from your listings, leads that arrive attributed, and hard limits on what can spend.',
  alternates: { canonical: '/business/meta-for-realtors' },
}

export default function MetaForRealtorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Product · Meta for Realtors"
        title="Facebook and Instagram, run the way an agency should run them"
        lede={
          <>
            The advertising half of the platform, on its own, for one agent. You connect your own
            Meta account, the campaigns are built from your listings, and the leads come back with
            the advertisement that produced them attached. What you are buying is the discipline —
            the settings that are opted out, the limits that hold, and the checks that stop a bad
            campaign before it spends.
          </>
        }
        meta={[
          { k: 'For', v: 'Individual agents' },
          { k: 'Platforms', v: 'Facebook · Instagram' },
          { k: 'Billing', v: 'Membership; ad spend is yours' },
          { k: 'Setup', v: 'Connect your own ad account' },
        ]}
      />

      {/* ── The problem ─────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Why this exists"
            title="Boosting a post is not advertising"
          />
          <div className="space-y-5">
            <P>
              An agent with a good listing has three options today. Boost the post and hope. Learn
              Ads Manager, which is a full-time job that changes every quarter. Or pay an agency a
              retainer to run campaigns you cannot inspect, whose reports arrive monthly and whose
              leads land in a spreadsheet.
            </P>
            <P>
              All three fail in the same place. Meta&rsquo;s defaults are built to spend a budget,
              not to protect it — automatic audience expansion, automatic creative alterations,
              placements you never chose. Left as they arrive, they will take a property budget and
              distribute it across surfaces and people you would never have picked.
            </P>
            <P>
              This product is the opposite of a boost button. It sets what should be off, holds the
              limits you give it, and refuses to launch a campaign that would waste your money.
            </P>
          </div>
        </div>
      </Band>

      {/* ── What it turns off ───────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Defaults"
          title="What is switched off before anything runs"
          lede={
            <Lede>
              These are the settings an experienced buyer changes by hand on every campaign, and
              which an inexperienced one never finds. Here they are the starting position.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="Set explicitly on every campaign"
            rows={[
              {
                k: 'Audience expansion',
                v: <>Off. Meta will not widen past the audience you chose, so the targeting you approved is the targeting that runs.</>,
              },
              {
                k: 'Creative alterations',
                v: <>All thirteen of Meta&rsquo;s creative enhancements are opted out one by one, because the single umbrella switch no longer exists. Your advertisement runs as it was approved.</>,
              },
              {
                k: 'Placements',
                v: <>Named in full: Instagram Feed, Instagram Stories, Instagram Reels, Facebook Feed. Nothing is left to the platform&rsquo;s discretion.</>,
              },
              {
                k: 'Audience Network',
                v: <>Never bought. Property budgets do not belong in third-party app inventory.</>,
              },
              {
                k: 'Launch state',
                v: <>Paused by default, so the full lead round-trip can be tested with a Meta test lead before real money moves.</>,
              },
            ]}
          />
        </div>
        <div className="mt-10">
          <P className="max-w-[70ch]">
            Omitting any of these fields is how an account gets enrolled in them automatically. They
            are written on every campaign rather than assumed.
          </P>
        </div>
      </Section>

      {/* ── What it does ────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="The work"
          title="What happens when you advertise a property"
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'The campaign is built from the listing',
                body: 'Targeting, budget, structure and the full creative set are produced from the property record itself — the same prices, plans and images the buyer will see on the page.',
              },
              {
                title: 'It is checked before it can launch',
                body: 'The permit must be valid and unexpired. The landing page must exist and be published. The requested language must resolve to real Meta locales. Any of these failing stops the launch instead of quietly changing what you asked for.',
                detail: 'A campaign pointed at a page that does not exist produces no symptom except “no leads”, and gets misdiagnosed as a bad audience for weeks.',
              },
              {
                title: 'The bid is sanity-checked',
                body: 'A cost cap below AED 30 per result is refused. A cap that cannot win the auction leaves an ad set showing “Active” while delivering nothing, and a bid cap cannot be changed after launch — the only exit is starting again.',
              },
              {
                title: 'Leads arrive attributed, not anonymous',
                body: 'The enquiry lands with the campaign and the project attached, and is pulled through a deduplicated path so the same person filling in a form twice does not become two leads.',
              },
              {
                title: 'Results are read honestly',
                body: 'Absent figures are shown as absent rather than as zero. Lead counts come from one canonical calculation that never double-counts Meta’s overlapping lead events.',
                detail: 'Summing those overlapping events once turned 24 real leads into a reported 120. It is an easy mistake and an expensive one.',
              },
            ]}
          />
        </div>
      </Band>

      {/* ── Audiences ───────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Audiences"
            title="Built from real buyers, with a floor"
            lede={
              <Lede>
                The strongest audience available to you is people who resemble those who actually
                bought. That is only true if it is built from enough of them.
              </Lede>
            }
          />
          <div className="space-y-5">
            <P>
              A lookalike audience is refused below <Mono>100</Mono> matched contacts and a custom
              audience below <Mono>20</Mono>. Instead of building something that will quietly
              underperform, the shortfall is stated plainly: an account with twenty-six leads has no
              lookalike available to it at any level of cleverness.
            </P>
            <P>
              When contact data does go to Meta, only <Mono>SHA-256</Mono> hashes leave — email and
              phone, nothing else. No names, no notes, no ratings, no readable identifiers. Meta
              matches on equality and has no need of the legible values. Nothing is uploaded without
              an explicit confirmation each time.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Permits ─────────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Compliance"
            title="Permits are enforced, not reminded"
          />
          <div className="space-y-5">
            <P>
              Advertising a Dubai property without a valid Trakheesi permit is a regulatory breach,
              not a best-practice note. A campaign will not launch against an expired permit, and a
              campaign whose permit lapses while it is running is stopped.
            </P>
            <P>
              Budget freed by a permit stop is deliberately not moved elsewhere. Not spending is
              always compliant; reallocating in a hurry is how the same problem reappears on another
              listing.
            </P>
            <P>
              A missing permit number or a missing expiry date is treated differently from an expired
              one. Absence of evidence is raised as a loud warning rather than used to stop a
              campaign, because refusing on a blank field would be its own kind of wrong.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Limits ──────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading eyebrow="Before you sign up" title="What this does not do" />
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <Guardrail
            items={[
              <>It does not spend on your behalf. You connect your own Meta account and the media budget is billed to you by Meta, not by us.</>,
              <>It will not raise a budget on its own without a rule you wrote, and it will not raise one at all where there is no cost-per-lead signal to justify it.</>,
              <>It does not replace a creative that is currently winning, and it does not narrow a live campaign&rsquo;s placements on its own. Both are reported for you to decide.</>,
              <>It does not guess at Meta errors. An error it cannot identify is shown in Meta&rsquo;s own words rather than given a confident and possibly wrong explanation.</>,
              <>It is not the full company platform. Team pipelines, finance and management reporting live in Lead Machine.</>,
            ]}
          />
          <div className="space-y-6">
            <Card kicker="What you still do" title="The judgement stays yours">
              Which property to advertise, how much to risk, when to stop, and who to call first.
              The system removes the errors that cost money silently; it does not replace an
              agent&rsquo;s read of their own market.
            </Card>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/business/pricing">See membership</ButtonLink>
              <ButtonLink href="/business/platform/advertising" variant="ghost">
                The full advertising detail
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <Section className="pb-16 lg:pb-24">
        <Callout>
          Most money lost on property advertising is not lost to a competitor. It is lost to a
          setting nobody switched off.
        </Callout>
      </Section>

      <NextPages
        items={[
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'Every rule, both platforms, in full.' },
          { href: '/business/lead-machine', label: 'Lead Machine', blurb: 'If you run a team rather than a desk.' },
          { href: '/business/pricing', label: 'Plans', blurb: 'What each product costs.' },
        ]}
      />
    </>
  )
}
