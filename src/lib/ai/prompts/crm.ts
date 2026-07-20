import type { Lead } from "@/src/types/lead"
import { BRAND } from '@/lib/freehold/brand'

export function buildCrmPrompt(lead: Lead) {
  return `Return only valid JSON for ${BRAND.company} CRM Core with keys: leadSummary, likelyIntent, budgetFit, urgency, recommendedNextAction, whatsappMessage, callScript, objectionToExpect, managerNote.
Make it practical for a real estate manager. Never fake external sync. Lead: ${JSON.stringify(lead)}`
}
