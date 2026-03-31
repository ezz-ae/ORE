"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LeadFormPopup } from "@/components/lead-form-popup"

// Inline SVGs for Stability
const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
)
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
)
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
)
const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
)
const LinkedinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
)
const MessageCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
)
const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
)

const footerLinks = [
  {
    title: "Platform",
    links: [
      { href: "/", label: "Home" },
      { href: "/properties", label: "Properties" },
      { href: "/projects", label: "Projects" },
      { href: "/chat", label: "AI Assistant" },
      { href: "/areas", label: "Area Profiles" },
    ],
  },
  {
    title: "Market",
    links: [
      { href: "/market/trends", label: "Market Analysis" },
      { href: "/market/areas", label: "Area Guide" },
      { href: "/market/golden-visa", label: "Golden Visa" },
      { href: "/market/regulations", label: "Regulations" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/blog", label: "Insights" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
]

export function SiteFooter() {
  const pathname = usePathname()

  if (pathname?.startsWith("/crm") || pathname === "/chat") {
    return null
  }

  return (
    <footer className="w-full bg-[#0A1F17] border-t border-white/[0.04] pt-16 pb-10 text-white">
      <div className="container px-6 max-w-7xl mx-auto">
        <div className="grid gap-14 lg:grid-cols-[1.4fr,2fr]">
          <div className="space-y-8">
            <Link href="/" className="inline-flex group transition-opacity hover:opacity-85">
              <Image
                src="/ore-logo-white.png"
                alt="ORE Real Estate"
                width={210}
                height={84}
                className="h-12 w-auto sm:h-14"
              />
            </Link>

            <p className="max-w-sm text-[14px] leading-relaxed text-white/58">
              Pioneering private real estate intelligence. Delivering curated Dubai projects and boutique investment services for global investors.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5 text-[13px] text-white/70 group">
                <div className="h-9 w-9 shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.04] flex items-center justify-center text-white/40 group-hover:text-[#D4AC50] transition-colors">
                  <MapPinIcon />
                </div>
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="font-semibold text-[10px] uppercase tracking-[0.15em] text-[#D4AC50]">Headquarters</span>
                  <span className="leading-snug text-white/65">Office 38 floor, The One Tower,<br/>Dubai Media City, Sheikh Zayed Road</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 text-[13px] text-white/70 group">
                <div className="h-9 w-9 shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.04] flex items-center justify-center text-white/40 group-hover:text-[#D4AC50] transition-colors">
                  <PhoneIcon />
                </div>
                <div className="flex flex-col gap-0.5">
                   <span className="font-semibold text-[10px] uppercase tracking-[0.15em] text-[#D4AC50]">Intelligence Desk</span>
                   <span className="text-white/65">+971 4 580 8244</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 text-[13px] text-white/70 group">
                <div className="h-9 w-9 shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.04] flex items-center justify-center text-white/40 group-hover:text-[#D4AC50] transition-colors">
                  <MailIcon />
                </div>
                <div className="flex flex-col gap-0.5">
                   <span className="font-semibold text-[10px] uppercase tracking-[0.15em] text-[#D4AC50]">Secure Channel</span>
                   <span className="text-white/65">info@orerealestate.ae</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              {[
                { icon: <FacebookIcon />, href: "https://www.facebook.com/Orerealestate/" },
                { icon: <InstagramIcon />, href: "https://www.instagram.com/ore.realestate/" },
                { icon: <LinkedinIcon />, href: "https://www.linkedin.com/company/ore-real-estate-l-l-c/" },
                { icon: <MessageCircleIcon />, href: "https://wa.me/971553308046" }
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/60 transition-all hover:bg-white/[0.08] hover:text-[#D4AC50]"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {footerLinks.map((section) => (
              <div key={section.title} className="space-y-6">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[13px] font-medium text-white/68 transition-colors hover:text-[#D4AC50]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="space-y-6">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
                Briefing
              </h4>
              <div className="space-y-4">
                <p className="text-[12px] leading-relaxed text-white/55">
                  Join our weekly institutional project briefing.
                </p>
                <div className="flex flex-col gap-2.5">
                  <Input
                    placeholder="E-mail"
                    className="h-10 rounded-lg border-white/[0.1] bg-white/[0.06] text-white placeholder:text-white/35 focus:border-[#C69B3E]/30 text-sm"
                  />
                  <LeadFormPopup buttonClassName="ore-gradient h-10 w-full rounded-lg border-none text-[11px] text-[#152E24]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/[0.04] pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <p className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-white/35 md:text-left">
              &copy; {new Date().getFullYear()} ORE Real Estate &middot; RERA ORN: 28628 &middot; Media City HQ &middot; DUBAI
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/38 md:gap-8">
              <Link href="/privacy" className="transition-colors hover:text-[#D4AC50]">Privacy Policy</Link>
              <Link href="/terms" className="transition-colors hover:text-[#D4AC50]">Terms & Conditions</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
