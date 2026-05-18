import { z } from "zod"

export const generateAdRequestSchema = z.object({
  projectId: z.string().optional(),
  objective: z.string().default("off-plan inquiry"),
  platform: z.string().default("Meta"),
  buyerType: z.string().default("investor"),
  budgetBand: z.string().default("AED 800K-1.5M"),
  tone: z.string().default("premium"),
})

export const leadRequestSchema = z.object({
  leadId: z.string().optional(),
})

export const notebookRequestSchema = z.object({
  question: z.string().min(3),
  category: z.string().optional(),
  projectId: z.string().optional(),
  leadId: z.string().optional(),
})

export const ownerSessionRequestSchema = z.object({
  propertyType: z.string().default("Apartment"),
  location: z.string().default("Dubai Marina"),
  price: z.string().default("AED 2M"),
  transactionType: z.string().default("sale"),
  ownerGoal: z.string().default("Sell with qualified buyer inquiries"),
  photosStatus: z.string().default("Needs professional photos"),
  budget: z.string().default("AED 5K-10K"),
  sellingPoints: z.string().default("Vacant, canal view, close to metro"),
  contactMethod: z.string().default("WhatsApp"),
})

export type GenerateAdRequest = z.infer<typeof generateAdRequestSchema>
export type NotebookRequest = z.infer<typeof notebookRequestSchema>
export type OwnerSessionRequest = z.infer<typeof ownerSessionRequestSchema>

export type AdGenerationOutput = {
  campaignAngle: string
  headline: string
  shortAdCopy: string
  longAdCopy: string
  instagramCaption: string
  googleSearchHeadlines: string[]
  googleSearchDescriptions: string[]
  whatsappOpener: string
  leadFormQuestions: string[]
  followUpMessage: string
  salesObjections: string[]
  landingPageSection: string
  ctaRecommendation: string
  campaignRiskNotes: string[]
}

export type LeadSummaryOutput = {
  leadSummary: string
  likelyIntent: string
  budgetFit: string
  urgency: string
  recommendedNextAction: string
  whatsappMessage: string
  callScript: string
  objectionToExpect: string
  managerNote: string
}

export type NotebookAnswerOutput = {
  answer: string
  marketReasoning: string
  recommendedAction: string
  relatedProjects: string[]
  riskNotes: string[]
}

export type OwnerSessionOutput = {
  propertyAngle: string
  targetAudience: string
  metaAdCopy: string
  instagramCaption: string
  whatsappScript: string
  leadForm: string[]
  followUpScript: string
  launchChecklist: string[]
  mistakesToAvoid: string[]
}

export type AISource = "Gemini" | "Local engine"

export type AIJsonResponse<T> = {
  source: AISource
  data: T
}
