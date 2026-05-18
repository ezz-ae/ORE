import type { Project } from "@/src/types/project"
import type { Lead } from "@/src/types/lead"
import type {
  AdGenerationOutput,
  GenerateAdRequest,
  LeadSummaryOutput,
  NotebookAnswerOutput,
  NotebookRequest,
  OwnerSessionOutput,
  OwnerSessionRequest,
} from "@/src/lib/ai/schemas"
import { projects } from "@/src/data/projects"
import { leads } from "@/src/data/leads"
import { notes } from "@/src/data/notes"
import { formatAED } from "@/src/lib/freehold-format"

export function buildAdFallback(project: Project = projects[0], input?: Partial<GenerateAdRequest>): AdGenerationOutput {
  const buyerType = input?.buyerType || "investor"
  const platform = input?.platform || "Meta"
  const objective = input?.objective || "off-plan inquiry"

  return {
    campaignAngle: `${project.adAngle} Position ${project.projectName} for ${buyerType} buyers with a ${platform} campaign focused on ${objective}.`,
    headline: `${project.area} Opportunity From ${formatAED(project.startingPrice)}`,
    shortAdCopy: `${project.projectName} gives qualified buyers a clear ${project.area} entry point with ${project.paymentPlan}.`,
    longAdCopy: `Freehold can position ${project.projectName} around ${project.salesAngle.toLowerCase()} The campaign should move buyers from curiosity into a qualified WhatsApp conversation by showing starting price, payment structure, buyer fit, and the next action without making official return claims.`,
    instagramCaption: `${project.area} buyers are not looking for another brochure. They need price, payment plan, buyer fit, and a clear next step. Ask Freehold for the ${project.projectName} brief.`,
    googleSearchHeadlines: [`${project.area} Property`, `${project.projectName}`, `${formatAED(project.startingPrice)} Entry`, "Freehold Property UAE"],
    googleSearchDescriptions: [
      `Compare ${project.area} units, payment plan, buyer fit, and next steps with Freehold.`,
      "Internal planning data for campaign execution. Speak with an advisor before deciding.",
      `Request a focused ${project.area} shortlist instead of a generic brochure.`,
    ],
    whatsappOpener: `Hi, this is Freehold Property UAE. You asked about ${project.projectName}. Are you buying to live, invest, or compare payment plans first?`,
    leadFormQuestions: [
      "Are you buying to live, invest, or compare options?",
      "What budget band should the advisor stay within?",
      "Do you prefer ready property or off-plan payment flexibility?",
      `Is ${project.area} your first choice or one of several areas?`,
    ],
    followUpMessage: `I prepared a short ${project.projectName} brief with price, payment plan, buyer fit, and risk notes. Should I send the quick version here or book a 10-minute call?`,
    salesObjections: ["I need proof this area has enough demand.", "The payment plan may be too heavy.", "I am comparing another area with a lower entry price."],
    landingPageSection: `A tight landing section should show ${project.projectName}, ${project.area}, ${formatAED(project.startingPrice)} starting price, ${project.paymentPlan}, buyer profile, risk notes, and a WhatsApp-first CTA.`,
    ctaRecommendation: `Request ${project.area} Campaign Brief`,
    campaignRiskNotes: ["Label this as internal planning intelligence, not official availability or investment advice.", "Confirm live inventory and payment plan before launching spend.", "Qualify buyer intent before sending full brochures."],
  }
}

