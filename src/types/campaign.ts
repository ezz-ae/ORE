export type CampaignPlatform = "Meta" | "Instagram" | "Google Search" | "WhatsApp" | "TikTok"

export type Campaign = {
  id: string
  projectId: string
  projectName: string
  platform: CampaignPlatform
  objective: string
  buyerType: string
  angle: string
  headline: string
  shortCopy: string
  longCopy: string
  instagramCaption: string
  googleHeadlines: string[]
  googleDescriptions: string[]
  whatsappOpener: string
  leadFormQuestions: string[]
  followUpMessage: string
  objections: string[]
  landingSection: string
  cta: string
  createdAt: string
}
