/**
 * Tool registry — every navigable destination in the system, in ONE list.
 *
 * Why this exists, and why it is separate from `apps.ts`:
 *
 *   apps.ts   = level 1. The ~14 workspaces on the top spine. Broad, stable.
 *   tools.ts  = level 2. Every real tool inside those workspaces (~130).
 *
 * The point is that level 2 lives in a POPUP, not in permanent chrome. A page
 * does not have to grow a second and third navigation rail just so its tools
 * are reachable — the popup already reaches everything, from anywhere. Most
 * pages therefore carry one level of nav; a page grows a second only when its
 * own sub-sections genuinely help while you work in it. This is the Meta
 * Business Suite "All tools" model: shallow chrome, one deep index.
 *
 * ROLE CORRECTNESS. A tool inherits the role list of the app that owns it via
 * `rolesForApp(app)` — the same function the route guards use — so the popup
 * can never advertise a door the guard will slam. `roles` overrides that only
 * where a route genuinely differs from its app (e.g. Settings → Connect AI is
 * personal and open to everyone; /security and /server-status are management).
 *
 * REDIRECT STUBS ARE EXCLUDED on purpose: /freehold-intelligence/ads,
 * /lead-machine/landings, /lead-machine/listings and /reviews all redirect
 * elsewhere. Listing them would show the same destination twice under two
 * different names — the exact confusion this popup exists to remove.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Users, UserPlus, UserCheck, UsersRound, Inbox, Kanban, ListChecks, Copy, Activity, FlaskConical,
  CalendarDays, Flag, CheckSquare,
  Megaphone, Rocket, Target, Wand2, SlidersHorizontal, GitBranch, FileInput, Crosshair, Table2,
  Radio, Link2, ShieldCheck, ClipboardList, Presentation, Search as SearchIcon, KeyRound,
  Package, PlusSquare, Building2, Home as HomeIcon, LayoutTemplate, Inbox as InboxIcon, Gauge,
  HardDrive, FolderOpen, Image as ImageIcon, PenTool, Clapperboard, Film, BookOpen, Globe, Cloud, Repeat,
  Bot, FileText, MapPin, Landmark, Lightbulb, LayoutGrid, Hash, Star,
  TrendingUp, BarChart3, LineChart, PieChart, Trophy, CalendarCheck, GraduationCap,
  DollarSign, Receipt, CreditCard, Coins, Scale, FileSignature,
  Settings, Bell, Lock, Database, Languages, Sparkles, Plug, Server, LifeBuoy, UserCircle,
} from 'lucide-react'
import type { Role } from './session-types'
import { MANAGEMENT_ROLES } from './session-types'
import { ALL_ROLES, rolesForApp } from './apps'

/** The ten shelves of the popup. Order here is the order on screen. */
export const TOOL_GROUPS = [
  { id: 'sell',      labelKey: 'tools.group.sell'      },
  { id: 'advertise', labelKey: 'tools.group.advertise' },
  { id: 'inventory', labelKey: 'tools.group.inventory' },
  { id: 'create',    labelKey: 'tools.group.create'    },
  { id: 'web',       labelKey: 'tools.group.web'       },
  { id: 'analyze',   labelKey: 'tools.group.analyze'   },
  { id: 'money',     labelKey: 'tools.group.money'     },
  { id: 'people',    labelKey: 'tools.group.people'    },
  // The broker's own surfaces. Their own shelf, because "My leads" filed under
  // "People" reads as other people's leads — to the one role that sees it.
  { id: 'me',        labelKey: 'tools.group.me'        },
  { id: 'setup',     labelKey: 'tools.group.setup'     },
] as const

export type ToolGroupId = (typeof TOOL_GROUPS)[number]['id']

export interface ToolDef {
  /** Stable id — also the key used for the "recently used" row. */
  id: string
  href: string
  /** i18n key for the display label. */
  labelKey: string
  group: ToolGroupId
  /** App id from apps.ts. Drives role inheritance AND the section a search hit
   *  is filed under ("Emaar in Inventory, then in Ads"). */
  app: string
  Icon: LucideIcon
  /** Overrides the app's role list. Use ONLY where the route guard differs. */
  roles?: Role[]
  /** Untranslated English search hints, matched in addition to the translated
   *  label so "pixel", "conversion", "utm" find their tool in any language. */
  keywords?: string
}

const FI = '/freehold-intelligence'