export function buildLeadSummaryFallback(lead: Lead = leads[0]): LeadSummaryOutput {
  return {
    leadSummary: `${lead.leadName} is a ${lead.leadTemperature.toLowerCase()} ${lead.buyerType.toLowerCase()} lead interested in ${lead.interestedProjectName}. Their current budget is ${formatAED(lead.budget)} and the next action is: ${lead.nextAction}`,
    likelyIntent: lead.buyerType === "Owner" ? "Owner wants a structured property marketing session." : `Likely ${lead.buyerType.toLowerCase()} intent with project-specific comparison needs.`,
    budgetFit: lead.budget > 0 ? `${formatAED(lead.budget)} should be checked against current inventory and payment-plan pressure.` : "No buyer budget because this is an owner-side opportunity.",
    urgency: lead.leadTemperature === "Priority" || lead.leadTemperature === "Hot" ? "High. Same-day manager visibility recommended." : "Medium. Follow up with a concise qualifier before sending brochures.",
    recommendedNextAction: lead.nextAction,
    whatsappMessage: `Hi ${lead.leadName.split(" ")[0]}, this is Freehold. I reviewed your interest in ${lead.interestedProjectName}. Should I send the payment-plan brief, the buyer-fit summary, or book a quick call?`,
    callScript: `Open with their stated interest in ${lead.interestedProjectName}, confirm budget and purpose, ask what would stop them from moving forward, then offer one clear next step.`,
    objectionToExpect: "Expect questions around payment pressure, market demand, and whether this is the right area compared with nearby alternatives.",
    managerNote: `Manager action: keep ${lead.assignedAgent} focused on one next step and capture the objection in the Market Notebook after the call.`,
  }
}

export function buildNotebookFallback(input: NotebookRequest): NotebookAnswerOutput {
  const related = projects
    .filter((project) => `${project.projectName} ${project.area} ${project.tags.join(" ")}`.toLowerCase().includes(input.question.toLowerCase().split(" ")[0] || "dubai"))
    .slice(0, 4)
  const fallbackRelated = related.length ? related : projects.slice(0, 4)
  const noteContext = notes.slice(0, 3).map((note) => note.title).join(", ")

  return {
    answer: "The strongest operational answer is to connect the market question to a campaign and CRM action, not leave it as research.",
    marketReasoning: `Relevant internal memory includes: ${noteContext}. Internal planning data suggests campaigns perform better when the area thesis, budget fit, and next action are explicit.`,
    recommendedAction: "Create a focused campaign brief, attach it to a CRM opportunity, and save the resulting objection or buyer signal back to the notebook.",
    relatedProjects: fallbackRelated.map((project) => project.projectName),
    riskNotes: ["This is internal planning intelligence and must be checked against live inventory.", "Do not present projected returns as guaranteed.", "Route high-intent leads into same-day WhatsApp or call follow-up."],
  }
}

export function buildOwnerSessionFallback(input: OwnerSessionRequest): OwnerSessionOutput {
  return {
    propertyAngle: `${input.location} ${input.propertyType} positioned as a structured ${input.transactionType} campaign, not a passive listing. Lead with the owner goal: ${input.ownerGoal}.`,
    targetAudience: `Qualified ${input.transactionType === "rent" ? "tenants" : "buyers"} who already understand ${input.location} and need proof of value, property condition, and next-step clarity.`,
    metaAdCopy: `Selling or renting a ${input.propertyType} in ${input.location}? Freehold builds the advertising system around the property: buyer angle, lead filter, WhatsApp script, and launch checklist before the campaign goes live.`,
    instagramCaption: "A property campaign should not start with a listing. It starts with the buyer angle, photos, follow-up script, and a clean launch plan.",
    whatsappScript: `Hi, this is Freehold Property UAE. We can build the campaign system around your ${input.location} ${input.propertyType}. Are the photos ready, and is your priority speed, price, or qualified inquiries?`,
    leadForm: ["Is the property vacant, rented, or owner-occupied?", "Are professional photos ready?", "What is the target price or rent range?", "Is the priority speed, price, or lead quality?"],
    followUpScript: "Thanks for sharing the property details. I will map the ad angle, target buyer, photo readiness, lead filter, and launch checklist before we decide the campaign channel.",
    launchChecklist: ["Confirm price expectation against comparable listings.", "Check photo quality and missing media.", "Define buyer profile and disqualifying questions.", "Prepare WhatsApp follow-up script.", "Confirm campaign budget and response owner."],
    mistakesToAvoid: ["Launching ads before photos and price logic are ready.", "Using generic luxury copy without buyer filters.", "Treating every inquiry as equal instead of scoring intent.", "Claiming performance or valuation certainty without verification."],
  }
}
