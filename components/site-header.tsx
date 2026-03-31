"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
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
    <header className="sticky top-0 z-50 w-full border-b border-[#163327]/5 bg-[#FBF9F6]/80 backdrop-blur-xl h-20 transition-all duration-300">
      <div className="container flex h-20 items-center justify-between px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex flex-col group leading-none shrink-0 transition-opacity hover:opacity-90">
          <span className="font-serif text-3xl font-bold tracking-tighter text-[#163327] group-hover:text-[#C5A059] transition-colors uppercase">
            ORE
          </span>
          <span className="text-[10px] font-bold tracking-[0.4em] text-[#C5A059] uppercase -mt-0.5">
            REAL ESTATE
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-2">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#163327]/05 text-[#163327]/70 hover:text-[#163327] font-medium text-sm">
                  Properties
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuWide}>
                  <div className="grid gap-2 p-3 md:grid-cols-2 bg-[#FBF9F6]">
                    {mainLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-xl border border-transparent p-3 transition hover:border-[#163327]/10 hover:bg-[#163327]/05"
                        >
                          <div className="text-sm font-semibold text-[#163327]">{item.label}</div>
                          <div className="text-[11px] text-[#163327]/50">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#163327]/05 text-[#163327]/70 hover:text-[#163327] font-medium text-sm">
                  Market Intelligence
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuWide}>
                  <div className="grid gap-2 p-3 md:grid-cols-2 bg-[#FBF9F6]">
                    {marketLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-xl border border-transparent p-3 transition hover:border-[#163327]/10 hover:bg-[#163327]/05"
                        >
                          <div className="text-sm font-semibold text-[#163327]">{item.label}</div>
                          <div className="text-[11px] text-[#163327]/50">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#163327]/05 text-[#163327]/70 hover:text-[#163327] font-medium text-sm">
                  Investment Tools
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuMedium}>
                  <div className="grid gap-2 p-3 md:grid-cols-2 bg-[#FBF9F6]">
                    {toolsLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-xl border border-transparent p-3 transition hover:border-[#163327]/10 hover:bg-[#163327]/05"
                        >
                          <div className="text-sm font-semibold text-[#163327]">{item.label}</div>
                          <div className="text-[11px] text-[#163327]/50">{item.description}</div>
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent hover:bg-[#163327]/05 text-[#163327]/70 hover:text-[#163327] font-medium text-sm">
                  Company
                </NavigationMenuTrigger>
                <NavigationMenuContent className={megaMenuCompact}>
                  <div className="grid gap-2 p-3 bg-[#FBF9F6]">
                    {companyLinks.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-xl border border-transparent p-3 transition hover:border-[#163327]/10 hover:bg-[#163327]/05"
                        >
                          <div className="text-sm font-semibold text-[#163327]">{item.label}</div>
                          <div className="text-[11px] text-[#163327]/50">{item.description}</div>
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
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="rounded-full border border-[#163327]/10 text-[#163327]/60 hover:bg-[#163327]/05 h-10 w-10"
          >
            <a href="https://wa.me/971553308046" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <MessageCircleIcon />
            </a>
          </Button>
          <LeadFormPopup
            buttonLabel="Briefing"
            buttonClassName="hidden md:inline-flex ore-gradient h-10 px-6 rounded-full text-[10px] uppercase font-bold tracking-widest border-none"
            buttonSize="sm"
          />
          <Button asChild className="hidden md:inline-flex bg-[#163327] hover:bg-[#163327]/90 text-white rounded-full h-10 px-6 text-[10px] uppercase font-bold tracking-widest">
            <Link href="/chat">AI Assistant</Link>
          </Button>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-[#163327]">
                <MenuIcon />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-[360px] p-0 border-l border-[#163327]/10 bg-[#FBF9F6]">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col h-full bg-[#FBF9F6]">
                <div className="p-8 border-b border-[#163327]/5">
                  <Link href="/" onClick={() => setIsOpen(false)} className="flex flex-col">
                    <span className="font-serif text-3xl font-bold tracking-tighter text-[#163327] uppercase">
                      ORE
                    </span>
                    <span className="text-[10px] font-bold tracking-[0.4em] text-[#C5A059] uppercase -mt-0.5">
                      REAL ESTATE
                    </span>
                  </Link>
                </div>
                
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-8 space-y-10 pb-24">
                    {[
                      { title: "Properties", links: mainLinks },
                      { title: "Market", links: marketLinks },
                      { title: "Investment Tools", links: toolsLinks },
                      { title: "Our Firm", links: companyLinks }
                    ].map((section) => (
                      <div key={section.title} className="space-y-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#163327]/30 px-1">
                          {section.title}
                        </div>
                        <div className="grid gap-1">
                          {section.links.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsOpen(false)}
                              className="flex flex-col gap-0.5 rounded-2xl p-4 text-sm font-medium transition-colors hover:bg-[#163327]/05 active:bg-[#163327]/10"
                            >
                              <span className="text-[16px] text-[#163327]">{item.label}</span>
                              <span className="text-[11px] font-normal text-[#163327]/50 line-clamp-1">{item.description}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-8 border-t border-[#163327]/5 bg-white/40 backdrop-blur-xl">
                  <Button asChild className="w-full ore-gradient shadow-2xl h-14 rounded-full text-[11px] uppercase font-bold tracking-[0.2em]" size="lg">
                    <Link href="/chat" onClick={() => setIsOpen(false)}>
                      <SparklesIcon />
                      <span className="ml-3">AI Intelligence Desk</span>
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
