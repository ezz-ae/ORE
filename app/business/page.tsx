import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Section, Band, Eyebrow, Display, H2, H3, Lede, P, Card, Grid, Stat,
  SpecTable, Guardrail, Callout, ButtonLink, TextLink, SectionHeading,
} from '@/components/business/ui'
import { SystemLoop } from '@/components/business/diagrams'
import { PRODUCTS, PLATFORM } from '@/lib/business/nav'

export const metadata: Metadata = {
  // Absolute: this page names the whole site, so it must not inherit the
  // product site's "| Freehold Property UAE" suffix from the root layout.
  title: { absolute: 'Entrestate for Business — software for real-estate companies' },
  description:
    'The system a real-estate company runs on: inventory, landing pages, Meta and Google campaigns, CRM, and the reporting that ties spend to closed deals.',
  alternates: { canonical: '/business' },
}

export default function BusinessHome() {
  return (
    <>
      {/* ── Opening ─────────────────────────────────────────────────────── */}
      <Section className="pb-16 pt-20 lg:pb-24 lg:pt-32">
        <Eyebrow>Entrestate for Business</Eyebrow>
        <div className="mt-6 max-w-[50rem]">
          <Display>Everything between a listing and a closed deal.</Display>
        </div>
        <div className="mt-8 max-w-[68ch]">
          <Lede>
            Entrestate is the software a real-estate company runs its day on — the inventory it
            advertises, the pages and campaigns that carry it, the leads that come back, and the
            record of what each one was worth. One database, one sign-in, and one set of rules about
            who may see what and what may spend money.
          </Lede>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/signup">Start a 14-day trial</ButtonLink>
          <ButtonLink href="/business/how-it-works" variant="ghost">
            See how it works
          </ButtonLink>
        </div>
        <p className="mt-6 text-[0.8125rem] text-[#6E747C]">
          No card. Your company gets its own address and its own database on the first screen.
        </p>
      </Section>

      {/* ── The situation ───────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Where the money leaks"
            title="Six systems that do not speak to each other"
          />
          <div className="space-y-6">
            <P>
              A typical firm keeps its stock in a spreadsheet or a portal, buys landing pages from an
              agency, runs ads inside Meta&rsquo;s own manager, collects leads in a CRM or a WhatsApp
              group, tracks spend in a second spreadsheet, and assembles a report by hand at the end
              of the month.
            </P>
            <P>
              Each of those is fine on its own. Together they lose the single connection that decides
              whether a marketing budget was worth spending: <span className="text-white">which
              money produced which deal</span>. The lead arrives with no memory of the ad that made
              it. The campaign ends and takes what it learned with it. The next campaign starts from
              nothing, and the month after that the same audience is bought again at the same price.
            </P>
            <P>
              This is not a discipline problem. It is what happens when the systems are separate:
              nobody can join the records, so nobody does.
            </P>
          </div>
        </div>
      </Band>

      {/* ── The spine ───────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="The shape of it"
          title="One line of work, and a return path"
          lede={
            <Lede>
              Everything in Entrestate sits on one sequence. A property in your inventory becomes a
              page, the page carries a campaign, the campaign produces a lead, the lead becomes a
              deal that is won or lost for a stated reason.
            </Lede>
          }
        />
        <SystemLoop className="mt-14" />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            The dotted return is the part that is normally missing. When a deal closes, the people
            who actually bought are handed back to the ad platforms as the seed for who to look for
            next — so the audience narrows toward buyers who resemble your real customers rather than
            the ones a platform guessed at in week one.
          </P>
          <P>
            That is the whole mechanism. There is nothing mystical in it: it works because the lead,
            the campaign that produced it, and the deal it became are rows in the same database that
            can be joined. Most of what this product does is keep that join intact and act on it.
          </P>
        </div>
      </Section>

      {/* ── Products ────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Three ways to buy it"
          title="One system, sold in the shape you need"
          lede={
            <Lede>
              The same engine underneath. What differs is how much of it you run and who operates
              it.
            </Lede>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-px lg:grid-cols-3">
          {[
            {
              ...PRODUCTS[0],
              who: 'Companies with agents',
              body: 'The complete platform on your own address, under your own name. Your inventory, your team, your campaigns, your pipeline, your numbers. Agents get their own workspace; managers get the desk above it.',
              how: 'Self-serve. 14-day trial.',
            },
            {
              ...PRODUCTS[1],
              who: 'Companies that need a public face',
              body: 'Your public website and property catalogue — the pages buyers land on, the search they use, the enquiry forms — with the full management desk and CRM behind it.',
              how: 'Set up with you, on request.',
            },
            {
              ...PRODUCTS[2],
              who: 'Individual agents',
              body: 'The advertising half on its own: campaigns built, launched, watched and corrected on Meta, without hiring an agency or learning Ads Manager.',
              how: 'Membership.',
            },
          ].map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col bg-[#0C0E11] p-8 outline outline-1 outline-white/[0.07] transition hover:bg-[#101317]"
            >
              <Eyebrow>{p.who}</Eyebrow>
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <H3 className="!text-[1.25rem]">{p.label}</H3>
                <span aria-hidden className="text-[#D4AF37] opacity-0 transition group-hover:opacity-100">→</span>
              </div>
              <p className="mt-3.5 flex-1 text-[0.9375rem] leading-[1.7] text-[#9BA1A9]">{p.body}</p>
              <div className="mt-6 border-t border-white/[0.07] pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[#8A9099]">
                {p.how}
              </div>
            </Link>
          ))}
        </div>
      </Band>

      {/* ── Platform ────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="What is inside"
          title="Seven parts, one database"
          lede={
            <Lede>
              Each part is a full application in its own right, and each one is documented in plain
              language — what it does, how it works, and where its limits are.
            </Lede>
          }
        />
        <Grid cols={2} className="mt-12 bg-white/[0.07]">
          {PLATFORM.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group bg-[#0A0C0F] p-7 transition hover:bg-[#101317]"
            >
              <div className="flex items-baseline justify-between gap-4">
                <H3>{f.label}</H3>
                <span aria-hidden className="text-[#D4AF37] opacity-0 transition group-hover:opacity-100">→</span>
              </div>
              <p className="mt-2.5 text-[0.9375rem] leading-[1.65] text-[#8F959D]">{f.blurb}</p>
            </Link>
          ))}
        </Grid>
      </Section>

      {/* ── Rules ───────────────────────────────────────────────────────── */}
      <Band>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="How it behaves"
              title="The rules it keeps when nobody is watching"
              lede={
                <Lede>
                  Software that spends money and holds client data should be judged on what it
                  refuses to do. These are enforced in the system itself, not in a policy document.
                </Lede>
              }
            />
          </div>
          <div className="space-y-4">
            <Guardrail
              title="Fixed behaviour"
              items={[
                <>
                  <span className="text-white">No rule, no spend.</span> Money moves only inside
                  limits a person wrote — a maximum per day, a maximum per single move, a quality
                  floor. With no rule in place, nothing is spent automatically.
                </>,
                <>
                  <span className="text-white">A weak page cannot be advertised.</span> A landing
                  page missing the things a buyer needs is blocked from launch rather than quietly
                  carrying budget.
                </>,
                <>
                  <span className="text-white">No invented numbers.</span> A price, yield or figure
                  is shown when it is known and left out when it is not. Estimates are labelled as
                  estimates.
                </>,
                <>
                  <span className="text-white">Closed by default.</span> Every request is private
                  unless it has been explicitly opened, and a role never receives data it is not
                  entitled to — including through a direct link.
                </>,
                <>
                  <span className="text-white">Every automatic decision is written down,</span> in
                  ordinary language, with the reason attached, in the place where money is
                  reconciled.
                </>,
              ]}
            />
          </div>
        </div>
      </Band>

      {/* ── Facts ───────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Operating facts"
          title="What is actually built"
          lede={<Lede>Figures from the system itself, not a brochure.</Lede>}
        />
        <div className="mt-12 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="171" label="Working screens" note="Not modules or tabs — distinct screens people use." />
          <Stat value="3" label="Languages" note="English, العربية, Русский. Arabic flips the interface right-to-left." />
          <Stat value="6" label="Roles" note="Enforced on every screen and every data request." />
          <Stat value="82" label="Checks before release" note="Automated tests that must pass for any change to ship." />
        </div>
        <div className="mt-14">
          <Callout>
            The measure of this system is not how much it can do. It is whether the number on the
            report is one you would defend in a meeting.
          </Callout>
        </div>
      </Section>

      {/* ── Start ───────────────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <H2>Start where it makes sense</H2>
            <div className="mt-6 max-w-[52ch]">
              <P>
                A trial gives you the whole platform on your own address, with the market catalogue
                already loaded, so the first screen has something real in it. Nothing is connected to
                a live ad account until you connect it yourself.
              </P>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/signup">Start a trial</ButtonLink>
              <ButtonLink href="/business/getting-started" variant="ghost">
                What the first month looks like
              </ButtonLink>
            </div>
          </div>
          <SpecTable
            caption="What a trial includes"
            rows={[
              { k: 'Your own address', v: <>A subdomain you choose, carrying your name and your logo everywhere inside.</> },
              { k: 'Your own database', v: <>A separate schema. No other company&rsquo;s records are reachable from it.</> },
              { k: 'Market reference', v: <>Projects, areas and developers, loaded and ready to edit as your own.</> },
              { k: 'Every application', v: <>Inventory, advertising, pages, creative, CRM, analytics, finance.</> },
              { k: 'Live spend', v: <>Off until you connect an ad account. The rest of the system works without one.</> },
              { k: 'Length', v: <>14 days.</> },
            ]}
          />
        </div>
      </Band>

      {/* ── Footer rail ─────────────────────────────────────────────────── */}
      <Section className="py-16 lg:py-20">
        <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <P className="!text-[0.875rem]">
            Questions about running this for a company of your size?{' '}
            <TextLink href="/contact">Talk to us</TextLink>.
          </P>
          <div className="flex gap-6 text-[0.875rem]">
            <TextLink href="/business/security">Security &amp; control</TextLink>
            <TextLink href="/business/pricing">Plans</TextLink>
          </div>
        </div>
      </Section>
    </>
  )
}
