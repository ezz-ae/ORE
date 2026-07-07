// Guided "How do I…" walkthroughs — task-based coach flows that walk the user
// across pages, step by step (e.g. "Run a Meta lead campaign": connect → pick
// a project → creative → budget → launch → watch it live). The coach engine
// persists progress in sessionStorage so the tour survives page navigation.

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
  steps: HowToStep[]
}

export const HOWTOS: HowToFlow[] = [
  {
    id: 'meta-ad',
    titleKey: 'howto.metaAd.name',
    steps: [
      { key: 'howto.metaAd.s1', href: '/freehold-intelligence/integrations/meta' },
      { key: 'howto.metaAd.s2', href: '/freehold-intelligence/lead-machine/campaigns/new', anchor: 'wiz-listing' },
      { key: 'howto.metaAd.s3', href: '/freehold-intelligence/lead-machine/campaigns/new', anchor: 'wiz-creative' },
      { key: 'howto.metaAd.s4', href: '/freehold-intelligence/lead-machine/campaigns/new', anchor: 'wiz-budget' },
      { key: 'howto.metaAd.s5', href: '/freehold-intelligence/lead-machine/campaigns/new', anchor: 'wiz-launch' },
      { key: 'howto.metaAd.s6', href: '/freehold-intelligence/ads-live' },
    ],
  },
]

export const getHowTo = (id: string): HowToFlow | undefined => HOWTOS.find((h) => h.id === id)
