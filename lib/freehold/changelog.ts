// Client-facing changelog — the source for the "What's new" panel.
// RULE: only FEATURES / options / things that make the product easier to use.
// Never list bug fixes or internal plumbing (e.g. "fixed Meta integration").
// Bump CHANGELOG_VERSION whenever you add an entry so users see the popup once.

export interface ChangeItem { title: string; body: string }
export interface ChangeEntry {
  version: number
  date: string
  title: string
  items: ChangeItem[]
}

export const CHANGELOG: ChangeEntry[] = [
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
      { title: 'Connect Meta Ads in-app', body: 'Paste your token in Integrations → Meta Ads, pick your ad account + Facebook Page, and launch real campaigns from Freehold.' },
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
