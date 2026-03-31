"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

const LeadFormPopup = dynamic(
  () => import("@/components/lead-form-popup").then((mod) => mod.LeadFormPopup),
  { ssr: false },
)

// Inline SVGs for Stability
const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
)
const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
)
const MessageCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
)

const mainLinks = [
  { href: "/", label: "Home", description: "Platform overview and market highlights." },
  { href: "/properties", label: "Properties", description: "Browse 3,655 live listings." },
  { href: "/projects", label: "Projects", description: "Master developments and launches." },
  { href: "/areas", label: "Areas", description: "Compare districts and demand." },
  { href: "/developers", label: "Developers", description: "Track records and delivery stats." },
  { href: "/blog", label: "Blog", description: "Investor insights and reports." },
  { href: "/chat", label: "AI Assistant", description: "Get a curated shortlist fast." },
  { href: "/market/trends", label: "Market Analysis", description: "Live market reports and forecasts." },
]

const marketLinks = [
  { href: "/market/trends", label: "Market Analysis", description: "Reports, analytics, and forecasts." },
  { href: "/market", label: "Market Hub", description: "Overview of Dubai market intelligence." },
  { href: "/market/why-dubai", label: "Why Dubai", description: "Investment case and macro advantages." },
  { href: "/market/areas", label: "Areas Guide", description: "Area-by-area comparison and insights." },
  { href: "/market/golden-visa", label: "Golden Visa", description: "Residency rules and eligibility." },
  { href: "/market/financing", label: "Financing", description: "Mortgage and payment plan options." },
  { href: "/market/regulations", label: "Regulations", description: "Legal framework for buyers." },
]

const toolsLinks = [
  { href: "/tools", label: "Tools Hub", description: "All investment tools in one place." },
  { href: "/tools/roi-calculator", label: "ROI Calculator", description: "Estimate returns and yield." },
  { href: "/tools/payment-simulator", label: "Payment Simulator", description: "Model payment plans quickly." },
  { href: "/tools/comparator", label: "Project Comparator", description: "Compare projects side by side." },
  { href: "/tools/ai-discovery", label: "AI Discovery", description: "Ask AI to find matches." },
  { href: "/tools/market-tracker", label: "Market Tracker", description: "Track performance by area." },
]

