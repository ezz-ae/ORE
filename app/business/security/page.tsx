import type { Metadata } from 'next'
import {
  Section, Band, Eyebrow, H2, H3, Lede, P, Card, SpecTable, Guardrail,
  Steps, SectionHeading, NextPages, Mono, Callout,
} from '@/components/business/ui'
import { TenantIsolation, SpendAuthority } from '@/components/business/diagrams'

export const metadata: Metadata = {
  title: 'Security & control',
  description:
    'How Entrestate separates one company’s data from another’s, what each role may see, how credentials are stored, and the checks that run before any change ships.',
  alternates: { canonical: '/business/security' },
}

export default function SecurityPage() {
  return (
    <>
      <Section className="pb-14 pt-16 lg:pb-20 lg:pt-24">
        <Eyebrow>Security &amp; control</Eyebrow>
        <div className="mt-5 max-w-[46rem]">
          <H2 className="!text-[2.6rem] sm:!text-[3.4rem] lg:!text-[3.8rem] !leading-[1.08]">
            Who can see what, and what can spend
          </H2>
        </div>
        <div className="mt-7 max-w-[64ch]">
          <Lede>
            Two questions decide whether software like this can be trusted with a brokerage:
            can another company reach my records, and can anything move money without my say-so.
            Both are answered below in terms you can verify rather than take on faith.
          </Lede>
        </div>
      </Section>

      {/* ── Isolation ───────────────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Separation"
          title="Your data is in its own database, not a shared table"
          lede={
            <Lede>
              Most multi-company software puts every customer&rsquo;s rows in the same tables and adds
              a column saying which company each row belongs to. That works right up until one query
              somewhere forgets to filter on that column.
            </Lede>
          }
        />
        <TenantIsolation className="mt-12" />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <P>
              Entrestate does not do that. Every company gets its own schema — its own set of tables
              inside the database. When a request arrives, the address it came in on decides which
              schema the connection is pointed at, before any query runs.
            </P>
            <P>
              The practical consequence: a query written for one company cannot name another
              company&rsquo;s table, because that table is not in the path it can see. Isolation
              does not depend on every query remembering to be careful. It is a property of the
              connection.
            </P>
          </div>
          <div className="space-y-5">
            <P>
              Underneath sits one shared, read-only reference: the market catalogue of projects,
              areas, developers and transaction history. Everyone reads the same market facts;
              nobody can write to them. When you edit a project, you are editing your own copy.
            </P>
            <P>
              An address with no company behind it, or one that has been suspended, does not fall
              back to a default — the request fails. There is no state in which the system
              &ldquo;guesses&rdquo; whose data you meant.
            </P>
          </div>
        </div>
        <div className="mt-12">
          <Guardrail
            title="Enforced, not documented"
            items={[
              <>A session is valid only on the address it was created for. A sign-in for one company is refused on another company&rsquo;s address, and on the public site, in both directions.</>,
              <>An unknown or suspended address fails closed. It never resolves to shared or default data.</>,
              <>Advertising credentials are stored per company. One company&rsquo;s connected ad account is never visible to, or usable by, another.</>,
              <>Automated tests run on every change to prove a second company cannot see the first company&rsquo;s people, leads or credentials.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Roles ───────────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Roles"
          title="Six roles, applied on every request"
          lede={
            <Lede>
              Roles here are not a menu that hides buttons. The same rule is applied again when the
              data is requested, so a link pasted to someone who should not have it returns nothing.
            </Lede>
          }
        />
        <div className="mt-12">
          <SpecTable
            caption="Who sees what"
            rows={[
              { k: 'Broker', v: <>Their own workspace: their leads, their campaigns, their credits, their assistant. No company-wide figures.</> },
              { k: 'Sales manager', v: <>The pipeline and team performance, assignment and approvals. Sees the floor they run.</> },
              { k: 'Marketing', v: <>Advertising, creative, the content engine, and the market and marketing analytics. May spend within limits.</> },
              { k: 'Director', v: <>Everything operational, including management reporting and finance.</> },
              { k: 'CEO', v: <>Everything, including governance and full reset rights.</> },
              { k: 'Admin', v: <>Everything, plus the settings that define the workspace itself.</> },
            ]}
          />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
          <Card kicker="Default" title="Closed unless opened">
            Every data request in the system is private by default. A new screen or endpoint is
            unreachable until someone deliberately makes it public, which is the safe direction for
            a system holding client contact details.
          </Card>
          <Card kicker="Money and PII" title="Narrower still">
            Launching or editing a campaign, and reading the personal details a lead form collected,
            are restricted to marketing and management. A broker can watch their campaigns without
            being able to change what they cost.
          </Card>
          <Card kicker="Machine access" title="Its own key">
            Scheduled jobs and integrations authenticate with their own secret rather than borrowing
            a person&rsquo;s session, so nothing runs unattended under a real user&rsquo;s name.
          </Card>
        </div>
      </Section>

      {/* ── Spend authority ─────────────────────────────────────────────── */}
      <Band className="bg-[#090B0E]">
        <SectionHeading
          eyebrow="Money"
          title="Nothing spends without a rule you wrote"
          lede={
            <Lede>
              The system can propose budget changes on its own. It cannot make them on its own. Every
              proposal passes the same gate, whether a person or the autopilot raised it.
            </Lede>
          }
        />
        <SpendAuthority className="mt-12" />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <P>
            The gate holds three limits you set: the most that may be spent in a day, the most that
            may move in any single change, and the quality floor below which a campaign may not
            receive more money. A proposal that fits is approved; one that exceeds a limit is reduced
            to it; one that breaks a floor is refused.
          </P>
          <P>
            Whatever the outcome, it is written into Finance in ordinary language with its reason
            attached — so the question &ldquo;why did this campaign&rsquo;s budget change on
            Tuesday&rdquo; has an answer that does not require anyone to reconstruct it.
          </P>
        </div>
        <div className="mt-12">
          <Guardrail
            items={[
              <>With no rules configured, the automatic side spends nothing at all. Absence of instruction is treated as &ldquo;no&rdquo;, never as &ldquo;use your judgement&rdquo;.</>,
              <>Google campaigns are always created paused. There is no path in which opening a screen starts a Google campaign spending.</>,
              <>A property with no valid advertising permit, or one whose permit has expired, cannot have campaigns or keywords built for it.</>,
              <>The automated side may block spend without asking, but never starts new spend without a person. Stopping waste is reversible in one click; starting a bid is not.</>,
            ]}
          />
        </div>
      </Band>

      {/* ── Credentials ─────────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Credentials"
            title="What happens to the keys you connect"
          />
          <div className="space-y-5">
            <P>
              When you connect Meta, Google, WhatsApp or HubSpot, the access token is encrypted
              before it is stored, using <Mono>AES-256-GCM</Mono> with a key derived from a secret
              held in the deployment environment rather than in the database. A copy of the database
              on its own does not yield a usable token.
            </P>
            <P>
              Credentials set in the environment always take precedence over ones entered in the
              app, so an operations team can hold production keys outside the product entirely and
              nobody with admin access inside can override them.
            </P>
            <P>
              Tokens are never displayed back after saving, never written to logs, and are scoped to
              the single company that connected them.
            </P>
          </div>
        </div>
      </Section>

      {/* ── Release discipline ──────────────────────────────────────────── */}
      <Band>
        <SectionHeading
          eyebrow="Before anything ships"
          title="Eighty-two checks that must pass"
          lede={
            <Lede>
              Every change to this system runs the same battery of automated checks. They are not
              only tests of whether code works — several exist specifically to stop the product
              claiming things that are not true.
            </Lede>
          }
        />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Types and translations',
                body: 'The whole codebase is type-checked, and every piece of text is confirmed to exist in all three languages. A missing Arabic string fails the build rather than showing an English word inside an Arabic screen.',
              },
              {
                title: 'The wording rules',
                body: 'A check scans for invented terminology and unsupported claims that were removed once before, and fails if any reappears anywhere in the product or its documentation.',
                detail: 'This exists because a documentation pass once described an architecture that did not exist. A reviewer who checks one claim and finds nothing stops believing the rest.',
              },
              {
                title: 'The access matrix',
                body: 'Every endpoint that has been deliberately made public is confirmed to still exist and to still carry its own protection. A public endpoint that lost its guard fails the build.',
              },
              {
                title: 'One route to the data',
                body: 'A check refuses any new code that opens its own database connection, because a connection created outside the standard path would not carry the company separation described above.',
              },
              {
                title: 'The behaviour tests',
                body: 'The remainder test the rules this site describes: that weak pages are blocked, that budgets respect their caps, that a lead is attributed to the right campaign, that the assistant cannot answer without evidence.',
              },
            ]}
          />
        </div>
        <div className="mt-14">
          <Callout>
            A rule that is written in a policy is a hope. A rule that fails the build is a
            guarantee.
          </Callout>
        </div>
      </Band>

      {/* ── Data handling ───────────────────────────────────────────────── */}
      <Section className="py-20 lg:py-28">
        <SectionHeading eyebrow="Your records" title="Where the data lives and who touches it" />
        <div className="mt-12">
          <SpecTable
            rows={[
              { k: 'Hosting', v: <>Deployed on managed infrastructure with the database in a managed Postgres cluster. Transport is encrypted end to end and certificate verification is enforced on the database connection.</> },
              { k: 'Ownership', v: <>Your records are yours. Leads, deals, documents and campaign history can be exported at any time.</> },
              { k: 'Passwords', v: <>Stored hashed, never recoverable. Reset is by time-limited emailed link.</> },
              { k: 'Sessions', v: <>Signed and time-limited — the working day by default, thirty days if you choose to be remembered. Signing out ends every session for that account.</> },
              { k: 'Audit', v: <>Sign-ins, assignment changes, approvals and automated budget decisions are recorded with who, what and when.</> },
              { k: 'Dedicated deployment', v: <>Companies that require it can run the entire system on their own server and their own database instead of the shared platform.</> },
            ]}
          />
        </div>
      </Section>

      <NextPages
        items={[
          { href: '/business/platform/intelligence', label: 'Intelligence', blurb: 'What the assistant is allowed to do, and what it is refused.' },
          { href: '/business/platform/advertising', label: 'Advertising', blurb: 'The spend rules in the place they actually apply.' },
          { href: '/business/getting-started', label: 'Getting started', blurb: 'What the first thirty days look like.' },
        ]}
      />
    </>
  )
}
