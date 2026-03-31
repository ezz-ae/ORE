import Link from "next/link"
import {
  LayoutDashboard,
  Bot,
  FolderKanban,
  Users,
  Rocket,
  BarChart3,
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  ArrowRight,
  Shield,
  Crown,
  Briefcase,
  UserCheck,
  Target,
  TrendingUp,
  Clock,
  BookOpen,
  Star,
  AlertCircle,
  PlusCircle,
  Settings,
  PhoneCall,
  CircleDollarSign,
  CalendarCheck,
  Flame,
  Globe,
  Eye,
  RefreshCw,
  Info,
  HelpCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function Section({
  id,
  label,
  title,
  subtitle,
  children,
}: {
  id: string
  label: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">{label}</p>
        <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function GoldBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#C9A961]/25 bg-[#C9A961]/6 px-6 py-5 space-y-2">
      {title && <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A961]">{title}</p>}
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}

function Step({ n, title, body, icon: Icon }: { n: number; title: string; body: string; icon: React.ElementType }) {
  return (
    <div className="flex gap-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="pt-1.5 space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
      <span className="text-sm font-medium text-foreground shrink-0">{label}</span>
      <span className="text-sm text-muted-foreground text-right">{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function PlaybookPage() {
  const TOC = [
    { id: "what-is-crm", label: "What is this?" },
    { id: "overview", label: "Overview" },
    { id: "ai-assistant", label: "AI Assistant" },
    { id: "inventory", label: "Properties" },
    { id: "landing-pages", label: "Ad Pages" },
    { id: "leads", label: "Leads" },
    { id: "analytics", label: "Reports" },
    { id: "profile", label: "My Profile" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "lead-journey", label: "Lead Journey" },
    { id: "team-roles", label: "Team Roles" },
    { id: "daily-routine", label: "Daily Routine" },
    { id: "faq", label: "FAQ" },
  ]

  return (
    <div className="space-y-20">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[#C9A961]/25 bg-[radial-gradient(ellipse_at_top_left,rgba(201,169,97,0.18),transparent_55%),linear-gradient(135deg,#0f172a,#111827)] p-10 text-white md:p-14">
        <div className="absolute right-8 top-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C9A961]/30 bg-[#C9A961]/10">
          <BookOpen className="h-7 w-7 text-[#C9A961]" />
        </div>
        <Badge className="mb-6 border-[#C9A961]/40 bg-[#C9A961]/15 text-[#C9A961] text-[10px] uppercase tracking-[0.2em]">
          ORE · Team Guide
        </Badge>
        <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl">
          Your complete guide<br />to working smarter<br />with every lead.
        </h1>
        <p className="mt-4 max-w-xl text-base text-white/60 leading-relaxed">
          No technical knowledge needed. This guide walks you through every part of your system — from finding your hottest clients to sending the perfect WhatsApp message in seconds.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-[#C9A961]/40 hover:text-[#C9A961]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* WHAT IS THIS */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="what-is-crm"
        label="Start Here"
        title="What is this system and why does it exist?"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Users,
              title: "It keeps every client in one place",
              body: "Every person who enquires about a property — from your website, WhatsApp, or advertising — lands here automatically. No more lost leads in WhatsApp chats or spreadsheets.",
            },
            {
              icon: Sparkles,
              title: "It gives you an AI sales partner",
              body: "The AI knows your entire property portfolio and every client in the system. Ask it anything — it can rank your hottest leads, draft a message, or find the best investment for a client's budget.",
            },
            {
              icon: Rocket,
              title: "It runs your campaigns",
              body: "Generate a professional advertising page for any property and share the link anywhere — WhatsApp, Instagram, email. When someone fills the form, they appear in your leads instantly.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <GoldBox title="The big picture">
          Think of this as your office, your assistant, and your marketing team — all in one screen. You spend less time on admin and more time talking to buyers who are actually ready to move.
        </GoldBox>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* OVERVIEW */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="overview"
        label="Page 01"
        title="Overview — Your Morning Briefing"
        subtitle="The first page you see when you log in. Gives you a complete picture of your business in under 30 seconds."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { icon: Users, label: "Today's Leads", body: "How many new people enquired about a property today. Resets every morning." },
            { icon: CalendarCheck, label: "Assigned This Week", body: "Leads that have been given to a broker to handle this week." },
            { icon: PhoneCall, label: "Active Enquiries (30 days)", body: "Clients your team has been in touch with at least once in the last month." },
            { icon: TrendingUp, label: "Scheduled Viewings", body: "Clients who have a viewing booked or in progress." },
            { icon: CircleDollarSign, label: "Revenue Pipeline", body: "The total budget of all your active leads added together. A rough view of the potential deals in progress." },
            { icon: Flame, label: "Hot Leads Alert", body: "The AI reads every lead and scores them. The ones most likely to buy appear here with a score. Start your calls with these." },
          ].map(({ icon: Icon, label, body }) => (
            <div key={label} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card/80 p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Suggested Tasks</p>
            <p className="text-sm text-muted-foreground leading-relaxed">Every morning the system tells you the three most important things to do — which client to call first, whether there are unattended leads, and which property to promote.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Top Performing Properties</p>
            <p className="text-sm text-muted-foreground leading-relaxed">Shows your best properties ranked by market demand and investment score. Use this list to decide which projects to push in your WhatsApp campaigns and advertising this week.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">For managers and directors only</p>
          <p className="text-sm text-muted-foreground leading-relaxed">At the bottom of the Overview page, managers see extra tools: the ability to push property updates to the AI (price changes, new availability), grant team members access to certain features, and review all AI learning sessions.</p>
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* AI ASSISTANT */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="ai-assistant"
        label="Page 02"
        title="AI Assistant — Ask It Anything"
        subtitle="Your personal sales partner available 24/7. It knows your full property portfolio and every lead in the system."
      >
        <p className="text-sm text-muted-foreground">Just type your question in plain English. Here are things brokers use it for every day:</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              ask: "Who should I call first today?",
              gets: "The AI scores all your leads and gives you a ranked list with a reason for each — who has the right budget, who enquired recently, who hasn't been contacted yet.",
            },
            {
              ask: "Show me all properties with 8% or more return",
              gets: "Instant list of matching properties from your portfolio with location, price, and projected return.",
            },
            {
              ask: "Write a WhatsApp message for Ahmed who is interested in Marina Heights",
              gets: "A professional, personalised message ready to send — uses Ahmed's name and the actual project details.",
            },
            {
              ask: "Which leads haven't been assigned to anyone yet?",
              gets: "Full list of enquiries sitting without a broker — so nothing falls through the cracks.",
            },
            {
              ask: "Find me properties in Business Bay under AED 1.5 million",
              gets: "Filtered results from your live inventory in seconds.",
            },
            {
              ask: "Create a new listing for [property name]",
              gets: "Starts building a new property listing and fills in the details as you describe them.",
            },
          ].map(({ ask, gets }) => (
            <div key={ask} className="rounded-2xl border border-border/60 bg-card/80 p-5 space-y-2">
              <p className="text-sm font-semibold text-foreground">&ldquo;{ask}&rdquo;</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{gets}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-4">
          <p className="font-semibold text-foreground">Other things on this page</p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span><strong className="text-foreground">Download your results</strong> — After any search, you can download the list as a spreadsheet or a summary text file to share with a client or colleague.</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span><strong className="text-foreground">Save conversations</strong> — Pin any conversation you want to keep. The AI remembers your pinned sessions as learning material to improve its answers over time.</span>
            </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span><strong className="text-foreground">It remembers context</strong> — If you ask about a property and then say &ldquo;write a message for the client who asked about this&rdquo;, it connects the dots. You don&apos;t need to repeat yourself.</span>
              </div>
          </div>
        </div>

        <GoldBox title="Pro tip">
          Start every morning by typing: <em>&ldquo;Who should I follow up with today?&rdquo;</em> — the AI gives you your priority call list in seconds based on real signals, not guesses.
        </GoldBox>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* INVENTORY */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="inventory"
        label="Page 03"
        title="Properties — Your Full Inventory"
        subtitle="Browse and search all properties available in your portfolio. Over 3,500 Dubai projects at your fingertips."
      >
        <div className="rounded-2xl border border-border/60 bg-card/80 divide-y divide-border/40">
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground">How to search</p>
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
              {[
                ["Search by name", "Type any part of the property name to find it instantly."],
                ["Filter by area", "Select a neighbourhood — Dubai Marina, Business Bay, Downtown, Palm Jumeirah, etc."],
                ["Filter by developer", "Narrow down to properties by Emaar, Damac, Sobha, Aldar, and more."],
                ["Filter by availability", "Show only properties currently on sale, coming soon, or sold out."],
                ["Set a price range", "Enter minimum and maximum budget in AED to see only what fits."],
                ["Sort results", "Order by investment score, ROI, or price — high to low or low to high."],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-start gap-2">
                  <ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" />
                  <span><strong className="text-foreground">{label}</strong> — {desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground">What you can do from the property list</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" /><span><strong className="text-foreground">Edit</strong> — Update the property details, price, or availability.</span></div>
              <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" /><span><strong className="text-foreground">Create Ad Page</strong> — Generate a shareable advertising page for this property with one click.</span></div>
              <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" /><span><strong className="text-foreground">View</strong> — See how the property appears to buyers on the public website.</span></div>
              <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" /><span><strong className="text-foreground">Download list</strong> — Export the current filtered results as a spreadsheet to share with a client.</span></div>
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* ADD PROJECT */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="add-project"
        label="Page 03b"
        title="Adding a New Property"
        subtitle="Use this when you have an exclusive or off-market listing that isn't already in the system."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-3">
            <p className="font-semibold text-foreground">What you fill in</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              {[
                ["Property name", "The full name as it will appear to buyers."],
                ["Area", "The neighbourhood in Dubai."],
                ["Developer", "The company building it."],
                ["Price range", "Starting and maximum price in AED."],
                ["Expected return", "The projected annual investment return %."],
                ["Status", "On sale now / Coming soon / Sold out."],
                ["Handover date", "When buyers will receive their keys."],
                ["Units available", "How many units are still for sale."],
                ["Payment plan", "How much is paid upfront, during construction, at handover, and after."],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-border/30 pb-2 last:border-0">
                  <span className="font-medium text-foreground shrink-0">{label}</span>
                  <span className="text-right text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#C9A961]/20 bg-[#C9A961]/5 p-6 space-y-3">
            <Sparkles className="h-5 w-5 text-[#C9A961]" />
            <p className="font-semibold text-foreground">The AI fills in the rest</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              After you save the property, the AI automatically writes an investment summary, generates market insights, and adds context about the area — all the information that appears on the advertising page for buyers. You don&apos;t need to write any of this yourself.
            </p>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* LANDING PAGES */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="landing-pages"
        label="Page 04"
        title="Advertising Pages — Your Digital Brochures"
        subtitle="Generate a beautiful, professional page for any property and share the link. When someone fills the enquiry form, they become a lead instantly."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Globe, label: "Total Pages", body: "All advertising pages you have created." },
            { icon: CheckCircle2, label: "Published", body: "Pages that are live and publicly accessible right now." },
            { icon: Users, label: "Leads / Views", body: "How many people visited each page and how many submitted an enquiry." },
          ].map(({ icon: Icon, label, body }) => (
            <div key={label} className="rounded-2xl border border-border/60 bg-card/80 p-5 flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 divide-y divide-border/40">
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground">What each advertising page includes</p>
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
              {[
                ["Hero image & headline", "A striking full-width photo with the property name and key selling points."],
                ["Investment highlights", "Expected return, rental yield, and starting price — clearly displayed."],
                ["Key facts", "Area, developer, handover date, bedroom types — all auto-filled."],
                ["Payment plan", "A visual breakdown of how payments are spread out."],
                ["AI market insight", "A short written analysis of why this is a good investment — written by the AI."],
                ["Enquiry form", "A form that captures the buyer&apos;s name, phone, email, and budget. Every submission goes straight into your Leads."],
              ].map(([name, desc]) => (
                <div key={name} className="rounded-xl border border-border/40 bg-background/60 px-4 py-3">
                  <p className="font-semibold text-xs text-foreground">{name}</p>
                  <p className="text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground">Page status</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2"><span className="inline-flex rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-600">Draft</span><span className="text-muted-foreground">Not visible to the public yet. Still being set up.</span></div>
              <div className="flex items-center gap-2"><span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-600">Published</span><span className="text-muted-foreground">Live and visible to anyone with the link.</span></div>
            </div>
          </div>
        </div>

        <GoldBox title="How to share an advertising page">
          Click the <strong>Open</strong> button to get the page link, then copy and paste it into WhatsApp, your Instagram bio, a paid ad, or an email. Every person who enquires through that link is automatically tracked to that campaign so you can see exactly which page is bringing leads.
        </GoldBox>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* LEADS */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="leads"
        label="Page 05"
        title="Leads — Your Full Client Pipeline"
        subtitle="Every person who has ever enquired about a property lives here. This is where deals are won."
      >
        <div className="rounded-2xl border border-border/60 bg-card/80 px-6 py-5 space-y-4">
          <p className="font-semibold text-foreground">What each status means</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { status: "New", color: "bg-blue-400/10 text-blue-500", desc: "Just arrived. No one has been in touch yet. These need to be called or messaged today." },
              { status: "Contacted", color: "bg-amber-400/10 text-amber-600", desc: "The broker has reached out at least once — call, WhatsApp, or email." },
              { status: "Qualified", color: "bg-purple-400/10 text-purple-500", desc: "The broker confirmed this person has a real budget and genuine intention to buy." },
              { status: "Viewing", color: "bg-orange-400/10 text-orange-500", desc: "A property viewing has been scheduled or has taken place." },
              { status: "Negotiating", color: "bg-emerald-400/10 text-emerald-600", desc: "Price and terms are being discussed." },
              { status: "Closed", color: "bg-green-500/15 text-green-600", desc: "Deal is closed. The client signed the reservation form. Congratulations." },
              { status: "Lost", color: "bg-rose-400/10 text-rose-500", desc: "The client decided not to proceed. Keep the record — many come back months later." },
            ].map(({ status, color, desc }) => (
              <div key={status} className="flex items-start gap-3">
                <span className={`inline-flex shrink-0 rounded-full px-3 py-0.5 text-xs font-bold ${color}`}>{status}</span>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 divide-y divide-border/40">
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground">What you can see on each lead&apos;s page</p>
            <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
              {[
                ["Full contact details", "Name, phone number, and email — with one-click buttons to call, email, or open WhatsApp."],
                ["Budget", "What the client said their budget is."],
                ["Property interest", "Which property they originally enquired about."],
                ["Where they came from", "Whether they found you through a campaign page, the website, WhatsApp, a referral, etc."],
                ["Last contact", "The last time someone from your team was in touch."],
                ["Full conversation history", "Every note, call log, WhatsApp sent, and status change — with time and date stamps."],
              ].map(([label, desc]) => (
                <div key={label} className="rounded-xl border border-border/40 bg-background/60 px-4 py-3">
                  <p className="font-semibold text-xs text-foreground">{label}</p>
                  <p className="text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Follow-Up Assistant (on every lead page)</p>
            <p className="text-sm text-muted-foreground leading-relaxed">When you open a lead, the AI immediately prepares three things for you — no waiting, no clicking:</p>
            <div className="space-y-2">
              {[
                ["WhatsApp message", "A ready-to-send, personalised message using the client&apos;s name and the property they were interested in. You can edit it before sending."],
                ["Email draft", "A professional follow-up email with a subject line and full body text, ready to open in your mail app."],
                ["Recommended next steps", "3 to 5 actions the AI suggests based on where this client is in their buying journey."],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-start gap-3">
                  <ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground"><strong className="text-foreground">{label}</strong> — {desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="font-semibold text-foreground">Adding updates and notes</p>
            <p className="text-sm text-muted-foreground leading-relaxed">Use the <strong className="text-foreground">Add Update</strong> box on the right side of every lead page. You can leave a note about a call, change the client&apos;s status, or mark them as contacted. Everything is saved with a timestamp and attributed to your name.</p>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* ANALYTICS */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="analytics"
        label="Page 06"
        title="Reports — How Your Business Is Performing"
        subtitle="A clear view of where your leads come from, how your team is doing, and which areas are in demand. Brokers see their own numbers. Managers see the whole team."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Revenue Pipeline",
              body: "The total combined budget of all your active leads right now. This tells you the potential value sitting in your pipeline — not guaranteed, but a strong indicator of upcoming deals.",
            },
            {
              title: "Lead Sources",
              body: "Where are your enquiries coming from? Instagram, your website, advertising pages, WhatsApp referrals? This shows which channel is working best so you can invest more in what&apos;s converting.",
            },
            {
              title: "Broker Performance",
              body: "How many leads each team member is handling. Managers use this to spot who needs more support and whether the workload is spread fairly.",
            },
            {
              title: "Demand by Area",
              body: "Which neighbourhoods are buyers asking about most? Use this to decide which areas to focus your campaigns on — go where the demand already is.",
            },
            {
              title: "Top Properties",
              body: "Your best-rated properties based on market demand and investment score. Prioritise these in your outreach — they&apos;re the easiest sell.",
            },
            {
              title: "Number of Sources",
              body: "How many different channels are bringing in leads. A healthy business has multiple sources — never rely on just one.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card/80 p-5 space-y-2">
              <p className="font-semibold text-sm text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <GoldBox title="When to check Analytics">
          Every Monday morning. In 5 minutes you&apos;ll know: which source produced the most leads last week, which broker is behind, and which area to target with your next campaign.
        </GoldBox>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* PROFILE */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="profile"
        label="Page 07"
        title="My Profile — Your Personal Settings"
        subtitle="Update your personal information and see your own performance."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-3">
            <p className="font-semibold text-foreground flex items-center gap-2"><Settings className="h-4 w-4 text-primary" /> What you can update</p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <FactRow label="Your name" value="How it appears across the system." />
              <FactRow label="Email address" value="Your login email." />
              <FactRow label="Password" value="Change it here anytime. Minimum 8 characters." />
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-3">
            <p className="font-semibold text-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Your performance snapshot</p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <FactRow label="Total leads assigned" value="All clients currently in your name." />
              <FactRow label="Hot leads" value="Your leads the AI has flagged as high priority." />
              <FactRow label="Pipeline value" value="The combined budget of your active clients." />
              <FactRow label="Estimated commission" value="A projected figure based on your pipeline value and your commission rate." />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">For managers: viewing your team&apos;s profiles</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Managers can view the profile and performance of any team member. You&apos;ll also see a full list of all active user accounts — you can add new team members or remove someone who has left.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 px-6 py-5 space-y-4">
          <p className="font-semibold text-foreground">Forgot your password?</p>
          <div className="space-y-3">
            {[
              { n: 1, title: "Go to the login page", body: 'Click "Forgot password?" below the login form.' },
              { n: 2, title: "Enter your email", body: "The system generates a private reset link for you." },
              { n: 3, title: "Click the reset link", body: "Enter your new password. The link is only valid for 1 hour." },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{n}</div>
                <div className="pt-0.5">
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* WHATSAPP */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="whatsapp"
        label="Section 08"
        title="Sending WhatsApp from a Lead — Step by Step"
        subtitle="The AI writes the message. You review it. One click opens WhatsApp. The system logs it automatically."
      >
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80">
          <div className="grid gap-0 divide-y divide-border/40 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-8 space-y-6">
              <p className="font-semibold text-foreground">How to do it</p>
              {[
                { icon: Users, n: 1, title: "Open a lead", body: "Go to Leads and click on any client's name." },
                { icon: Sparkles, n: 2, title: "Read the AI draft", body: "The AI has already written a personalised WhatsApp message using the client's name and the property they're interested in. It appears automatically — no button needed." },
                { icon: MessageSquare, n: 3, title: "Edit if you want", body: "The message is fully editable. Change the wording, add details, or leave it exactly as written." },
                { icon: Send, n: 4, title: "Click Send on WhatsApp", body: "WhatsApp opens on your screen with the message already typed in the client's chat. You just press Send." },
                { icon: CheckCircle2, n: 5, title: "Done — it's all logged", body: "The system automatically records that you sent a WhatsApp, saves a preview of the message, and updates the last-contact time for this client." },
              ].map(({ icon: Icon, n, title, body }) => (
                <div key={n} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-sm font-bold text-primary">{n}</div>
                  <div className="pt-1 flex items-start gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-8 space-y-5">
              <p className="font-semibold text-foreground">Why you don&apos;t need to set anything up</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This works through WhatsApp&apos;s standard link system. When you click the button, it opens WhatsApp Web or your WhatsApp app directly with the client&apos;s number and message pre-loaded. There is no registration, no approval process, and no third-party account needed.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You stay in full control — the AI prepares the message but you always press Send. This means every message you send sounds like you wrote it, because you reviewed and approved it first.
              </p>
              <div className="space-y-2 pt-2">
                {[
                  "Works with your normal WhatsApp number",
                  "No approvals or sign-ups needed",
                  "You review every message before it sends",
                  "Every send is saved in the client's history",
                  "The client is automatically marked as last-contacted",
                  "You can regenerate the draft if you want a different tone",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* LEAD JOURNEY */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="lead-journey"
        label="Section 09"
        title="The Life of a Lead — From Enquiry to Deal"
        subtitle="How a client moves through your system from the moment they show interest to the moment they sign."
      >
        <div className="relative mx-auto max-w-2xl space-y-0">
          {[
            {
              icon: Target,
              title: "Someone enquires",
              body: "A buyer fills the enquiry form on an advertising page, your website, or a campaign link. Their name, phone, email, budget, and property interest are captured instantly and appear in your Leads list. Nothing is missed.",
            },
            {
              icon: UserCheck,
              title: "A broker is assigned",
              body: "A manager or admin assigns the lead to the right broker. From that moment, the broker can see the lead in their personal pipeline and the client belongs to them.",
            },
            {
              icon: Sparkles,
              title: "The AI prepares the outreach",
              body: "The broker opens the lead and immediately sees a ready-to-send WhatsApp draft, an email, and a list of recommended next steps — all written by the AI, all personalised for this specific client.",
            },
            {
              icon: Send,
              title: "First contact is made",
              body: "The broker sends the WhatsApp, calls, or emails and logs the interaction. The status moves from New to Contacted. The contact is saved with the time and date.",
            },
            {
              icon: PhoneCall,
              title: "Qualifying the client",
              body: "Through follow-up conversations, the broker confirms the client&apos;s real budget, timeline, and intentions. Once confirmed, the status moves to Qualified. These are your real buyers.",
            },
            {
              icon: Eye,
              title: "Viewing and negotiation",
              body: "A site visit or virtual tour is arranged. The status moves to Viewing, then Negotiating when price and terms are being discussed. Every step is noted on the lead page.",
            },
            {
              icon: TrendingUp,
              title: "The deal closes",
              body: "The client signs. Status moves to Closed. For leads that don&apos;t proceed, mark them as Lost but never delete the record. Clients who say no today often come back in 6–12 months when their situation changes.",
            },
          ].map((step, idx, arr) => {
            const Icon = step.icon
            const isLast = idx === arr.length - 1
            return (
              <div key={step.title} className="relative flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  {!isLast && <div className="mt-1 w-px flex-1 bg-gradient-to-b from-primary/30 to-primary/5 min-h-[2rem]" />}
                </div>
                <div className={`flex-1 pb-10 ${isLast ? "pb-0" : ""}`}>
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* TEAM ROLES */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="team-roles"
        label="Section 10"
        title="Team Roles — Who Can Do What"
        subtitle="Access levels are set by the admin. Each role sees only what they need."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Crown,
              role: "CEO / Director",
              color: "text-[#C9A961]",
              bg: "bg-[#C9A961]/10 border-[#C9A961]/25",
              can: [
                "See the full company picture across leads, listings, and campaigns",
                "View and manage every team member's account",
                "Access all reports and revenue numbers",
                "Push property updates and manage AI settings",
                "Remove team members from the system",
              ],
            },
            {
              icon: Shield,
              role: "Admin / Office Manager",
              color: "text-purple-400",
              bg: "bg-purple-400/10 border-purple-400/25",
              can: [
                "Assign leads to brokers",
                "Create and edit property listings",
                "Create and manage advertising pages",
                "See all team leads and client activity",
                "Grant or remove team member access",
              ],
            },
            {
              icon: Briefcase,
              role: "Sales Manager",
              color: "text-blue-400",
              bg: "bg-blue-400/10 border-blue-400/25",
              can: [
                "See all leads for their team",
                "Reassign leads between their brokers",
                "View performance reports for their team",
                "View any broker profile on their team",
              ],
            },
            {
              icon: UserCheck,
              role: "Broker",
              color: "text-emerald-400",
              bg: "bg-emerald-400/10 border-emerald-400/25",
              can: [
                "See only their own assigned clients",
                "Update lead status and add call notes",
                "Use the AI assistant fully",
                "Send WhatsApp and email from any lead",
                "View their own performance and commission",
              ],
            },
          ].map(({ icon: Icon, role, color, bg, can }) => (
            <div key={role} className={`rounded-2xl border p-6 space-y-4 ${bg}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className={`font-serif text-xl font-bold ${color}`}>{role}</p>
              </div>
              <ul className="space-y-1.5">
                {can.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/30" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* DAILY ROUTINE */}
      {/* ══════════════════════════════════════════ */}
      <Section
        id="daily-routine"
        label="Section 11"
        title="Recommended Daily Routine"
        subtitle="The habits that separate the brokers who close consistently from those who don't."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { icon: Clock, time: "Morning", title: "Start with Overview", body: "Check your hot leads, pipeline value, and the AI's three suggested tasks. This takes 2 minutes and sets your focus for the day." },
            { icon: Sparkles, time: "Morning", title: "Ask the AI for your call list", body: "Type \"who should I follow up with today\" in the AI Assistant. You get a scored, ranked list — start calling from the top." },
            { icon: MessageSquare, time: "Before every call", title: "Open the lead page first", body: "The AI draft will be ready. Glance at it before you call — it reminds you what they were interested in and what their budget is." },
            { icon: Send, time: "After every interaction", title: "Log a note or send WhatsApp", body: "Always record what happened. A note after every call keeps your pipeline accurate and means any team member can step in if needed." },
            { icon: Rocket, time: "Weekly", title: "Share campaign pages", body: "Pick your best property of the week, open its advertising page, and share the link in your WhatsApp broadcast or Instagram story." },
            { icon: Star, time: "Never", title: "Delete a lead", body: "A client who said no today has a 30% chance of coming back within a year. Mark them as Lost but keep the record — the AI will resurface them when the time is right." },
          ].map(({ icon: Icon, time, title, body }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card/80 p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{time}</p>
                <p className="font-semibold text-sm text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQ */}
      {/* ══════════════════════════════════════════ */}
      <Section id="faq" label="Section 12" title="Questions We Hear All the Time">
        <div className="space-y-3">
          {[
            {
              q: "How do I add a new team member?",
              a: "Ask your admin or manager. They can add new accounts from the Profile page under the Team section. Every new team member needs a name, email, and role before they can log in.",
            },
            {
              q: "Can two brokers see the same client?",
              a: "No. Each lead is assigned to one broker only. Only managers and admins can see all leads across the team. This protects the client relationship and keeps accountability clear.",
            },
            {
              q: "What if I accidentally mark a lead as Lost?",
              a: "Just change it back. Open the lead, go to Add Update, and change the status to the correct stage. Everything is reversible and the full history is always kept.",
            },
            {
              q: "I don't like the AI message it wrote. What do I do?",
              a: "Edit it directly — just click in the message box and change anything you want. Or click Regenerate to get a completely fresh version. You can also just write your own message in WhatsApp after clicking the button.",
            },
            {
              q: "Can I use this on my phone?",
              a: "Yes. The system works on mobile browsers. The Send on WhatsApp button opens WhatsApp directly on your phone. All forms and pages are designed for mobile use.",
            },
            {
              q: "How long does my login last?",
              a: "You stay logged in for 7 days without needing to sign in again. If you don't use the system for 7 days, you'll be asked to log back in. Your data and leads are always safe.",
            },
            {
              q: "Where do leads come from?",
              a: "Leads arrive automatically from your advertising pages, your website contact forms, and the AI chat on your website. You can also have the AI assistant create a lead manually if someone calls you directly.",
            },
            {
              q: "Can I see if a lead came from a specific Instagram ad or campaign?",
              a: "Yes. Every lead shows its source — whether it came from a specific advertising page, your website, a referral, or a paid ad. This is shown on the lead page and in Analytics.",
            },
            {
              q: "How do I know my advertising page is live?",
              a: "Go to the Advertising Pages section. If the status badge is green (Published), the page is live and accessible to anyone with the link. If it's amber (Draft), it is not yet visible to the public.",
            },
            {
              q: "I sent a WhatsApp but it&apos;s not showing in the client history. Why?",
              a: "The WhatsApp activity is only logged when you click the Send on WhatsApp button inside the lead page. If you send a WhatsApp directly from your phone without using the button, the system won't know about it.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-border/60 bg-card/80 px-6 py-5 space-y-2">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <p className="font-semibold text-sm text-foreground">{q}</p>
              </div>
              <p className="pl-7 text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Footer ── */}
      <section className="rounded-[2rem] border border-primary/20 bg-primary/5 px-8 py-10 text-center space-y-4">
        <p className="font-serif text-2xl font-bold text-foreground">Ready to start?</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Open the AI Assistant and type <em>&ldquo;who should I call first today?&rdquo;</em> — let the system tell you where to focus.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link
            href="/crm/ai-assistant"
            className="inline-flex items-center gap-2 rounded-xl ore-gradient px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
          >
            <Bot className="h-4 w-4" /> Open AI Assistant
          </Link>
          <Link
            href="/crm/leads"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Users className="h-4 w-4" /> View My Leads
          </Link>
          <Link
            href="/crm/overview"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <LayoutDashboard className="h-4 w-4" /> Go to Overview
          </Link>
        </div>
      </section>

    </div>
  )
}
