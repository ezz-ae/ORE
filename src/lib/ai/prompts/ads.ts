import type { Project } from "@/src/types/project"
import type { GenerateAdRequest } from "@/src/lib/ai/schemas"

export function buildAdsPrompt(project: Project, input: GenerateAdRequest) {
  return `Return only valid JSON for Freehold Intelligence Command Center with keys: campaignAngle, headline, shortAdCopy, longAdCopy, instagramCaption, googleSearchHeadlines, googleSearchDescriptions, whatsappOpener, leadFormQuestions, followUpMessage, salesObjections, landingPageSection, ctaRecommendation, campaignRiskNotes.
Rules: presentation-ready, no official accuracy claims, no guaranteed returns, connect ads to CRM follow-up.
Project: ${JSON.stringify(project)}
Campaign input: ${JSON.stringify(input)}`
}
