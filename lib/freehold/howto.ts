// Guided "How do I…" walkthroughs — task-based coach flows that walk the user
// across pages, step by step (e.g. "Run a Meta lead campaign": connect → pick
// a project → creative → budget → launch → watch it live). The coach engine
// persists progress in sessionStorage so the tour survives page navigation.
//
// Every flow ends ON the page where the user does the real thing — the coach
// guides, the user creates. Flows are the "A" behind the Help centre's Q&A.

export interface HowToStep {
  /** i18n key prefix — `${key}.title` and `${key}.body` must exist. */
  key: string
  /** The page this step happens on; the engine navigates here when needed. */
  href: string
  /** Optional data-coach anchor to spotlight on that page. */
  anchor?: string
}

export interface HowToFlow {
  id: string
  /** i18n key for the flow's name (shown in Help). */
  titleKey: string
  /** Which department of the Help centre this flow belongs to. */
  section: 'ads' | 'crm' | 'inventory' | 'finance' | 'team' | 'analytics' | 'account' | 'broker'
  /** Restrict to these roles (undefined = everyone the pages allow). */
  roles?: string[]
  steps: HowToStep[]
}

const FI = '/freehold-intelligence'

export const HOWTOS: HowToFlow[] = [
  // ── Ads / Lead Machine ─────────────────────────────────────────────────────
  {
    id: 'meta-ad',
    titleKey: 'howto.metaAd.name',
    section: 'ads',
    steps: [
      { key: 'howto.metaAd.s1', href: `${FI}/integrations/meta` },
      { key: 'howto.metaAd.s2', href: `${FI}/lead-machine/campaigns/new`, anchor: 'wiz-listing' },
      { key: 'howto.metaAd.s3', href: `${FI}/lead-machine/campaigns/new`, anchor: 'wiz-creative' },
      { key: 'howto.metaAd.s4', href: `${FI}/lead-machine/campaigns/new`, anchor: 'wiz-budget' },
      { key: 'howto.metaAd.s5', href: `${FI}/lead-machine/campaigns/new`, anchor: 'wiz-launch' },
      { key: 'howto.metaAd.s6', href: `${FI}/ads-live` },
    ],
  },
  {
    id: 'landing-page',
    titleKey: 'howto.landing.name',
    section: 'ads',
    steps: [
      { key: 'howto.landing.s1', href: `${FI}/inventory/landings`, anchor: 'lm-landing-create' },
      { key: 'howto.landing.s2', href: `${FI}/inventory/landings` },
    ],
  },
  {
    id: 'google-ad',
    titleKey: 'howto.googleAd.name',
    section: 'ads',
    steps: [
      { key: 'howto.googleAd.s1', href: `${FI}/integrations/google` },
      { key: 'howto.googleAd.s2', href: `${FI}/lead-machine/google/campaigns/new` },
    ],
  },
  {
    id: 'ai-creative',
    titleKey: 'howto.aiCreative.name',
    section: 'ads',
    steps: [
      { key: 'howto.aiCreative.s1', href: `${FI}/lead-machine/creatives/generate` },
      { key: 'howto.aiCreative.s2', href: `${FI}/lead-machine/campaigns/new`, anchor: 'wiz-creative' },
    ],
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    id: 'add-lead',
    titleKey: 'howto.addLead.name',
    section: 'crm',
    steps: [
      { key: 'howto.addLead.s1', href: `${FI}/crm/leads` },
      { key: 'howto.addLead.s2', href: `${FI}/crm/leads` },
    ],
  },
  {
    id: 'follow-up',
    titleKey: 'howto.followUp.name',
    section: 'crm',
    steps: [
      { key: 'howto.followUp.s1', href: `${FI}/crm/follow-up` },
      { key: 'howto.followUp.s2', href: `${FI}/crm/leads` },
    ],
  },
  {
    id: 'assign-lead',
    titleKey: 'howto.assignLead.name',
    section: 'crm',
    roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'],
    steps: [
      { key: 'howto.assignLead.s1', href: `${FI}/crm/inbox` },
      { key: 'howto.assignLead.s2', href: `${FI}/crm/assignment` },
    ],
  },
  {
    id: 'close-deal',
    titleKey: 'howto.closeDeal.name',
    section: 'crm',
    steps: [
      { key: 'howto.closeDeal.s1', href: `${FI}/crm/board` },
      { key: 'howto.closeDeal.s2', href: `${FI}/management/deals` },
    ],
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  {
    id: 'advertise-project',
    titleKey: 'howto.advertise.name',
    section: 'inventory',
    steps: [
      { key: 'howto.advertise.s1', href: `${FI}/inventory/projects` },
      { key: 'howto.advertise.s2', href: `${FI}/lead-machine/campaigns/new`, anchor: 'wiz-listing' },
    ],
  },

  // ── Cash & Wallet ─────────────────────────────────────────────────────────
  //
  // No role restriction on either: everybody has a wallet, so everybody gets
  // the walkthrough. The bank inside it is gated by the server, not by whether
  // somebody was shown how to send money.
  {
    id: 'send-cash',
    titleKey: 'howto.sendCash.name',
    section: 'finance',
    steps: [
      { key: 'howto.sendCash.s1', href: `${FI}/wallet` },
      { key: 'howto.sendCash.s2', href: `${FI}/wallet` },
      { key: 'howto.sendCash.s3', href: `${FI}/wallet` },
    ],
  },
  {
    id: 'top-up-cash',
    titleKey: 'howto.topUpCash.name',
    section: 'finance',
    steps: [
      { key: 'howto.topUpCash.s1', href: `${FI}/wallet` },
      { key: 'howto.topUpCash.s2', href: `${FI}/wallet` },
      { key: 'howto.topUpCash.s3', href: `${FI}/wallet` },
    ],
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: 'commission',
    titleKey: 'howto.commission.name',
    section: 'finance',
    roles: ['admin', 'ceo', 'director', 'sales_manager'],
    steps: [
      { key: 'howto.commission.s1', href: `${FI}/management/deals` },
      { key: 'howto.commission.s2', href: `${FI}/finance` },
    ],
  },

  // ── Team / Management ─────────────────────────────────────────────────────
  {
    id: 'invite-user',
    titleKey: 'howto.inviteUser.name',
    section: 'team',
    roles: ['admin', 'ceo', 'director', 'sales_manager'],
    steps: [
      { key: 'howto.inviteUser.s1', href: `${FI}/settings/team` },
      { key: 'howto.inviteUser.s2', href: `${FI}/crm/agents` },
    ],
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    id: 'team-performance',
    titleKey: 'howto.teamPerf.name',
    section: 'analytics',
    roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'],
    steps: [
      { key: 'howto.teamPerf.s1', href: `${FI}/analytics` },
      { key: 'howto.teamPerf.s2', href: `${FI}/analytics/team` },
    ],
  },

  // ── Account ───────────────────────────────────────────────────────────────
  {
    id: 'personalize',
    titleKey: 'howto.personalize.name',
    section: 'account',
    steps: [
      { key: 'howto.personalize.s1', href: FI, anchor: 'user-menu' },
      { key: 'howto.personalize.s2', href: FI },
    ],
  },

  // ── Broker workspace ──────────────────────────────────────────────────────
  {
    id: 'bio-link',
    titleKey: 'howto.bioLink.name',
    section: 'broker',
    roles: ['broker'],
    steps: [
      { key: 'howto.bioLink.s1', href: `${FI}/agent/bio` },
      { key: 'howto.bioLink.s2', href: `${FI}/agent/leads` },
    ],
  },
]

export const getHowTo = (id: string): HowToFlow | undefined => HOWTOS.find((h) => h.id === id)

/** Flows visible to a given role (undefined roles ⇒ visible to everyone). */
export const howtosForRole = (role?: string): HowToFlow[] =>
  HOWTOS.filter((h) => !h.roles || (role ? h.roles.includes(role) : false))

/**
 * The one shared "do-it-yourself" starter guide — the most important tasks,
 * IDENTICAL for every role. Order = a sensible path through the product. Only
 * universal flows (no role restriction) are listed, so the guide is genuinely
 * the same for everyone, and every step is a real coach walkthrough.
 */
export const ESSENTIAL_HOWTOS: string[] = ['personalize', 'add-lead', 'follow-up', 'close-deal', 'meta-ad']
