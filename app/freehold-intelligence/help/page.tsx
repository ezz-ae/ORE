'use client'

import Link from 'next/link'
import { BookOpen, Compass, Play, Link2, Megaphone, Users, Package, DollarSign, Bot, TrendingUp, ShieldCheck, Settings, UserCircle } from 'lucide-react'
import { useCoach } from '@/components/freehold/coach/coach-marks'
import { HOWTOS } from '@/lib/freehold/howto'
import { useT } from '@/lib/i18n/provider'

/**
 * In-app Help & user guide. The guided walkthroughs launch the task coach
 * (step-by-step across pages); the manual below covers every app in plain
 * language. Manual prose is English-first; the walkthroughs are fully
 * translated (EN/AR/RU).
 */
export default function HelpPage() {
  const t = useT()
  const coach = useCoach()

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
        <BookOpen className="h-4 w-4" /> Help & user guide
      </div>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">How everything works</h1>
      <p className="mt-1 max-w-[58ch] text-sm text-slate-400">
        Start with a guided walkthrough — the coach takes you step by step through the real screens.
        The manual below covers every app.
      </p>

      {/* Guided walkthroughs */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Compass className="h-4 w-4" /> Guided walkthroughs
        </h2>
        <div className="grid gap-3">
          {HOWTOS.map((flow) => (
            <button
              key={flow.id}
              onClick={() => coach.startHowTo(flow.id)}
              className="group flex items-center gap-4 rounded-2xl border border-gold/25 bg-gold/[0.05] p-4 text-left transition hover:bg-gold/[0.1]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                <Play className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{t(flow.titleKey)}</span>
                <span className="block text-xs text-slate-400">{flow.steps.length} steps · the coach walks you through the real screens</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          You can also replay any page's tour from the account menu → “Take a tour”.
        </p>
      </section>

      {/* Getting started */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Getting started</h2>
        <div className="space-y-2 text-sm leading-relaxed text-slate-300">
          <p><b className="text-white">Sign in</b> — one login covers everything. “Keep me signed in” lasts 7 days.</p>
          <p><b className="text-white">Navigation</b> — the top bar is your app switcher; you only see the apps your role allows.</p>
          <p><b className="text-white">Language</b> — account menu (top-right) → English / العربية / Русский. Arabic flips the layout automatically. On a first visit, the app opens in your device's language.</p>
          <p><b className="text-white">Screen light</b> — account menu → Day / Night. Your choice is saved to your account and follows you to any device.</p>
          <p><b className="text-white">What's new</b> — a small corner note appears when we ship something new; open the full list any time from the account menu.</p>
          <p><b className="text-white">The AI Expert</b> — the gold button on every screen (⌘J / Ctrl-J). It reads your live data; anything it produces can be saved to the Notebook.</p>
        </div>
      </section>

      {/* The apps */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">The apps</h2>
        <div className="grid gap-3">
          {[
            { Icon: Users, name: 'CRM', body: 'Every lead in one place. Open a lead for the 360° view; Call / WhatsApp buttons on each row; drag across the board to advance; closing opens the deal window. Follow-up queue shows what’s overdue.' },
            { Icon: Megaphone, name: 'Ads / Lead Machine', body: 'Build campaigns step by step on real projects: pick a property, budget & audience, creative (real photo, your upload, AI copy) and launch — paused first if you like. Ads Live shows spend and leads in real time.' },
            { Icon: Package, name: 'Inventory', body: 'All projects with data-quality and ad-readiness scores. From any project: generate a landing page or start a campaign in one click.' },
            { Icon: DollarSign, name: 'Finance', body: 'Deals, the full commission waterfall (agency → referral/cashback → expenses/growth → broker payout → company net), credits and real ad spend.' },
            { Icon: Bot, name: 'Web Studio', body: 'Listings, SEO content and landing-page copy — generate and improve with AI.' },
            { Icon: TrendingUp, name: 'Analytics', body: 'Company, Team, Market and Marketing lenses. Open any team member for their complete record — leads, deals, commission, ad spend.' },
            { Icon: BookOpen, name: 'Notebook', body: 'Your AI research workspace. Conversations and saved outputs persist to your account.' },
            { Icon: ShieldCheck, name: 'Integrations', body: 'Connect Meta, WhatsApp, HubSpot and Google yourself — every page has a “How do I get this?” guide, and every save is validated live before it stores (encrypted).' },
            { Icon: Settings, name: 'Settings', body: 'Team & roles, automation rules for lead routing, brand, languages, security. Management can reset demo data before go-live.' },
            { Icon: UserCircle, name: 'My Workspace (brokers)', body: 'A broker’s own home: leads, campaigns, credits, AI — plus a personal Bio Link page with QR that captures leads straight to them.' },
          ].map(({ Icon, name, body }) => (
            <div key={name} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-slate-300"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{name}</div>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-400">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick recipes */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Quick recipes</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
          <li>• <b className="text-white">Follow up the right lead now</b> — CRM → Follow-up → open the top overdue lead → Call / WhatsApp.</li>
          <li>• <b className="text-white">Launch an ad for a property</b> — Inventory → project → Advertise (or use the guided walkthrough above).</li>
          <li>• <b className="text-white">Publish a landing page</b> — Lead Machine → Landings → Create; it goes live at /lp/&lt;slug&gt; and its Campaign button opens the ad builder prefilled.</li>
          <li>• <b className="text-white">See who's performing</b> — Analytics → Team → open a member for their full record.</li>
          <li>• <b className="text-white">Give an agent credits</b> — Finance → Credits → set amount → Apply.</li>
          <li>• <b className="text-white">Set up your Bio Link (brokers)</b> — My Workspace → Bio Link → fill your card, pick projects, share the QR.</li>
        </ul>
      </section>

      {/* Integrations shortcut */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Connect your accounts</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/freehold-intelligence/integrations/meta', label: 'Meta Ads' },
            { href: '/freehold-intelligence/integrations/whatsapp', label: 'WhatsApp' },
            { href: '/freehold-intelligence/integrations/hubspot', label: 'HubSpot' },
            { href: '/freehold-intelligence/integrations/google', label: 'Google Ads' },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm text-slate-200 transition hover:border-gold/40 hover:text-white">
              <Link2 className="h-3.5 w-3.5 text-gold" /> {l.label}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Each page has its own “How do I get this?” steps — you can connect everything yourself.</p>
      </section>
    </div>
  )
}
