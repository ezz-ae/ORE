'use client'

/**
 * The business site's own chrome.
 *
 * Deliberately separate from the product's marketing header: this site talks
 * to operators and owners about a system, not to buyers about apartments, and
 * sharing a navigation would confuse both audiences.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NAV_GROUPS, PRODUCTS, PLATFORM, COMPANY } from '@/lib/business/nav'

function Wordmark() {
  return (
    <Link href="/business" className="group flex items-baseline gap-2.5" aria-label="Entrestate for Business">
      <span className="font-serif text-[1.25rem] leading-none tracking-[-0.01em] text-white">Entrestate</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A9099] transition group-hover:text-[#D4AF37]">
        Business
      </span>
    </Link>
  )
}

export function BusinessHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState<string | null>(null)
  const [mobile, setMobile] = useState(false)

  // Route change closes everything — a menu left open across a navigation is
  // the most common way these headers feel broken.
  useEffect(() => {
    setOpen(null)
    setMobile(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#07090C]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-6 lg:px-10">
        <Wordmark />

        <nav className="hidden items-center gap-1 lg:flex" onMouseLeave={() => setOpen(null)}>
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="relative" onMouseEnter={() => setOpen(g.label)}>
              <button
                type="button"
                onClick={() => setOpen(open === g.label ? null : g.label)}
                aria-expanded={open === g.label}
                className={`px-4 py-2 text-[0.875rem] transition ${
                  open === g.label ? 'text-white' : 'text-[#A8AEB6] hover:text-white'
                }`}
              >
                {g.label}
              </button>
              {open === g.label ? (
                <div className="absolute left-0 top-full w-[26rem] border border-white/[0.09] bg-[#0A0C0F] p-2 shadow-2xl shadow-black/60">
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      className="block px-4 py-3 transition hover:bg-white/[0.04]"
                    >
                      <div className="text-[0.875rem] font-medium text-white">{i.label}</div>
                      <div className="mt-1 text-[0.8125rem] leading-snug text-[#8A9099]">{i.blurb}</div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/server"
            className="hidden text-[0.875rem] text-[#A8AEB6] transition hover:text-white sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-[#D4AF37] px-4 py-2 text-[0.8125rem] font-semibold text-black transition hover:bg-[#E5C351]"
          >
            Start a trial
          </Link>
          <button
            type="button"
            onClick={() => setMobile((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobile}
            className="p-2 text-white lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {mobile ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {mobile ? (
        <div className="border-t border-white/[0.07] bg-[#0A0C0F] lg:hidden">
          <div className="mx-auto max-h-[70vh] w-full max-w-[1180px] overflow-y-auto px-6 py-6">
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="mb-7">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6E747C]">
                  {g.label}
                </div>
                <div className="space-y-1">
                  {g.items.map((i) => (
                    <Link key={i.href} href={i.href} className="block py-2 text-[0.9375rem] text-white">
                      {i.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  )
}

export function BusinessFooter() {
  const cols: Array<{ label: string; items: typeof PRODUCTS }> = [
    { label: 'Products', items: PRODUCTS },
    { label: 'Platform', items: PLATFORM },
    { label: 'Company', items: COMPANY },
  ]
  return (
    <footer className="border-t border-white/[0.07] bg-[#07090C]">
      <div className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Wordmark />
            <p className="mt-4 max-w-[28ch] text-[0.8125rem] leading-relaxed text-[#7C838B]">
              Software for real-estate companies in the UAE. Built and run in Dubai.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.label}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6E747C]">{c.label}</div>
              <ul className="mt-4 space-y-2.5">
                {c.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} className="text-[0.875rem] text-[#A8AEB6] transition hover:text-white">
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.07] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-[#6E747C]">
            © {new Date().getFullYear()} Entrestate. Dubai, United Arab Emirates.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-[0.8125rem] text-[#6E747C] transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="text-[0.8125rem] text-[#6E747C] transition hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