export const TOOLS: ToolDef[] = [
  // ── Sell & follow up ──────────────────────────────────────────────────────
  { id: 'crm.leads',      href: `${FI}/crm/leads`,      labelKey: 'tools.crm.leads',      group: 'sell', app: 'crm', Icon: Users,      keywords: 'leads contacts enquiries buyers' },
  { id: 'crm.pipeline',   href: `${FI}/crm/pipeline`,   labelKey: 'tools.crm.pipeline',   group: 'sell', app: 'crm', Icon: LineChart,  keywords: 'pipeline stages funnel' },
  { id: 'crm.board',      href: `${FI}/crm/board`,      labelKey: 'tools.crm.board',      group: 'sell', app: 'crm', Icon: Kanban,     keywords: 'board kanban drag stages' },
  { id: 'crm.followUp',   href: `${FI}/crm/follow-up`,  labelKey: 'tools.crm.followUp',   group: 'sell', app: 'crm', Icon: ListChecks, keywords: 'follow up overdue queue call back' },
  { id: 'crm.inbox',      href: `${FI}/crm/inbox`,      labelKey: 'tools.crm.inbox',      group: 'sell', app: 'crm', Icon: Inbox,      keywords: 'inbox messages whatsapp replies' },
  { id: 'crm.assignment', href: `${FI}/crm/assignment`, labelKey: 'tools.crm.assignment', group: 'sell', app: 'crm', Icon: UserCheck,  keywords: 'assign reassign round robin distribute' },
  { id: 'crm.duplicates', href: `${FI}/crm/duplicates`, labelKey: 'tools.crm.duplicates', group: 'sell', app: 'crm', Icon: Copy,       keywords: 'duplicates merge same phone' },
  { id: 'crm.activity',   href: `${FI}/crm/activity`,   labelKey: 'tools.crm.activity',   group: 'sell', app: 'crm', Icon: Activity,   keywords: 'activity timeline history log' },
  { id: 'crm.agents',     href: `${FI}/crm/agents`,     labelKey: 'tools.crm.agents',     group: 'sell', app: 'crm', Icon: UsersRound, keywords: 'agents brokers workload' },
  { id: 'tasks',          href: `${FI}/tasks`,          labelKey: 'tools.tasks',          group: 'sell', app: 'crm', Icon: CheckSquare, keywords: 'tasks todo assignments' },
  { id: 'milestones',     href: `${FI}/milestones`,     labelKey: 'tools.milestones',     group: 'sell', app: 'crm', Icon: Flag,       keywords: 'milestones goals targets' },
  { id: 'calendar',       href: `${FI}/calendar`,       labelKey: 'tools.calendar',       group: 'sell', app: 'calendar', Icon: CalendarDays, keywords: 'calendar meetings viewings bookings training' },

  // ── Advertise ─────────────────────────────────────────────────────────────
  { id: 'ads.campaigns',   href: `${FI}/lead-machine/campaigns`,             labelKey: 'tools.ads.campaigns',   group: 'advertise', app: 'ads', Icon: Megaphone,        keywords: 'campaigns meta facebook instagram ads' },
  { id: 'ads.launch',      href: `${FI}/lead-machine/campaigns/launch`,      labelKey: 'tools.ads.launch',      group: 'advertise', app: 'ads', Icon: Rocket,           keywords: 'launch publish go live new campaign' },
  { id: 'ads.new',         href: `${FI}/lead-machine/campaigns/new`,         labelKey: 'tools.ads.new',         group: 'advertise', app: 'ads', Icon: PlusSquare,       keywords: 'create campaign wizard' },
  { id: 'ads.optimize',    href: `${FI}/lead-machine/campaigns/optimize`,    labelKey: 'tools.ads.optimize',    group: 'advertise', app: 'ads', Icon: SlidersHorizontal,keywords: 'optimize budget scale pause performance' },
  { id: 'ads.attribution', href: `${FI}/lead-machine/campaigns/attribution`, labelKey: 'tools.ads.attribution', group: 'advertise', app: 'ads', Icon: GitBranch,        keywords: 'attribution utm source which campaign' },
  { id: 'ads.groups',      href: `${FI}/lead-machine/campaigns/groups`,      labelKey: 'tools.ads.groups',      group: 'advertise', app: 'ads', Icon: LayoutGrid,       keywords: 'groups ad sets clusters' },
  { id: 'ads.machine',     href: `${FI}/lead-machine/ads-machine`,           labelKey: 'tools.ads.machine',     group: 'advertise', app: 'ads', Icon: Bot,              keywords: 'ads machine autopilot trials automatic' },
  { id: 'ads.creatives',   href: `${FI}/lead-machine/creatives`,             labelKey: 'tools.ads.creatives',   group: 'advertise', app: 'ads', Icon: ImageIcon,        keywords: 'creatives images videos ad art' },
  { id: 'ads.generate',    href: `${FI}/lead-machine/creatives/generate`,    labelKey: 'tools.ads.generate',    group: 'advertise', app: 'ads', Icon: Wand2,            keywords: 'generate ai creative brochure to ad' },
  { id: 'ads.views',       href: `${FI}/lead-machine/views`,                 labelKey: 'tools.ads.views',       group: 'advertise', app: 'ads', Icon: Table2,           keywords: 'smart view saved report sheet which project is selling where the money went' },
  { id: 'ads.forms',       href: `${FI}/lead-machine/forms`,                 labelKey: 'tools.ads.forms',       group: 'advertise', app: 'ads', Icon: FileInput,        keywords: 'instant forms lead forms questions' },
  { id: 'ads.formNew',     href: `${FI}/lead-machine/forms/new`,             labelKey: 'tools.ads.formNew',     group: 'advertise', app: 'ads', Icon: PlusSquare,       keywords: 'build a lead form new instant form questions' },
  { id: 'ads.audiences',   href: `${FI}/lead-machine/audiences`,             labelKey: 'tools.ads.audiences',   group: 'advertise', app: 'ads', Icon: UsersRound,       keywords: 'audiences lookalike custom retargeting' },
  { id: 'ads.audienceLab', href: `${FI}/lead-machine/audience-lab`,          labelKey: 'tools.ads.audienceLab', group: 'advertise', app: 'ads', Icon: FlaskConical,     keywords: 'audience lab relevance seed lookalike behaviour layers evidence proven' },
  { id: 'ads.targeting',   href: `${FI}/lead-machine/targeting`,             labelKey: 'tools.ads.targeting',   group: 'advertise', app: 'ads', Icon: Crosshair,        keywords: 'targeting interests geo demographics' },
  { id: 'ads.pixel',       href: `${FI}/lead-machine/pixel`,                 labelKey: 'tools.ads.pixel',       group: 'advertise', app: 'ads', Icon: Radio,            keywords: 'pixel dataset events conversions capi tracking' },
  { id: 'ads.links',       href: `${FI}/lead-machine/links`,                 labelKey: 'tools.ads.links',       group: 'advertise', app: 'ads', Icon: Link2,            keywords: 'short links utm qr tracking urls' },
  { id: 'ads.permissions', href: `${FI}/lead-machine/permissions`,           labelKey: 'tools.ads.permissions', group: 'advertise', app: 'ads', Icon: KeyRound,         keywords: 'permissions who can launch budget caps' },
  { id: 'ads.requests',    href: `${FI}/lead-machine/ad-requests`,           labelKey: 'tools.ads.requests',    group: 'advertise', app: 'ads', Icon: ClipboardList,    keywords: 'ad requests broker asks approvals' },
  { id: 'ads.requirements',href: `${FI}/lead-machine/requirements`,          labelKey: 'tools.ads.requirements',group: 'advertise', app: 'ads', Icon: ShieldCheck,      keywords: 'requirements trakheesi permit compliance' },
  { id: 'ads.roadshow',    href: `${FI}/lead-machine/roadshow`,              labelKey: 'tools.ads.roadshow',    group: 'advertise', app: 'ads', Icon: Presentation,     keywords: 'roadshow event exhibition abroad' },
  { id: 'ads.live',        href: `${FI}/ads-live`,                           labelKey: 'tools.ads.live',        group: 'advertise', app: 'ads', Icon: Activity,         keywords: 'live spend results today how are ads doing' },
  { id: 'ads.liveMeta',    href: `${FI}/ads-live/meta`,                      labelKey: 'tools.ads.liveMeta',    group: 'advertise', app: 'ads', Icon: Radio,            keywords: 'meta live facebook instagram spend' },
  { id: 'ads.liveGoogle',  href: `${FI}/ads-live/google`,                    labelKey: 'tools.ads.liveGoogle',  group: 'advertise', app: 'ads', Icon: SearchIcon,       keywords: 'google live spend results' },
  { id: 'g.campaigns',     href: `${FI}/lead-machine/google/campaigns`,      labelKey: 'tools.google.campaigns',group: 'advertise', app: 'ads', Icon: SearchIcon,       keywords: 'google ads campaigns search' },
  { id: 'g.ads',           href: `${FI}/lead-machine/google/ads`,            labelKey: 'tools.google.ads',      group: 'advertise', app: 'ads', Icon: FileText,         keywords: 'google responsive search ads headlines' },
  { id: 'g.adsGen',        href: `${FI}/lead-machine/google/ads/generate`,   labelKey: 'tools.google.adsGen',   group: 'advertise', app: 'ads', Icon: Wand2,            keywords: 'generate google ad copy headlines descriptions ai' },
  { id: 'g.campaignNew',   href: `${FI}/lead-machine/google/campaigns/new`,  labelKey: 'tools.google.campNew',  group: 'advertise', app: 'ads', Icon: PlusSquare,       keywords: 'new google campaign create search' },
  { id: 'g.keywords',      href: `${FI}/lead-machine/google/keywords`,       labelKey: 'tools.google.keywords', group: 'advertise', app: 'ads', Icon: Hash,             keywords: 'keywords search terms negatives' },
  { id: 'g.audiences',     href: `${FI}/lead-machine/google/audiences`,      labelKey: 'tools.google.audiences',group: 'advertise', app: 'ads', Icon: UsersRound,       keywords: 'google audiences remarketing' },
  { id: 'g.extensions',    href: `${FI}/lead-machine/google/extensions`,     labelKey: 'tools.google.extensions',group:'advertise', app: 'ads', Icon: PlusSquare,       keywords: 'extensions sitelinks callouts assets' },
  { id: 'g.reports',       href: `${FI}/lead-machine/google/reports`,        labelKey: 'tools.google.reports',  group: 'advertise', app: 'ads', Icon: BarChart3,        keywords: 'google reports performance' },

  // ── Inventory ─────────────────────────────────────────────────────────────
  { id: 'inv.projects',    href: `${FI}/inventory/projects`,          labelKey: 'tools.inv.projects',    group: 'inventory', app: 'inventory', Icon: Package,        keywords: 'projects developments towers listings' },
  { id: 'inv.new',         href: `${FI}/inventory/new`,               labelKey: 'tools.inv.new',         group: 'inventory', app: 'inventory', Icon: PlusSquare,     keywords: 'add project new listing brochure upload' },
  { id: 'inv.offPlan',     href: `${FI}/inventory/off-plan`,          labelKey: 'tools.inv.offPlan',     group: 'inventory', app: 'inventory', Icon: Building2,      keywords: 'off plan under construction handover' },
  { id: 'inv.ready',       href: `${FI}/inventory/ready`,             labelKey: 'tools.inv.ready',       group: 'inventory', app: 'inventory', Icon: HomeIcon,       keywords: 'ready secondary move in' },
  { id: 'inv.landings',    href: `${FI}/inventory/landings`,          labelKey: 'tools.inv.landings',    group: 'inventory', app: 'inventory', Icon: LayoutTemplate, keywords: 'landing pages lp microsite campaign page' },
  { id: 'inv.landingReqs', href: `${FI}/inventory/landings/requests`, labelKey: 'tools.inv.landingReqs', group: 'inventory', app: 'inventory', Icon: InboxIcon,      keywords: 'landing edit requests changes approvals' },
  { id: 'inv.quality',     href: `${FI}/inventory/data-quality`,      labelKey: 'tools.inv.quality',     group: 'inventory', app: 'inventory', Icon: Gauge,          keywords: 'data quality missing photos prices completeness' },

  // ── Create ────────────────────────────────────────────────────────────────
  { id: 'drive.home',       href: `${FI}/drive`,                     labelKey: 'tools.drive.home',       group: 'create', app: 'drive', Icon: HardDrive,    keywords: 'drive everything assets' },
  { id: 'drive.files',      href: `${FI}/drive/files`,               labelKey: 'tools.drive.files',      group: 'create', app: 'drive', Icon: FolderOpen,   keywords: 'files documents pdf uploads' },
  { id: 'drive.library',    href: `${FI}/drive/library`,             labelKey: 'tools.drive.library',    group: 'create', app: 'drive', Icon: BookOpen,     keywords: 'library saved notes snippets' },
  { id: 'drive.media',      href: `${FI}/drive/media`,               labelKey: 'tools.drive.media',      group: 'create', app: 'drive', Icon: ImageIcon,    keywords: 'media images videos gallery' },
  { id: 'drive.editor',     href: `${FI}/drive/editor`,              labelKey: 'tools.drive.editor',     group: 'create', app: 'drive', Icon: PenTool,      keywords: 'editor edit image video pdf doc' },
  { id: 'drive.create',     href: `${FI}/drive/create`,              labelKey: 'tools.drive.create',     group: 'create', app: 'drive', Icon: Sparkles,     keywords: 'create new make generate' },
  { id: 'drive.convert',    href: `${FI}/drive/convert`,             labelKey: 'tools.drive.convert',    group: 'create', app: 'drive', Icon: Repeat,       keywords: 'convert change format png jpg webp pdf mp4 gif csv xlsx json export' },
  { id: 'drive.adDesigner', href: `${FI}/drive/ad-designer`,         labelKey: 'tools.drive.adDesigner', group: 'create', app: 'drive', Icon: Megaphone,    keywords: 'ad designer creative set story reel' },
  { id: 'drive.reel',       href: `${FI}/drive/reel`,                labelKey: 'tools.drive.reel',       group: 'create', app: 'drive', Icon: Film,         keywords: 'reel video photo slideshow' },
  { id: 'drive.web',        href: `${FI}/drive/web`,                 labelKey: 'tools.drive.web',        group: 'create', app: 'drive', Icon: Globe,        keywords: 'web page builder' },
  { id: 'drive.studio',     href: `${FI}/drive/studio`,              labelKey: 'tools.drive.studio',     group: 'create', app: 'drive', Icon: Clapperboard, keywords: 'studio workflow canvas' },
  { id: 'notebook',         href: `${FI}/notebook`,                  labelKey: 'tools.notebook',         group: 'create', app: 'notebook', Icon: BookOpen,  keywords: 'notebook research offers exports ai' },
  { id: 'cloud',            href: `${FI}/cloud`,                     labelKey: 'tools.cloud',            group: 'create', app: 'drive', Icon: Cloud,        keywords: 'cloud bulk upload folders storage' },
  { id: 'cs.home',          href: `${FI}/creative-studio`,           labelKey: 'tools.cs.home',          group: 'create', app: 'creative-studio', Icon: Clapperboard, keywords: 'creative studio agentic workflow' },
  { id: 'cs.adDesigner',    href: `${FI}/creative-studio/ad-designer`, labelKey: 'tools.cs.adDesigner',  group: 'create', app: 'creative-studio', Icon: Megaphone,    keywords: 'ad designer full creative set' },
  { id: 'cs.canvas',        href: `${FI}/creative-studio/canvas`,    labelKey: 'tools.cs.canvas',        group: 'create', app: 'creative-studio', Icon: PenTool,      keywords: 'canvas node graph workflow' },
  { id: 'cs.quick',         href: `${FI}/creative-studio/quick`,     labelKey: 'tools.cs.quick',         group: 'create', app: 'creative-studio', Icon: Sparkles,     keywords: 'quick one click templates' },
  { id: 'cs.reel',          href: `${FI}/creative-studio/reel`,      labelKey: 'tools.cs.reel',          group: 'create', app: 'creative-studio', Icon: Film,         keywords: 'reel maker video' },
  { id: 'cs.presenters',    href: `${FI}/creative-studio/presenters`,labelKey: 'tools.cs.presenters',    group: 'create', app: 'creative-studio', Icon: UserCircle,   keywords: 'presenters avatar spokesperson' },

  // ── Website & content ─────────────────────────────────────────────────────
  { id: 'web.home',       href: `${FI}/ai-manager`,             labelKey: 'tools.web.home',       group: 'web', app: 'ai-manager', Icon: Bot,        keywords: 'web studio site manager auto content' },
  { id: 'web.listings',   href: `${FI}/ai-manager/listings`,    labelKey: 'tools.web.listings',   group: 'web', app: 'ai-manager', Icon: FileText,   keywords: 'listings site pages published' },
  { id: 'web.newListing', href: `${FI}/ai-manager/listings/new`,labelKey: 'tools.web.newListing', group: 'web', app: 'ai-manager', Icon: PlusSquare, keywords: 'new listing publish add' },
  { id: 'web.areas',      href: `${FI}/ai-manager/areas`,       labelKey: 'tools.web.areas',      group: 'web', app: 'ai-manager', Icon: MapPin,     keywords: 'areas communities neighbourhoods' },
  { id: 'web.developers', href: `${FI}/ai-manager/developers`,  labelKey: 'tools.web.developers', group: 'web', app: 'ai-manager', Icon: Landmark,   keywords: 'developers emaar damac nakheel builders' },
  { id: 'web.insights',   href: `${FI}/ai-manager/insights`,    labelKey: 'tools.web.insights',   group: 'web', app: 'ai-manager', Icon: Lightbulb,  keywords: 'insights seo traffic content ideas' },
  { id: 'web.microsites', href: `${FI}/ai-manager/microsites`,  labelKey: 'tools.web.microsites', group: 'web', app: 'ai-manager', Icon: Globe,      keywords: 'microsites project sites' },
  { id: 'web.pages',      href: `${FI}/ai-manager/pages`,       labelKey: 'tools.web.pages',      group: 'web', app: 'ai-manager', Icon: LayoutGrid, keywords: 'pages site structure' },
  { id: 'web.topics',     href: `${FI}/ai-manager/topics`,      labelKey: 'tools.web.topics',     group: 'web', app: 'ai-manager', Icon: Hash,       keywords: 'topics blog articles keywords' },
  { id: 'reviewRequests', href: `${FI}/review-requests`,        labelKey: 'tools.reviewRequests', group: 'web', app: 'ai-manager', Icon: Star, roles: [...MANAGEMENT_ROLES, 'marketing'], keywords: 'reviews testimonials google reviews requests' },

  // ── Analyze & report ──────────────────────────────────────────────────────
  { id: 'an.home',      href: `${FI}/analytics`,           labelKey: 'tools.an.home',      group: 'analyze', app: 'analytics',  Icon: TrendingUp,  keywords: 'analytics traffic visitors conversions' },
  { id: 'an.market',    href: `${FI}/analytics/market`,    labelKey: 'tools.an.market',    group: 'analyze', app: 'analytics',  Icon: LineChart,   keywords: 'market prices trends dubai' },
  { id: 'an.marketing', href: `${FI}/analytics/marketing`, labelKey: 'tools.an.marketing', group: 'analyze', app: 'analytics',  Icon: PieChart,    keywords: 'marketing channels cpl roas' },
  { id: 'an.team',      href: `${FI}/analytics/team`,      labelKey: 'tools.an.team',      group: 'analyze', app: 'analytics',  Icon: UsersRound,  keywords: 'team performance agents leaderboard' },
  { id: 'crm.reports',  href: `${FI}/crm/reports`,         labelKey: 'tools.crm.reports',  group: 'analyze', app: 'crm',        Icon: BarChart3,   keywords: 'crm reports lead reports conversion' },
  { id: 'mg.home',      href: `${FI}/management`,          labelKey: 'tools.mg.home',      group: 'analyze', app: 'management', Icon: BarChart3,   keywords: 'management company overview' },
  { id: 'mg.reports',   href: `${FI}/management/reports`,  labelKey: 'tools.mg.reports',   group: 'analyze', app: 'management', Icon: FileText,    keywords: 'company reports exports' },
  { id: 'mg.roi',       href: `${FI}/management/roi`,      labelKey: 'tools.mg.roi',       group: 'analyze', app: 'management', Icon: Trophy,      keywords: 'roi return spend vs revenue' },
  { id: 'mg.deals',     href: `${FI}/management/deals`,    labelKey: 'tools.mg.deals',     group: 'analyze', app: 'management', Icon: Scale,       keywords: 'deals closed sales commission' },
  { id: 'mg.events',    href: `${FI}/management/events`,   labelKey: 'tools.mg.events',    group: 'analyze', app: 'management', Icon: CalendarCheck,keywords: 'events system log audit' },
  { id: 'mg.team',      href: `${FI}/management/team`,     labelKey: 'tools.mg.team',      group: 'analyze', app: 'management', Icon: UsersRound,  keywords: 'team performance management' },
  { id: 'mg.training',  href: `${FI}/management/training-integrity`, labelKey: 'tools.mg.training', group: 'analyze', app: 'management', Icon: GraduationCap, keywords: 'training integrity coaching compliance' },

  // ── Money ─────────────────────────────────────────────────────────────────
  { id: 'fin.home',        href: `${FI}/finance`,              labelKey: 'tools.fin.home',        group: 'money', app: 'finance', Icon: DollarSign,    keywords: 'finance money revenue overview' },
  { id: 'fin.invoices',    href: `${FI}/finance/invoices`,     labelKey: 'tools.fin.invoices',    group: 'money', app: 'finance', Icon: Receipt,       keywords: 'invoices billing charge client' },
  { id: 'fin.payments',    href: `${FI}/finance/payments`,     labelKey: 'tools.fin.payments',    group: 'money', app: 'finance', Icon: CreditCard,    keywords: 'payments expenses received paid' },
  { id: 'fin.credits',     href: `${FI}/finance/credits`,      labelKey: 'tools.fin.credits',     group: 'money', app: 'finance', Icon: Coins,         keywords: 'credits points allocate top up balance' },
  { id: 'fin.wallets',     href: `${FI}/finance/wallets`,      labelKey: 'tools.fin.wallets',     group: 'money', app: 'finance', Icon: Landmark,      keywords: 'bank wallet ads coin account number transfer treasury capital liquidity ledger' },
  { id: 'fin.creditRules', href: `${FI}/finance/credit-rules`, labelKey: 'tools.fin.creditRules', group: 'money', app: 'finance', Icon: Scale,         keywords: 'credit rules earning quota tiers' },
  { id: 'fin.contracts',   href: `${FI}/finance/contracts`,    labelKey: 'tools.fin.contracts',   group: 'money', app: 'finance', Icon: FileSignature, keywords: 'contracts agreements signatures' },
  { id: 'fin.reports',     href: `${FI}/finance/reports`,      labelKey: 'tools.fin.reports',     group: 'money', app: 'finance', Icon: BarChart3,     keywords: 'finance reports p&l statements' },

  // ── People ────────────────────────────────────────────────────────────────
  { id: 'team.roster',   href: `${FI}/team`,           labelKey: 'tools.team.roster',   group: 'people', app: 'team',     Icon: UsersRound, keywords: 'team roster agents everyone profiles' },
  { id: 'team.teams',    href: `${FI}/team/teams`,     labelKey: 'tools.team.teams',    group: 'people', app: 'team',     Icon: Users,      keywords: 'teams org chart leader reports to structure' },
  { id: 'team.log',      href: `${FI}/team/log`,       labelKey: 'tools.team.log',      group: 'people', app: 'team',     Icon: ClipboardList, keywords: 'authority log audit who did what refused denied dispute' },
  { id: 'settings.team', href: `${FI}/settings/team`,  labelKey: 'tools.settings.team', group: 'people', app: 'settings', Icon: UserPlus,   keywords: 'invite user add member accounts' },
  { id: 'settings.roles',href: `${FI}/settings/roles`, labelKey: 'tools.settings.roles',group: 'people', app: 'settings', Icon: ShieldCheck,keywords: 'roles permissions access who can' },
  // ── Me (broker's own workspace) ───────────────────────────────────────────
  { id: 'agent.home',      href: `${FI}/agent`,           labelKey: 'tools.agent.home',      group: 'me', app: 'agent', Icon: UserCircle,keywords: 'my workspace me personal' },
  { id: 'agent.leads',     href: `${FI}/agent/leads`,     labelKey: 'tools.agent.leads',     group: 'me', app: 'agent', Icon: Users,     keywords: 'my leads mine' },
  { id: 'agent.campaigns', href: `${FI}/agent/campaigns`, labelKey: 'tools.agent.campaigns', group: 'me', app: 'agent', Icon: Megaphone, keywords: 'my campaigns my ads' },
  { id: 'agent.credits',   href: `${FI}/agent/credits`,   labelKey: 'tools.agent.credits',   group: 'me', app: 'agent', Icon: Coins,     keywords: 'my credits points balance' },
  { id: 'agent.ai',        href: `${FI}/agent/ai`,        labelKey: 'tools.agent.ai',        group: 'me', app: 'agent', Icon: Sparkles,  keywords: 'my ai assistant expert' },
  { id: 'agent.bio',       href: `${FI}/agent/bio`,       labelKey: 'tools.agent.bio',       group: 'me', app: 'agent', Icon: UserCircle,keywords: 'my bio public profile page' },
  { id: 'agent.account',   href: `${FI}/agent/account`,   labelKey: 'tools.agent.account',   group: 'me', app: 'agent', Icon: Settings,  keywords: 'my account password profile' },

  // ── Setup & system ────────────────────────────────────────────────────────
  { id: 'int.home',     href: `${FI}/integrations`,          labelKey: 'tools.int.home',     group: 'setup', app: 'integrations', Icon: Plug,       keywords: 'integrations connect apps' },
  { id: 'int.meta',     href: `${FI}/integrations/meta`,     labelKey: 'tools.int.meta',     group: 'setup', app: 'integrations', Icon: Radio,      keywords: 'meta facebook connect ad account page token' },
  { id: 'int.google',   href: `${FI}/integrations/google`,   labelKey: 'tools.int.google',   group: 'setup', app: 'integrations', Icon: SearchIcon, keywords: 'google ads connect customer id' },
  { id: 'int.whatsapp', href: `${FI}/integrations/whatsapp`, labelKey: 'tools.int.whatsapp', group: 'setup', app: 'integrations', Icon: Inbox,      keywords: 'whatsapp business number templates' },
  { id: 'int.hubspot',  href: `${FI}/integrations/hubspot`,  labelKey: 'tools.int.hubspot',  group: 'setup', app: 'integrations', Icon: Plug,       keywords: 'hubspot crm sync' },
  { id: 'int.tracking', href: `${FI}/integrations/tracking`, labelKey: 'tools.int.tracking', group: 'setup', app: 'integrations', Icon: Activity,   keywords: 'tracking gtm analytics tags' },
  { id: 'int.github',   href: `${FI}/integrations/github`,   labelKey: 'tools.int.github',   group: 'setup', app: 'integrations', Icon: GitBranch,  keywords: 'github repository deploy' },
  { id: 'set.home',         href: `${FI}/settings`,               labelKey: 'tools.set.home',         group: 'setup', app: 'settings', Icon: Settings,  keywords: 'settings preferences' },
  { id: 'set.billing',      href: `${FI}/settings/billing`,       labelKey: 'tools.set.billing',      group: 'setup', app: 'settings', Icon: CreditCard,keywords: 'billing subscription plan' },
  { id: 'set.api',          href: `${FI}/settings/api`,           labelKey: 'tools.set.api',          group: 'setup', app: 'settings', Icon: KeyRound,  keywords: 'api tokens keys developers' },
  { id: 'set.automation',   href: `${FI}/settings/automation`,    labelKey: 'tools.set.automation',   group: 'setup', app: 'settings', Icon: Bot,       keywords: 'automation rules triggers workflows' },
  { id: 'set.notifications',href: `${FI}/settings/notifications`, labelKey: 'tools.set.notifications',group: 'setup', app: 'settings', Icon: Bell,      keywords: 'notifications alerts email' },
  { id: 'set.security',     href: `${FI}/settings/security`,      labelKey: 'tools.set.security',     group: 'setup', app: 'settings', Icon: Lock,      keywords: 'security password sessions' },
  { id: 'set.dataSecurity', href: `${FI}/settings/data-security`, labelKey: 'tools.set.dataSecurity', group: 'setup', app: 'settings', Icon: ShieldCheck,keywords: 'data security retention privacy' },
  { id: 'set.data',         href: `${FI}/settings/data`,          labelKey: 'tools.set.data',         group: 'setup', app: 'settings', Icon: Database,  keywords: 'data import export backup' },
  { id: 'set.languages',    href: `${FI}/settings/languages`,     labelKey: 'tools.set.languages',    group: 'setup', app: 'settings', Icon: Languages, keywords: 'languages arabic russian translation' },
  // Personal, per-user surface — open to every role (matches spaces-nav).
  { id: 'set.connect',      href: `${FI}/settings/connect`,       labelKey: 'tools.set.connect',      group: 'setup', app: 'settings', Icon: Sparkles, roles: ALL_ROLES, keywords: 'connect ai claude chatgpt mcp' },
  // System surfaces — management only (matches the /server-status guard; the
  // security matrix exposes the whole company's posture).
  { id: 'security',    href: `${FI}/security`,      labelKey: 'tools.security',    group: 'setup', app: 'settings', Icon: Lock,      roles: MANAGEMENT_ROLES, keywords: 'security posture hardening audit score' },
  { id: 'serverStatus',href: `${FI}/server-status`, labelKey: 'tools.serverStatus',group: 'setup', app: 'settings', Icon: Server,    roles: MANAGEMENT_ROLES, keywords: 'server status uptime health cron' },
  { id: 'help',        href: `${FI}/help`,          labelKey: 'tools.help',        group: 'setup', app: 'settings', Icon: LifeBuoy, roles: ALL_ROLES, keywords: 'help guide how to manual support' },
]

/** Roles allowed to open a tool — the app's guard unless explicitly overridden. */
export function toolRoles(t: ToolDef): Role[] {
  return t.roles ?? rolesForApp(t.app)
}

/** Tools a role may actually reach. Never advertises a door the guard shuts. */
export function visibleTools(role?: Role): ToolDef[] {
  if (!role) return []
  return TOOLS.filter((t) => toolRoles(t).includes(role))
}

/** Fast id → tool lookup (used by the recently-used row). */
const BY_ID = new Map(TOOLS.map((t) => [t.id, t]))
export const toolById = (id: string): ToolDef | undefined => BY_ID.get(id)

/**
 * Match a tool against a typed query. Matches the TRANSLATED label (so an
 * Arabic user searching in Arabic finds it) plus the English keywords and the
 * href (so "pixel" or "/crm/leads" both work).
 */
export function toolMatches(t: ToolDef, q: string, label: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return (
    label.toLowerCase().includes(needle) ||
    (t.keywords ?? '').includes(needle) ||
    t.href.toLowerCase().includes(needle) ||
    t.id.toLowerCase().includes(needle)
  )
}
