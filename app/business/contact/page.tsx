import type { Metadata } from 'next'
import {
  Section, Band, PageHeader, H3, Lede, P, Card, SpecTable,
  SectionHeading, NextPages, Mono, TextLink,
} from '@/components/business/ui'
import { BRAND } from '@/lib/freehold/brand'
import { ContactForm } from './_form'

export const metadata: Metadata = {
  title: 'Talk to us',
  description:
    'Ask about running Entrestate for your company — a dedicated deployment, a public website, or moving an existing team across.',
  alternates: { canonical: '/business/contact' },
}

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Talk to us"
        title="Tell us what you run today"
        lede={
          <>
            The useful first conversation is about your inventory, your team and whatever you are
            using now — not about features. If you would rather see the software before speaking to
            anyone, start a trial and come back with questions.
          </>
        }
        meta={[
          { k: 'Reply', v: 'Within one working day' },
          { k: 'Based in', v: 'Dubai, UAE' },
          { k: 'No trial needed', v: 'to ask a question' },
        ]}
      />

      <Section className="pb-20 lg:pb-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20">
          <ContactForm />

          <div className="space-y-8">
            <div>
              <H3>Directly</H3>
              <p className="mt-3 text-[0.9375rem] leading-[1.7] text-[#9BA1A9]">
                A form is slower than an email. If you already know what you want to ask, write to{' '}
                <TextLink href={`mailto:${BRAND.email}`}>
                  <Mono>{BRAND.email}</Mono>
                </TextLink>{' '}
                and it reaches the same people.
              </p>
            </div>

            <div>
              <H3>What to include</H3>
              <p className="mt-3 text-[0.9375rem] leading-[1.7] text-[#9BA1A9]">
                Roughly how many agents you have, how many projects you sell, and what happens to a
                lead today between arriving and being called. Those three answers decide almost
                everything about how a move would work.
              </p>
            </div>

            <Card kicker="Faster than asking" title="Start a trial instead">
              A workspace exists within a minute and costs nothing. Most questions about whether the
              software fits are answered better by opening it than by a call.{' '}
              <TextLink href="/signup">Start one</TextLink>.
            </Card>
          </div>
        </div>
      </Section>

      <Band>
        <SectionHeading
          eyebrow="Before you write"
          title="Questions we can answer here"
          lede={<Lede>If one of these is what you were going to ask, the answer is already written down.</Lede>}
        />
        <div className="mt-12">
          <SpecTable
            rows={[
              { k: 'What does it cost?', v: <>The three commercial models are set out on the <TextLink href="/business/pricing">plans page</TextLink>. Ad spend is always paid by you, directly to Meta and Google.</> },
              { k: 'Can we run it on our own server?', v: <>Yes. A dedicated deployment runs the same software on your infrastructure and your database. Mention it in the form and it changes how the first month is planned.</> },
              { k: 'How long does moving take?', v: <>Four weeks is the realistic sequence, and the second week is the heavy one. It is described honestly on <TextLink href="/business/getting-started">getting started</TextLink>.</> },
              { k: 'Is our data separate from other companies?', v: <>Each company gets its own database schema, not a shared table with a company column. The mechanism is explained on <TextLink href="/business/security">security</TextLink>.</> },
              { k: 'Do you take a percentage of ad spend?', v: <>No. It never passes through us.</> },
            ]}
          />
        </div>
      </Band>

      <NextPages
        items={[
          { href: '/business/pricing', label: 'Plans', blurb: 'The three commercial models.' },
          { href: '/business/getting-started', label: 'Getting started', blurb: 'What the first thirty days look like.' },
          { href: '/business/lead-machine', label: 'Lead Machine', blurb: 'The product most companies start with.' },
        ]}
      />
    </>
  )
}
