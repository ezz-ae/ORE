import type { Campaign } from "@/src/types/campaign"
import { projects } from "@/src/data/projects"

const campaignProjectIds = ["p-002", "p-001", "p-015", "p-025", "p-005", "p-034", "p-003", "p-030"]
const platforms: Campaign["platform"][] = ["Meta", "WhatsApp", "Google Search", "Instagram", "Meta", "TikTok", "WhatsApp", "Google Search"]

export const campaigns: Campaign[] = campaignProjectIds.map((projectId, index) => {
  const project = projects.find((item) => item.id === projectId) || projects[index]
  return {
    id: `c-${String(index + 1).padStart(3, "0")}`,
    projectId: project.id,
    projectName: project.projectName,
    platform: platforms[index],
    objective: index === 6 ? "owner session" : index % 2 ? "investor lead" : "off-plan inquiry",
    buyerType: project.buyerProfile.split(",")[0],
    angle: project.adAngle,
    headline: `${project.area} Opportunity From AED ${(project.startingPrice / 1_000_000).toFixed(1)}M`,
    shortCopy: `${project.projectName} gives qualified buyers a clear ${project.area} angle with ${project.paymentPlan}.`,
    longCopy: `Freehold can position ${project.projectName} around ${project.salesAngle.toLowerCase()} The campaign should move buyers from ad click to qualified WhatsApp follow-up.`,
    instagramCaption: `${project.area} buyers need price, payment plan, buyer fit, and a clean next step. Ask Freehold for the project brief.`,
    googleHeadlines: [`${project.area} Property`, `${project.projectName}`, "Freehold Property UAE"],
    googleDescriptions: [`Compare ${project.area} options with Freehold.`, "Internal planning intelligence. Verify live inventory before decision."],
    whatsappOpener: `Hi, this is Freehold. You asked about ${project.projectName}. Are you buying to live, invest, or compare payment plans first?`,
    leadFormQuestions: ["Are you buying to live or invest?", "What budget band should we stay within?", "Do you prefer ready or off-plan?"],
    followUpMessage: `I prepared a short ${project.projectName} brief with buyer fit, payment plan, and risk notes. Should I send it here?`,
    objections: ["Payment plan pressure", "Area comparison", "Inventory availability"],
    landingSection: `Show ${project.projectName}, ${project.area}, starting price, payment plan, buyer profile, and WhatsApp CTA.`,
    cta: `Request ${project.area} Brief`,
    createdAt: `2026-05-${String(15 - index).padStart(2, "0")}`,
  }
})
