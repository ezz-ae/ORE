"use client"

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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
)
const LinkedinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
)
const MessageCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
)
const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
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
    <footer className="w-full bg-[#163327] border-t border-white/5 pt-20 pb-10 text-white">
      <div className="container px-6 max-w-7xl mx-auto">
        <div className="grid gap-16 lg:grid-cols-[1.4fr,2fr]">
          <div className="space-y-10">
            <Link href="/" className="inline-flex flex-col group leading-none">
              <span className="font-serif text-5xl font-bold tracking-tighter text-white group-hover:text-primary transition-colors uppercase">
                ORE
              </span>
              <span className="text-[12px] font-bold tracking-[0.5em] text-primary -mt-1 uppercase">
                REAL ESTATE
              </span>
            </Link>
            
            <p className="text-[15px] text-white/60 leading-relaxed max-w-md text-pretty font-light">
              Pioneering private real estate intelligence. Delivering curated Dubai projects and boutique investment services for global convictions.
            </p>

            <div className="space-y-5">
              <div className="flex items-start gap-4 text-[14px] text-white/90 group">
                <div className="h-10 w-10 shrink-0 rounded-full border border-white/10 flex items-center justify-center group-hover:border-primary transition-colors">
                  <MapPinIcon />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <span className="font-bold text-[10px] uppercase tracking-widest text-primary">Headquarters</span>
                  <span className="leading-snug">Office 38 floor, Building The One Tower,<br/>Dubai Media City, Sheikh Zayed Road, Dubai</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[14px] text-white/90 group">
                <div className="h-10 w-10 shrink-0 rounded-full border border-white/10 flex items-center justify-center group-hover:border-primary transition-colors">
                  <PhoneIcon />
                </div>
                <div className="flex flex-col gap-1">
                   <span className="font-bold text-[10px] uppercase tracking-widest text-primary">Intelligence Desk</span>
                   <span>+971 4 580 8244</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[14px] text-white/90 group">
                <div className="h-10 w-10 shrink-0 rounded-full border border-white/10 flex items-center justify-center group-hover:border-primary transition-colors">
                  <MailIcon />
                </div>
                <div className="flex flex-col gap-1">
                   <span className="font-bold text-[10px] uppercase tracking-widest text-primary">Secure Channel</span>
                   <span>info@orerealestate.ae</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
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
                  className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all hover:-translate-y-1"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-12 sm:grid-cols-3">
            {footerLinks.map((section) => (
              <div key={section.title} className="space-y-8">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/40">
                  {section.title}
                </h4>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[14px] text-white/60 transition-colors hover:text-primary font-medium"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            
            <div className="space-y-8">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/40">
                Briefing
              </h4>
              <div className="space-y-5">
                <p className="text-[12px] text-white/40 leading-relaxed italic">
                  Join our weekly institutional project briefing.
                </p>
                <div className="flex flex-col gap-3">
                  <Input 
                    placeholder="E-mail" 
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl focus:border-primary/50" 
                  />
                  <LeadFormPopup buttonClassName="ore-gradient border-none h-12 w-full rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 border-t border-white/5 pt-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <p className="text-[10px] text-white/20 tracking-[0.2em] font-medium uppercase text-center md:text-left">
              © {new Date().getFullYear()} ORE Real Estate · RERA ORN: 28628 · Media City HQ · DUBAI
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 md:gap-10">
              <Link href="/privacy" className="transition-colors hover:text-primary">Privacy Policy</Link>
              <Link href="/terms" className="transition-colors hover:text-primary">Terms & Conditions</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
