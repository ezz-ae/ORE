import type { Lead } from "@/src/types/lead"

export function buildCrmPrompt(lead: Lead) {
  return `Return only valid JSON for Freehold CRM Core with keys: leadSummary, likelyIntent, budgetFit, urgency, recommendedNextAction, whatsappMessage, callScript, objectionToExpect, managerNote.
Make it practical for a real estate manager. Never fake external sync. Lead: ${JSON.stringify(lead)}`
}
