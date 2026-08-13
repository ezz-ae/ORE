/**
 * The business site's typographic and layout primitives.
 *
 * The rules this design follows, so fifteen pages read as one document:
 *   • One accent colour, used for emphasis and nothing else.
 *   • Display type is the serif already loaded for the brand; body is Inter;
 *     anything that is DATA (a limit, a field name, a route) is mono, because
 *     the eye should be able to tell a claim from a value.
 *   • Every page states what a thing does before it states that it is good.
 *   • A section that cannot be explained without adjectives is cut.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

/* ── Layout ─────────────────────────────────────────────────────────────── */

export function Section({
  children,
  className = '',
  bleed = false,
}: {
  children: ReactNode
  className?: string
  /** Full-width band (own background) rather than the standard column. */
  bleed?: boolean
}) {
  if (bleed) return <section className={`w-full ${className}`}>{children}</section>
  return (
    <section className={`mx-auto w-full max-w-[1180px] px-6 lg:px-10 ${className}`}>{children}</section>
  )
}

export function Band({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full border-y border-white/[0.07] ${className}`}>
      <div className="mx-auto w-full max-w-[1180px] px-6 py-20 lg:px-10 lg:py-28">{children}</div>
    </div>
  )
}

export function Grid({
  children,
  cols = 3,
  className = '',
}: {
  children: ReactNode
  cols?: 2 | 3 | 4
  className?: string
}) {
  const map = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return <div className={`grid grid-cols-1 gap-px overflow-hidden ${map[cols]} ${className}`}>{children}</div>
}

/* ── Type ───────────────────────────────────────────────────────────────── */

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A9099] ${className}`}>
      {children}
    </div>
  )
}

export function Display({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`font-serif text-[2.6rem] leading-[1.08] tracking-[-0.02em] text-white sm:text-[3.4rem] lg:text-[4rem] ${className}`}
    >
      {children}
    </h1>
  )
}

export function H2({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`font-serif text-[1.9rem] leading-[1.15] tracking-[-0.015em] text-white sm:text-[2.4rem] ${className}`}
    >
      {children}
    </h2>
  )
}

export function H3({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-[1.0625rem] font-semibold leading-snug text-white ${className}`}>{children}</h3>
  )
}

export function Lede({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[1.125rem] leading-[1.65] text-[#A8AEB6] sm:text-[1.1875rem] ${className}`}>
      {children}
    </p>
  )
}

