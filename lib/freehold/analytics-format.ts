// Shared formatting helpers for the Analytics sections.

const SOURCE_LABEL: Record<string, string> = {
  direct: 'Direct', organic: 'Organic', paid: 'Paid', social: 'Social',
  referral: 'Referral', email: 'Email', meta: 'Meta', google: 'Google',
  whatsapp: 'WhatsApp', website: 'Website', landing: 'Landing page',
}

/** Brand/source names aren't translated — humanize unknowns. */
export function prettySource(s: string): string {
  if (!s) return 'Direct'
  return SOURCE_LABEL[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

/** Canonical CRM pipeline order for the funnel. */
export const STAGE_ORDER = ['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed'] as const

/** Compact AED — e.g. AED 1.2M, AED 31.3K. */
export function fmtAed(aed: number): string {
  if (!isFinite(aed)) return 'AED 0'
  const abs = Math.abs(aed)
  if (abs >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `AED ${(aed / 1_000).toFixed(1)}K`
  return `AED ${Math.round(aed).toLocaleString('en-US')}`
}
