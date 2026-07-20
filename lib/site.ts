import { BRAND } from "@/lib/freehold/brand"

const ensureProtocol = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`

/**
 * Canonical public site URL (server-side). Resolution order:
 * NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_BASE_URL → METADATA_BASE →
 * Vercel-provided URLs → https://www.<brand domain>.
 * Setting NEXT_PUBLIC_SITE_URL alone is enough for a new deployment.
 */
export const getSiteUrl = () => {
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.METADATA_BASE ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    `https://www.${BRAND.domain}`

  return ensureProtocol(rawSiteUrl.trim()).replace(/\/$/, "")
}

export const getMetadataBase = () => new URL(getSiteUrl())

export const BRAND_OG_IMAGE = "/og-image.png"
export const BRAND_AI_OG_IMAGE = "/ai-og.png"

// ─── Company contact details (derived from BRAND — lib/freehold/brand.ts) ──────
// Used across the public site for WhatsApp links, call buttons, and forms.
// Re-brand via NEXT_PUBLIC_BRAND_* environment variables; see DEPLOYMENT.md.
export const COMPANY_PHONE = BRAND.phone
export const COMPANY_PHONE_E164 = BRAND.phoneE164
/** Digits only — for wa.me/ and tel: links */
export const COMPANY_WHATSAPP_NUMBER = BRAND.whatsappNumber
export const COMPANY_WHATSAPP_URL = `https://wa.me/${BRAND.whatsappNumber}`
export const COMPANY_EMAIL = BRAND.email

/** Build a WhatsApp deep link with an optional prefilled message. */
export const buildWhatsAppUrl = (message?: string) =>
  message
    ? `${COMPANY_WHATSAPP_URL}?text=${encodeURIComponent(message)}`
    : COMPANY_WHATSAPP_URL
