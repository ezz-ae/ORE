const FALLBACK_SITE_URL = "https://www.freeholdproperty.ae"

const ensureProtocol = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`

export const getSiteUrl = () => {
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.METADATA_BASE ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    FALLBACK_SITE_URL

  return ensureProtocol(rawSiteUrl).replace(/\/$/, "")
}

export const getMetadataBase = () => new URL(getSiteUrl())

export const BRAND_OG_IMAGE = "/og-image.png"
export const BRAND_AI_OG_IMAGE = "/ai-og.png"

// ─── Company contact details (single source of truth) ──────────────────────────
// Used across the public site for WhatsApp links, call buttons, and forms.
export const COMPANY_PHONE = "+971 50 417 3622"
export const COMPANY_PHONE_E164 = "+971504173622"
/** Digits only — for wa.me/ and tel: links */
export const COMPANY_WHATSAPP_NUMBER = "971504173622"
export const COMPANY_WHATSAPP_URL = "https://wa.me/971504173622"
export const COMPANY_EMAIL = "info@freeholdproperty.ae"

/** Build a WhatsApp deep link with an optional prefilled message. */
export const buildWhatsAppUrl = (message?: string) =>
  message
    ? `${COMPANY_WHATSAPP_URL}?text=${encodeURIComponent(message)}`
    : COMPANY_WHATSAPP_URL

