/**
 * White-label brand configuration — the SINGLE place to re-brand the product
 * for a new customer. Change these values (and nothing else) to ship the same
 * platform for a different brokerage:
 *
 *   - `company` / `product`   → all visible naming (nav, sign-in, titles)
 *   - `accent`                → drives the --color-gold token, re-skinning every
 *                               button, active state, icon and highlight
 *   - `domain` / `legalName`  → public links and footer
 *
 * Everything else in the UI reads from design tokens, so one edit here is a
 * full re-skin — no per-component changes required.
 */
export interface BrandConfig {
  /** Customer / brokerage display name, e.g. "Freehold". */
  company: string
  /** Product word that follows the company name, e.g. "Intelligence". */
  product: string
  /** Brand accent as a hex colour. Drives --color-gold across the product. */
  accent: string
  /** Public marketing domain. */
  domain: string
  /** Legal entity name (footer / legal pages). */
  legalName: string
  /** Sign-in screen sub-text. */
  tagline: string
}

export const BRAND: BrandConfig = {
  company: 'Freehold',
  product: 'Intelligence',
  accent: '#D4AF37',
  domain: 'freeholdproperty.ae',
  legalName: 'Freehold Property',
  tagline: 'Authorized Personnel Only',
}

/** Full product name, e.g. "Freehold Intelligence". */
export const brandName = `${BRAND.company} ${BRAND.product}`
