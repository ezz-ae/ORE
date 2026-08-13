import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H2, H3, Lede, P, Card, SpecTable,
  Guardrail, Callout, SectionHeading, NextPages, ButtonLink, Eyebrow, TextLink,
} from '@/components/business/ui'

export const metadata: Metadata = {
  title: 'Plans',
  description:
    'How Entrestate is charged: a monthly platform fee per workspace, a visible processing allowance, and your own ad spend paid directly to the platforms.',
  alternates: { canonical: '/business/pricing' },
}

/**
 * Commercial terms live here as data so a change is one line, in one place,
 * rather than scattered through the prose.
 */
const PLANS = [
  {
    name: 'Meta for Realtors',
    who: 'One agent',
    basis: 'Monthly membership',
    line: 'The advertising half, for a single desk.',
    includes: [
      'Meta campaigns built from your listings',
      'Every default set explicitly, permits enforced',
      'Leads attributed to the advertisement that produced them',
      'Your own Meta account and your own media budget',
    ],
    cta: { label: 'Talk to us', href: '/contact' },
  },
  {
    name: 'Lead Machine',
    who: 'A company with agents',
    basis: 'Monthly per workspace',
    line: 'The complete platform, on your own address.',
    includes: [
      'Every application: inventory, advertising, pages, creative, CRM, analytics, finance',
      'Your own address, your brand throughout, your own separate database',
      'Roles for agents, managers, marketing and directors',
      'English, Arabic and Russian',
    ],
    cta: { label: 'Start a 14-day trial', href: '/signup' },
    featured: true,
  },
  {
    name: 'Listing-to-Landing',
    who: 'Companies whose website is the shopfront',
    basis: 'Setup, then monthly',
    line: 'The public website and catalogue, plus everything in Lead Machine.',
    includes: [
      'Your public property site on your own domain',
      'Catalogue, search, area and developer guides',
      'Enquiries landing in the CRM already attributed',
      'The full management desk behind it',
    ],
    cta: { label: 'Talk to us', href: '/contact' },
  },
]

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Plans"
        title="What it costs, and what drives the cost"
        lede={
          <>
            Three products, three commercial shapes. The parts that vary by company — team size,
            how much advertising you run, whether you need your own server — are listed here rather
            than hidden behind a call.
          </>
        }
        meta={[
          { k: 'Platform fee', v: 'Monthly, per workspace' },
          { k: 'Ad spend', v: 'Paid by you, direct to Meta and Google' },
          { k: 'Trial', v: '14 days, no card' },
        ]}
      />

      {/* ── Plans ───────────────────────────────────────────────────────── */}
      <Section className="pb-20">
        <div className="grid grid-cols-1 gap-px lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col p-8 outline outline-1 ${
                p.featured
                  ? 'bg-[#0E1013] outline-[#D4AF37]/40'
                  : 'bg-[#0C0E11] outline-white/[0.07]'
              }`}
            >
              <Eyebrow>{p.who}</Eyebrow>
              <H3 className="mt-4 !text-[1.25rem]">{p.name}</H3>
              <p className="mt-2.5 text-[0.9375rem] leading-[1.65] text-[#9BA1A9]">{p.line}</p>
              <div className="mt-6 border-y border-white/[0.07] py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[#D4AF37]">
                {p.basis}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {p.includes.map((i) => (
                  <li key={i} className="flex gap-3 text-[0.875rem] leading-[1.6] text-[#9BA1A9]">
                    <span aria-hidden className="mt-[0.6em] h-px w-2.5 shrink-0 bg-[#4A5058]" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <ButtonLink href={p.cta.href} variant={p.featured ? 'primary' : 'ghost'}>
                  {p.cta.label}
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── What drives cost ────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="The arithmetic"
          title="Three separate things, kept separate"
          lede={
            <Lede>
              Most confusion about what software like this costs comes from bundling these together.
              They are billed apart because they behave differently.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            rows={[
              {
                k: 'The platform fee',
                v: <>A fixed monthly amount for the workspace. It does not move with how many leads you receive or how many campaigns you run, so it is predictable in a budget.</>,
              },
              {
                k: 'Processing allowance',
                v: <>The work the assistant does — drafting, generating creative, building reports, analysing — draws on a monthly allowance shown on a screen inside the product, with the balance and the rate of use visible. A heavy month is visible while it is happening, not on an invoice afterwards.</>,
              },
              {
                k: 'Your advertising spend',
                v: <>Paid by you, directly to Meta and Google, on your own billing. It never passes through us, and we take no percentage of it. The system applies the limits you set to money that is already yours.</>,
              },
            ]}
          />
        </div>
        <div className="mt-10">
          <P className="max-w-[70ch]">
            The third line is the one worth reading twice. An agency that takes a percentage of your
            media budget is paid more when you spend more. Nothing here is arranged that way.
          </P>
        </div>
      </Band>

      {/* ── Dedicated ───────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="For larger companies"
            title="Your own deployment"
            lede={
              <Lede>
                Companies that cannot put their records on a shared platform — for internal policy,
                for a client agreement, or because they simply prefer it — can run the whole system
                on their own server and their own database.
              </Lede>
            }
          />
          <div className="space-y-5">
            <P>
              The software is identical. What changes is where it lives: your infrastructure, your
              database, your backups, your access controls, and a custom domain rather than a
              subdomain.
            </P>
            <P>
              This is arranged as a setup and a monthly agreement, with an option to move toward
              owning the deployment outright over the term rather than renting it indefinitely.
            </P>
            <P>
              It is worth having this conversation early if it applies to you, because it affects
              how the first month is planned.{' '}
              <TextLink href="/contact">Ask about a dedicated deployment</TextLink>.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Included everywhere ─────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading eyebrow="Included in every plan" title="Not sold as an upgrade" />
        <div className="mt-12 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
          <Card kicker="Included" title="Every role">
            Access is decided by role, not by licence count. Adding a manager does not change what
            the system costs.
          </Card>
          <Card kicker="Included" title="All three languages">
            English, Arabic and Russian, with right-to-left layout. Not a paid localisation module.
          </Card>
          <Card kicker="Included" title="Your own database">
            Separation is structural, not a premium tier. Every workspace gets its own schema.
          </Card>
          <Card kicker="Included" title="The spending controls">
            Caps, quality floors and the written record of every automatic decision. These are the
            product, not an add-on.
          </Card>
          <Card kicker="Included" title="Export">
            Your leads, deals, documents and campaign history, out, whenever you want them.
          </Card>
          <Card kicker="Included" title="The market reference">
            Projects, areas, developers and transaction history, kept current for everyone.
          </Card>
        </div>
      </Band>

      {/* ── Straight answers ────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading eyebrow="Before you ask" title="The questions that come up" />
          <Guardrail
            title="Straight answers"
            items={[
              <><span className="text-white">Do you take a cut of ad spend?</span> No. You pay Meta and Google directly and we never touch that money.</>,
              <><span className="text-white">Is there a setup fee for Lead Machine?</span> No. It is self-served and the workspace exists within a minute.</>,
              <><span className="text-white">What happens at the end of a trial?</span> It stops. Nothing is charged automatically because no card was taken.</>,
              <><span className="text-white">Can we export and leave?</span> Yes, at any time, with your records intact. Nothing is withheld to keep a subscription alive.</>,
              <><span className="text-white">Do we need an agency as well?</span> Not for the mechanics. You will still want someone who knows your market making the judgement calls.</>,
            ]}
          />
        </div>
      </Section>

      <Section className="pb-16 lg:pb-24">
        <Callout>
          The cost that matters is not the licence. It is the budget that went to a listing which was
          never fit to carry it.
        </Callout>
      </Section>

      <NextPages
        items={[
          { href: '/business/getting-started', label: 'Getting started', blurb: 'What the first thirty days look like.' },
          { href: '/business/lead-machine', label: 'Lead Machine', blurb: 'What the main product contains.' },
          { href: '/business/security', label: 'Security & control', blurb: 'How separation and spending limits work.' },
        ]}
      />
    </>
  )
}