const companyLinks = [
  { href: "/about", label: "About", description: "Who we are and our mission." },
  { href: "/services", label: "Services", description: "Advisory and investment support." },
  { href: "/contact", label: "Contact", description: "Speak with the team." },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)
  const megaMenuWide = "w-[min(720px,92vw)] min-w-[360px] p-2"
  const megaMenuMedium = "w-[min(640px,92vw)] min-w-[340px] p-2"
  const megaMenuCompact = "w-[min(520px,92vw)] min-w-[320px] p-2"

  if (pathname?.startsWith("/crm") || pathname === "/chat") {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#152E24]/[0.06] bg-[#FAF8F5]/85 backdrop-blur-2xl h-16 transition-all duration-300 lg:h-[4.5rem]">
      <div className="container flex h-full items-center justify-between px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="group shrink-0 transition-opacity hover:opacity-80">
          <Image
            src="/ore-logo-gold.png"
            alt="ORE Real Estate"
            width={150}
            height={60}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#152E24]/[0.04] text-[#152E24]/60 hover:text-[#152E24] font-medium text-[13px] h-9 px-3">
                  Properties
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuWide}>
                  <div className="grid gap-1 p-3 md:grid-cols-2 bg-white rounded-xl">
                    {mainLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-lg border border-transparent p-3 transition hover:bg-[#152E24]/[0.03]"
                        >
                          <div className="text-sm font-semibold text-[#152E24]">{item.label}</div>
                          <div className="text-[11px] text-[#152E24]/40 mt-0.5">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#152E24]/[0.04] text-[#152E24]/60 hover:text-[#152E24] font-medium text-[13px] h-9 px-3">
                  Market Intelligence
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuWide}>
                  <div className="grid gap-1 p-3 md:grid-cols-2 bg-white rounded-xl">
                    {marketLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-lg border border-transparent p-3 transition hover:bg-[#152E24]/[0.03]"
                        >
                          <div className="text-sm font-semibold text-[#152E24]">{item.label}</div>
                          <div className="text-[11px] text-[#152E24]/40 mt-0.5">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#152E24]/[0.04] text-[#152E24]/60 hover:text-[#152E24] font-medium text-[13px] h-9 px-3">
                  Investment Tools
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuMedium}>
                  <div className="grid gap-1 p-3 md:grid-cols-2 bg-white rounded-xl">
                    {toolsLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-lg border border-transparent p-3 transition hover:bg-[#152E24]/[0.03]"
                        >
                          <div className="text-sm font-semibold text-[#152E24]">{item.label}</div>
                          <div className="text-[11px] text-[#152E24]/40 mt-0.5">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#152E24]/[0.04] text-[#152E24]/60 hover:text-[#152E24] font-medium text-[13px] h-9 px-3">
                  Company
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuCompact}>
                  <div className="grid gap-1 p-3 bg-white rounded-xl">
                    {companyLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-lg border border-transparent p-3 transition hover:bg-[#152E24]/[0.03]"
                        >
                          <div className="text-sm font-semibold text-[#152E24]">{item.label}</div>
                          <div className="text-[11px] text-[#152E24]/40 mt-0.5">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="rounded-full text-[#152E24]/50 hover:bg-[#152E24]/[0.04] h-9 w-9"
          >
            <a href="https://wa.me/971553308046" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <MessageCircleIcon />
            </a>
          </Button>
          <LeadFormPopup
            buttonLabel="Briefing"
            buttonClassName="hidden md:inline-flex ore-gradient h-9 px-5 rounded-lg text-[10px] uppercase font-semibold tracking-[0.12em] border-none"
            buttonSize="sm"
          />
          <Button asChild className="hidden md:inline-flex bg-[#152E24] hover:bg-[#152E24]/90 text-white rounded-lg h-9 px-5 text-[10px] uppercase font-semibold tracking-[0.12em]">
            <Link href="/chat">AI Assistant</Link>
          </Button>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-[#152E24] h-9 w-9">
                <MenuIcon />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-[360px] p-0 border-l border-[#152E24]/[0.06] bg-[#FAF8F5]">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col h-full bg-[#FAF8F5]">
                <div className="p-6 border-b border-[#152E24]/[0.06]">
                  <Link href="/" onClick={() => setIsOpen(false)} className="shrink-0">
                    <Image
                      src="/ore-logo-gold.png"
                      alt="ORE Real Estate"
                      width={160}
                      height={64}
                      className="h-9 w-auto"
                    />
                  </Link>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-6 space-y-8 pb-24">
                    {[
                      { title: "Properties", links: mainLinks },
                      { title: "Market", links: marketLinks },
                      { title: "Investment Tools", links: toolsLinks },
                      { title: "Our Firm", links: companyLinks }
                    ].map((section) => (
                      <div key={section.title} className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#152E24]/25 px-1">
                          {section.title}
                        </div>
                        <div className="grid gap-0.5">
                          {section.links.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsOpen(false)}
                              className="flex flex-col gap-0.5 rounded-xl p-3 text-sm font-medium transition-colors hover:bg-[#152E24]/[0.03] active:bg-[#152E24]/[0.06]"
                            >
                              <span className="text-[15px] text-[#152E24]">{item.label}</span>
                              <span className="text-[11px] font-normal text-[#152E24]/40 line-clamp-1">{item.description}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-6 border-t border-[#152E24]/[0.06] bg-white/50 backdrop-blur-xl">
                  <Button asChild className="w-full ore-gradient shadow-lg h-12 rounded-xl text-[11px] uppercase font-semibold tracking-[0.12em]" size="lg">
                    <Link href="/chat" onClick={() => setIsOpen(false)}>
                      <SparklesIcon />
                      <span className="ml-2">AI Intelligence Desk</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
