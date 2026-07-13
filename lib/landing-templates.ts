// lib/landing-templates.ts
//
// The landing-page template catalog — one source of truth for the landing
// designs, shared by every surface that touches templates: the create route
// (which fills each skeleton with live project data), the Landings picker, the
// editor's "Insert template" control, and the AI chat (which names/recommends a
// template). Adding a design here + a section-builder in the create route is all
// it takes to expose it everywhere.
//
// This module is intentionally dependency-free (type-only import) so client
// components can import it without pulling the DB layer into the browser bundle.
import type { LandingSectionType } from "./landing-pages"

export const LANDING_TEMPLATE_KEYS = ["classic", "campaign", "signature"] as const
export type LandingTemplateKey = (typeof LANDING_TEMPLATE_KEYS)[number]

export interface LandingTemplateMeta {
  key: LandingTemplateKey
  /** i18n keys for the picker + editor UI */
  nameKey: string
  descKey: string
  /** Plain-English hint the AI chat uses to choose a template */
  aiHint: string
  /** Section skeleton — the editor inserts these blocks; the chat describes it. */
  sections: LandingSectionType[]
}

export const LANDING_TEMPLATES: LandingTemplateMeta[] = [
  {
    key: "classic",
    nameKey: "lm.tpl.classic.name",
    descKey: "lm.tpl.classic.desc",
    aiHint:
      "Full brochure — market read, key facts, ROI, amenities, FAQ, AI concierge. Best for warm or returning buyers who want depth before a call.",
    sections: [
      "hero", "market-intelligence", "key-facts", "payment-plan", "roi",
      "amenities", "faq", "why-dubai", "location", "ai-concierge",
      "download-brochure", "lead-form",
    ],
  },
  {
    key: "campaign",
    nameKey: "lm.tpl.campaign.name",
    descKey: "lm.tpl.campaign.desc",
    aiHint:
      "Conversion-first for cold paid (Meta) traffic — lead form right under the hero, scarcity, short. Best page to point ads at.",
    sections: [
      "hero", "lead-form", "payment-plan", "key-facts", "gallery",
      "amenities", "location", "faq", "lead-form",
    ],
  },
  {
    key: "signature",
    nameKey: "lm.tpl.signature.name",
    descKey: "lm.tpl.signature.desc",
    aiHint:
      "Lifestyle & prestige story for premium waterfront and branded communities — visuals and amenities first, Golden Visa & social proof, then capture. Best for signature launches like DAMAC Lagoons.",
    sections: [
      "hero", "gallery", "amenities", "why-dubai", "neighborhood",
      "golden-visa", "payment-plan", "social-proof", "lead-form", "faq",
      "lead-form",
    ],
  },
]

export const landingTemplate = (key: string | null | undefined): LandingTemplateMeta =>
  LANDING_TEMPLATES.find((tpl) => tpl.key === key) ?? LANDING_TEMPLATES[0]

export const isLandingTemplateKey = (key: string): key is LandingTemplateKey =>
  (LANDING_TEMPLATE_KEYS as readonly string[]).includes(key)
