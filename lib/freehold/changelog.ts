import { BRAND } from '@/lib/freehold/brand'
// Client-facing changelog — the source for the "What's new" panel.
// RULE: only FEATURES / options / things that make the product easier to use.
// Never list bug fixes or internal plumbing (e.g. "fixed Meta integration").
// Bump CHANGELOG_VERSION whenever you add an entry so users see the popup once.

export interface ChangeItem {
  title: string
  body: string
  /** Show only to these roles (undefined = everyone). Filtered in the panel. */
  roles?: string[]
}
export interface ChangeEntry {
  version: number
  date: string
  title: string
  items: ChangeItem[]
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: 7,
    date: '2026-07-20',
    title: 'The Ads Machine, instant forms & smarter leads',
    items: [
      { title: 'Ads Machine — ads that run themselves', body: 'Pick your projects, set one daily cap, and the machine builds a cross-channel plan (Meta audience trials + Google search), launches with in-ad qualification forms, watches the real results, and moves budget from the losers to the winners — always inside your cap. It asks your team a quick “how good was this lead?” and learns from the answer. Open Ads → Ads Machine.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
      { title: 'Build a Meta lead form here — every option', body: 'Ads → Lead forms → New form: a five-step builder with everything Ads Manager offers — form type, an intro from the listing’s real facts, the full contact catalog with SMS phone verification, buyer-qualifying questions (budget bands built around the listing’s real price, timeline, purpose) and after-submit buttons. Start from a ready template or duplicate an existing form. No more “go make it on Meta”.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
      { title: 'Which project deserves the next dirham', body: 'Inventory now scores each project’s opportunity from real signals — price vs its area, payment-plan strength, ad readiness, area momentum and proven lead history — with the evidence behind every score. Sort by it, and the Ads Machine weights budget toward it.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
      { title: 'Leads that tell you more', body: 'A lead from a landing page now carries a behaviour score, likely buyer intent and purchase probability read from how they actually browsed — and the intent from the ad they clicked, shown side by side on the lead’s page.' },
      { title: 'Viewings, offers & a response clock', body: 'Book a viewing from a lead (it lands on the calendar), log the outcome or an offer, and — with an SLA target set in Settings → Automation — the follow-up list flags any lead you haven’t answered in time. Team analytics show median response time, viewing rate and offer rate per agent.' },
      { title: 'A sharper Expert', body: 'The Expert now reasons with a stronger model, reads what’s on your screen as the source of truth, and does the work itself — it fetches the ad or budget it needs instead of asking you for an ID.' },
      { title: 'Landing pages that match the buyer', body: 'One project page now adapts to the buyer the ad targeted — an investor sees ROI and payment plan first, a family sees amenities and location — built only from the facts the page really has.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
    ],
  },
  {
    version: 6,
    date: '2026-07-12',
    title: 'Audiences, smarter campaign setup & a chat that acts',
    items: [
      { title: 'Audiences tab', body: 'Ads → Audiences: build behavioral audiences on Meta’s live vocabulary (real segments, real sizes), narrow with AND-rules, exclude who you don’t want, and upload a lead list to create a lookalike. Attach any saved audience to a campaign in one click.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
      { title: 'New launches without a landing page', body: 'Campaign setup starts with Campaign Sources: upload the brochure or paste the listing/developer link and the AI writes the ad from it. The landing URL is optional — empty uses the project’s public page.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
      { title: 'Preview all placements', body: 'On the creative step, one click shows your ad across Facebook Feed, Instagram Feed, Stories and Reels — before anything launches.', roles: ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] },
      { title: 'The chat takes real actions', body: 'Ask the Expert to analyse a campaign, edit a live ad’s copy, create a Meta lead form, or rank your audiences for a listing. Every action it takes shows as an “Actions taken” chip on the reply — work you can verify, not talk.' },
      { title: 'Notebook writes from your real data', body: 'The generator (brochures, ad copy, market reports, WhatsApp messages…) now grounds on your live inventory, market intelligence and campaign results — and “Edit in Drive editor” turns any output into an editable document.' },
    ],
  },
  {
    version: 5,
    date: '2026-07-02',
    title: 'Your own shareable bio link',
    items: [
      { title: 'Agent bio link + QR', body: 'Open My Workspace → Bio Link to build a public page with your photo, contact buttons and featured projects. Share the link or QR in your Instagram/WhatsApp bio.' },
      { title: 'Leads land in your CRM', body: 'When someone fills in the form on your bio page, the lead is created and assigned to you automatically — no copy-paste.' },
    ],
  },
  {
    version: 4,
    date: '2026-07-02',
    title: 'See exactly where every commission goes',
    items: [
      { title: 'Full commission breakdown', body: 'Deals now capture the complete waterfall — agency commission, referral, cashback, expenses, growth fund, broker payout and company net. Enter each on the deal and watch the split update live.' },
      { title: 'Company breakdown on Finance', body: 'The Finance overview rolls the whole book up: referral, cashback, expenses, growth, broker payouts and what the company keeps — across all approved deals.' },
    ],
  },
  {
    version: 3,
    date: '2026-07-02',
    title: 'Personalise your workspace',
    items: [
      { title: 'Light mode', body: 'Switch between the dark and light look from the account menu (top-right), next to Language. Your choice is remembered.' },
      { title: 'What’s new panel', body: 'This panel. Whenever we add something to make your work easier, you’ll see it here — open it any time from the account menu.' },
    ],
  },
  {
    version: 2,
    date: '2026-07-01',
    title: 'Connect your own ad & messaging accounts',
    items: [
      { title: 'Connect Meta Ads in-app', body: 'Paste your token in Integrations → Meta Ads, pick your ad account + Facebook Page, and launch real campaigns from ' + BRAND.company + '.' },
      { title: 'Connect WhatsApp in-app', body: 'Connect your WhatsApp Business number in Integrations → WhatsApp and the CRM can message leads directly.' },
      { title: 'Advertise a project in one click', body: 'From an inventory project or a generated listing, jump straight into the campaign builder pre-filled with that project.' },
    ],
  },
  {
    version: 1,
    date: '2026-06-30',
    title: 'Faster follow-ups & clearer numbers',
    items: [
      { title: 'Instant broker notifications', body: 'When a lead is assigned to you, you get an email with the lead details and a direct link — respond in minutes.' },
      { title: 'Commission at a glance', body: 'Your account page shows real commission from your deals: gross, received and outstanding.' },
      { title: 'Deal-linked sales on inventory', body: 'Each project now shows the deals booked against it — sales value and commission earned.' },
    ],
  },
]

export const CHANGELOG_VERSION = CHANGELOG.length ? CHANGELOG[0].version : 0
const SEEN_KEY = 'fh-whatsnew-seen'

export function getSeenVersion(): number {
  if (typeof window === 'undefined') return CHANGELOG_VERSION
  const v = Number(window.localStorage.getItem(SEEN_KEY))
  return Number.isFinite(v) ? v : 0
}

export function markChangelogSeen(): void {
  try { window.localStorage.setItem(SEEN_KEY, String(CHANGELOG_VERSION)) } catch { /* ignore */ }
}

export function hasUnseenChanges(): boolean {
  return getSeenVersion() < CHANGELOG_VERSION
}
