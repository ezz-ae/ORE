import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H2, H3, Lede, P, Card, Grid, SpecTable,
  Guardrail, Steps, Callout, SectionHeading, NextPages, ButtonLink, Eyebrow,
} from '@/components/business/ui'
import { SystemLoop } from '@/components/business/diagrams'
import { PLATFORM } from '@/lib/business/nav'

export const metadata: Metadata = {
  title: 'Lead Machine',
  description:
    'The complete platform on your own address: inventory, advertising, landing pages, CRM, analytics and finance for a real-estate company and its agents.',
  alternates: { canonical: '/business/lead-machine' },
}

export default function LeadMachinePage() {
  return (
    <>
      <PageHeader
        eyebrow="Product · Lead Machine"
        title="The whole system, under your own name"
        lede={
          <>
            Lead Machine is the complete platform for a company with agents. It runs at your own
            address, carries your logo and your company name on every screen, and holds your
            inventory, your campaigns, your pipeline and your numbers in one database that your team
            signs into once.
          </>
        }
        meta={[
          { k: 'For', v: 'Companies with agents' },
          { k: 'Runs at', v: 'yourname.entrestate.com' },
          { k: 'Trial', v: '14 days, no card' },
          { k: 'Languages', v: 'English · العربية · Русский' },
        ]}
      />

      {/* ── What you get ────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="What arrives"
            title="A working company system, not an empty account"
          />
          <div className="space-y-5">
            <P>
              Most software of this kind hands you a blank database and a setup guide. The first week
              is spent typing in your own stock before anyone can judge whether the thing is any
              good.
            </P>
            <P>
              A Lead Machine workspace opens with the market already in it: projects, areas and
              developers, loaded and ready to work with. You edit them into your own inventory rather
              than creating one from nothing. Every screen has something real on it on the first
              afternoon.
            </P>
            <P>
              Nothing is connected to a live ad account until you connect one yourself. You can build
              campaigns, generate pages, and walk your team through the whole flow before a single
              dirham is at risk.
            </P>
          </div>
        </div>
      </Band>

      {/* ── Three people ────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Who uses it"
          title="Three people, three different systems, one database"
          lede={
            <Lede>
              An agent, a sales manager and an owner want completely different things from the same
              records. Each signs into a workspace built for their job, and none of them can see
              what they should not.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-px lg:grid-cols-3">
          <Card kicker="The agent" title="A day of calls, not admin">
            Their own leads, ranked by who is worth ringing now. Call and WhatsApp on the row itself.
            The full history of a lead — what they enquired about, which advertisement produced them,
            what was said last time — on one screen. Their own campaigns and their own credit
            balance. They never see another agent&rsquo;s pipeline.
          </Card>
          <Card kicker="The sales manager" title="The floor, in order">
            Who owns what, what is overdue and by whom, how fast the first reply went out, which
            leads nobody has touched. Assignment and reassignment in one place. Approvals for the
            things that need a second pair of eyes. Team performance without exporting anything.
          </Card>
          <Card kicker="The owner" title="The month, without assembling it">
            Money in and money out on the same page: commission earned, spend by category, cost per
            lead, what is outstanding. Which projects are producing and which are absorbing budget.
            One report, generated, with the figures traceable back to the rows they came from.
          </Card>
        </div>
      </Section>

      {/* ── The loop ────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="How the parts connect"
          title="One sequence, end to end"
          lede={
            <Lede>
              Each application below is a full product in its own right. The reason to have them
              together is that the record does not break as it passes between them.
            </Lede>
          }
        />
        <SystemLoop className="mt-12" />
        <div className="mt-12">
          <Grid cols={2} className="bg-white/[0.07]">
            {PLATFORM.map((f) => (
              <div key={f.href} className="bg-[#0A0C0F] p-7">
                <H3>{f.label}</H3>
                <p className="mt-2.5 text-[0.9375rem] leading-[1.65] text-[#8F959D]">{f.blurb}</p>
              </div>
            ))}
          </Grid>
        </div>
      </Band>

      {/* ── Your name ───────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Your brand"
            title="Nobody inside sees ours"
          />
          <div className="space-y-5">
            <P>
              From the first sign-in, the system is yours. Your company name in the wordmark, your
              logo in the header, your colour on every control, your address in the browser bar. An
              agent using it day to day has no reason to know which company built it.
            </P>
            <P>
              This is deliberate, and it is enforced rather than styled: the vendor&rsquo;s own
              marketing — including the page you are reading — does not exist inside a company
              workspace. It returns nothing there.
            </P>
            <P>
              The same applies to what you send outward. Landing pages, brochures, reports and lead
              emails carry your identity, not a platform badge.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Getting live ────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="From trial to live"
          title="What actually happens, in order"
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Choose your address and your brand',
                body: 'Company name, the subdomain you want, your logo and your colour. The workspace is created with your own separate database and you land inside it, signed in, on the same screen.',
                detail: 'This takes under a minute. Nothing else is required to start looking around.',
              },
              {
                title: 'Make the inventory yours',
                body: 'Work through the projects you actually sell — prices, payment plans, handover dates, media. The data-quality view shows exactly what is missing and what that prevents.',
                detail: 'A property with gaps is not blocked from existing; it is blocked from being advertised until the gaps that matter are filled.',
              },
              {
                title: 'Add your team',
                body: 'Invite agents and managers and give each a role. What each person can see and do follows from that role everywhere in the system, not screen by screen.',
              },
              {
                title: 'Connect the accounts you already have',
                body: 'Meta, Google, WhatsApp, your email. Until an account is connected the corresponding screens work but stay empty rather than showing invented figures.',
              },
              {
                title: 'Set the rules before switching anything on',
                body: 'The maximum that may be spent in a day, the maximum any single change may move, and the quality floor. Until these exist, nothing spends automatically.',
              },
              {
                title: 'Publish, launch, and watch',
                body: 'Generate the landing pages, build the first campaigns, and put them live. Leads arrive attributed to the campaign that produced them, and the first reply is timed from the moment they land.',
              },
            ]}
          />
        </div>
      </Band>

      {/* ── Limits ──────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Straight answers"
            title="What this is not"
            lede={
              <Lede>
                Worth knowing before a trial rather than after, so nobody spends a fortnight
                discovering it.
              </Lede>
            }
          />
          <Guardrail
            title="Honest limits"
            items={[
              <>It is built for UAE real estate. The inventory model, the permit rules and the market reference assume that market. It is not a general-purpose CRM.</>,
              <>It does not buy media for you. You connect your own Meta and Google accounts and the spend is yours, on your billing, under limits you set.</>,
              <>It will not advertise a property that has no valid advertising permit, even if you ask it to.</>,
              <>The automatic side stops waste without asking, but does not start new spend without a person approving it.</>,
              <>Figures are shown when they are known and left out when they are not. Screens will look emptier than a demo until your own data is in.</>,
            ]}
          />
        </div>
      </Section>

      {/* ── Cost ────────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <H2>What it costs to run</H2>
            <div className="mt-6 max-w-[52ch] space-y-5">
              <P>
                The platform is charged monthly per workspace. The work the assistant does —
                drafting, generating, analysing — draws on a monthly allowance of processing you can
                see and top up, so an unusually heavy month is visible rather than a surprise.
              </P>
              <P>
                Companies that need the system on their own server, with their own database and
                their own controls, can take a dedicated deployment instead of the shared platform.
              </P>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/signup">Start a trial</ButtonLink>
              <ButtonLink href="/business/pricing" variant="ghost">See the plans</ButtonLink>
            </div>
          </div>
          <SpecTable
            caption="At a glance"
            rows={[
              { k: 'Setup', v: <>Self-serve. The workspace exists within a minute of the form.</> },
              { k: 'Your address', v: <>A subdomain you pick. A custom domain can be arranged on a dedicated deployment.</> },
              { k: 'Team size', v: <>No fixed seat limit on the trial. Roles decide access, not licences.</> },
              { k: 'Ad spend', v: <>Paid by you, to Meta and Google directly. The platform never handles your media money.</> },
              { k: 'Your data', v: <>Exportable at any time. Leads, deals, documents and campaign history.</> },
              { k: 'Leaving', v: <>Cancel and export. Nothing is held hostage to keep you subscribed.</> },
            ]}
          />
        </div>
      </Band>

      <Section className="py-16 lg:py-24">
        <Callout>
          The point of putting all of this in one place is not tidiness. It is that the cost of a
          lead and the value of the deal it became are finally in the same sentence.
        </Callout>
      </Section>

      <NextPages
        items={[
          { href: '/business/how-it-works', label: 'How it works', blurb: 'The full path from a listing to a closed deal, in order.' },
          { href: '/business/security', label: 'Security & control', blurb: 'Roles, separation, and what can spend money.' },
          { href: '/business/getting-started', label: 'Getting started', blurb: 'What the first thirty days look like.' },
        ]}
      />
    </>
  )
}