export function P({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[0.9375rem] leading-[1.75] text-[#9BA1A9] ${className}`}>{children}</p>
}

/** A value, a field name, a route — anything the reader might need to quote. */
export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[0.85em] text-[#C9CDD3] ${className}`} dir="ltr">
      {children}
    </span>
  )
}

/* ── Page furniture ─────────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  lede,
  meta,
}: {
  eyebrow: string
  title: ReactNode
  lede: ReactNode
  /** Short factual pairs shown under the lede — the page's own spec sheet. */
  meta?: Array<{ k: string; v: string }>
}) {
  return (
    <Section className="pb-14 pt-16 lg:pb-20 lg:pt-24">
      <Eyebrow>{eyebrow}</Eyebrow>
      {/* Width is set in rem, not ch: a `ch` on this wrapper resolves against
          the wrapper's 16px font rather than the display type inside it, which
          collapses the headline to about a third of the intended measure. */}
      <div className="mt-5 max-w-[44rem]">
        <Display>{title}</Display>
      </div>
      <div className="mt-7 max-w-[62ch]">
        <Lede>{lede}</Lede>
      </div>
      {meta?.length ? (
        <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-5 border-t border-white/[0.07] pt-7">
          {meta.map(({ k, v }) => (
            <div key={k}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6E747C]">{k}</dt>
              <dd className="mt-1.5 text-[0.9375rem] text-white">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  className = '',
}: {
  eyebrow?: string
  title: ReactNode
  lede?: ReactNode
  className?: string
}) {
  return (
    <div className={`max-w-[64ch] ${className}`}>
      {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
      <H2>{title}</H2>
      {lede ? <div className="mt-5">{lede}</div> : null}
    </div>
  )
}

/* ── Content blocks ─────────────────────────────────────────────────────── */

export function Card({
  title,
  children,
  kicker,
  className = '',
}: {
  title?: ReactNode
  kicker?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-[#0C0E11] p-7 outline outline-1 outline-white/[0.07] ${className}`}>
      {kicker ? <Eyebrow className="mb-3">{kicker}</Eyebrow> : null}
      {title ? <H3 className="mb-3">{title}</H3> : null}
      <div className="text-[0.9375rem] leading-[1.7] text-[#9BA1A9]">{children}</div>
    </div>
  )
}

/**
 * A specification table. Enterprise readers skim for values, not prose —
 * this is where the numbers live so they can be found without reading.
 */
export function SpecTable({
  rows,
  caption,
}: {
  rows: Array<{ k: string; v: ReactNode }>
  caption?: string
}) {
  return (
    <div className="overflow-hidden outline outline-1 outline-white/[0.07]">
      {caption ? (
        <div className="border-b border-white/[0.07] bg-[#0C0E11] px-6 py-3.5">
          <Eyebrow>{caption}</Eyebrow>
        </div>
      ) : null}
      <dl className="divide-y divide-white/[0.06]">
        {rows.map(({ k, v }) => (
          <div key={k} className="grid grid-cols-1 gap-1.5 bg-[#0A0C0F] px-6 py-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8">
            <dt className="text-[0.875rem] font-medium text-[#C9CDD3]">{k}</dt>
            <dd className="text-[0.875rem] leading-[1.65] text-[#8F959D]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * What the system refuses to do.
 *
 * This block exists because it is the most useful thing an operations buyer
 * can read. Anyone can list capabilities; a limit is a commitment, and a
 * system that publishes its limits is one you can plan around.
 */
export function Guardrail({
  title = 'What it will not do',
  items,
}: {
  title?: string
  items: ReactNode[]
}) {
  return (
    <div className="border-l-2 border-[#D4AF37] bg-[#0E1013] py-6 pl-7 pr-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#D4AF37]">{title}</div>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[0.9375rem] leading-[1.7] text-[#A8AEB6]">
            <span aria-hidden className="mt-[0.62em] h-px w-3 shrink-0 bg-[#4A5058]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A numbered sequence where order is the point. */
export function Steps({
  steps,
}: {
  steps: Array<{ title: string; body: ReactNode; detail?: ReactNode }>
}) {
  return (
    <ol className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {steps.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-x-5 py-7 sm:grid-cols-[3.5rem_1fr] sm:gap-x-8">
          <div className="font-mono text-[0.8125rem] tabular-nums text-[#D4AF37]" dir="ltr">
            {String(i + 1).padStart(2, '0')}
          </div>
          <div>
            <H3>{s.title}</H3>
            <div className="mt-2.5 max-w-[68ch] text-[0.9375rem] leading-[1.7] text-[#9BA1A9]">{s.body}</div>
            {s.detail ? (
              <div className="mt-4 border-l border-white/10 pl-5 text-[0.875rem] leading-[1.7] text-[#7C838B]">
                {s.detail}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="bg-[#0C0E11] p-7 outline outline-1 outline-white/[0.07]">
      <div className="font-mono text-[2rem] leading-none tabular-nums text-white" dir="ltr">
        {value}
      </div>
      <div className="mt-3 text-[0.875rem] font-medium text-[#C9CDD3]">{label}</div>
      {note ? <div className="mt-1.5 text-[0.8125rem] leading-relaxed text-[#7C838B]">{note}</div> : null}
    </div>
  )
}

/** A pull-out that carries one idea the page is built around. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="border-y border-white/[0.07] py-10">
      <p className="font-serif text-[1.5rem] leading-[1.45] tracking-[-0.01em] text-white sm:text-[1.75rem]">
        {children}
      </p>
    </div>
  )
}

/* ── Links ──────────────────────────────────────────────────────────────── */

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-white underline decoration-[#D4AF37]/50 underline-offset-[5px] transition hover:decoration-[#D4AF37]"
    >
      {children}
    </Link>
  )
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'ghost'
}) {
  const base =
    'inline-flex items-center gap-2 px-6 py-3 text-[0.875rem] font-semibold transition'
  const styles =
    variant === 'primary'
      ? 'bg-[#D4AF37] text-black hover:bg-[#E5C351]'
      : 'text-white outline outline-1 outline-white/20 hover:outline-white/40'
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
      <span aria-hidden>→</span>
    </Link>
  )
}

/** The "read this next" rail every page ends with. */
export function NextPages({ items }: { items: Array<{ href: string; label: string; blurb: string }> }) {
  return (
    <Section className="py-16 lg:py-24">
      <Eyebrow className="mb-8">Continue</Eyebrow>
      <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="group bg-[#0C0E11] p-7 outline outline-1 outline-white/[0.07] transition hover:bg-[#101317]"
          >
            <div className="flex items-baseline justify-between gap-4">
              <H3>{i.label}</H3>
              <span aria-hidden className="text-[#D4AF37] opacity-0 transition group-hover:opacity-100">
                →
              </span>
            </div>
            <p className="mt-2.5 text-[0.875rem] leading-[1.65] text-[#8F959D]">{i.blurb}</p>
          </Link>
        ))}
      </div>
    </Section>
  )
}
