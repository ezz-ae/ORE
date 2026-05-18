import type { Lead } from "@/src/types/lead"
import { projects } from "@/src/data/projects"

const leadSeeds = [
  ["Amina Rahman", "+971 50 241 8831", "Meta Lead Form", "p-002", 950000, "First-time buyer", "Qualified", "Hot", "Send WhatsApp with 1BR options and payment-plan breakdown before 4 PM.", "Noura"],
  ["Omar Haddad", "+971 55 812 7740", "WhatsApp Campaign", "p-001", 1800000, "Investor", "Contacted", "Warm", "Call with canal-facing inventory and rental-demand narrative.", "Mahmoud"],
  ["Priya Menon", "+971 58 449 2103", "Google Search", "p-015", 1100000, "End-user", "Viewing", "Priority", "Confirm viewing time and prepare metro-distance talking points.", "Sara"],
  ["Khaled Al Mansoori", "+971 52 907 4511", "Agent Referral", "p-006", 6500000, "High-net-worth", "Negotiation", "Hot", "Send shortlist with view premiums and payment milestones.", "Mahmoud"],
  ["Daniel Foster", "+971 54 608 9032", "TikTok Ad", "p-009", 780000, "First-time buyer", "New", "Warm", "Qualify budget, salary transfer, and payment-plan expectation.", "Omar"],
  ["Fatima Al Qasimi", "+971 56 338 1125", "Free Data Access Request", "p-024", 1250000, "Investor", "Qualified", "Hot", "Share ready-unit comparison and ask if she wants Abu Dhabi-only options.", "Noura"],
  ["Sergey Volkov", "+971 52 118 6719", "Instagram DM", "p-025", 1400000, "Overseas buyer", "Contacted", "Warm", "Send resort-district thesis and call availability in GST-friendly time window.", "Sara"],
  ["Huda Salem", "+971 50 690 7728", "Website Enquiry", "p-005", 2200000, "End-user", "Viewing", "Hot", "Prepare family-lifestyle comparison and school access notes.", "Omar"],
  ["James Mitchell", "+971 55 220 3412", "Google Search", "p-035", 2500000, "Owner-occupier", "Qualified", "Priority", "Send commercial ownership brief and compare lease versus buy.", "Mahmoud"],
  ["Noor Al Habtoor", "+971 58 923 7781", "Owner Session", "p-003", 0, "Owner", "New", "Warm", "Build owner session ad plan and confirm photo status.", "Sara"],
  ["Chen Wei", "+971 56 782 9016", "Meta Lead Form", "p-016", 1600000, "Overseas buyer", "Contacted", "Warm", "Send Dubai Islands district explanation and project shortlist.", "Noura"],
  ["Mariam Issa", "+971 52 301 9822", "WhatsApp Campaign", "p-017", 1050000, "End-user", "Closed", "Hot", "Add closing learnings to notebook for family buyer scripts.", "Omar"],
  ["Ali Reza", "+971 55 770 4509", "Portal Lead", "p-034", 620000, "Investor", "New", "Cold", "Qualify if budget is cash or finance before sending inventory.", "Noura"],
  ["Elena Petrova", "+971 58 511 3902", "Agent Network", "p-014", 4500000, "High-net-worth", "Negotiation", "Priority", "Coordinate with partner agent and send island scarcity angle.", "Mahmoud"],
  ["Bilal Khan", "+971 54 991 2044", "Meta Lead Form", "p-027", 700000, "First-time buyer", "Lost", "Cold", "No immediate action. Save objection: salary transfer not ready.", "Sara"],
  ["Musa Adeyemi", "+971 50 732 6110", "TikTok Ad", "p-012", 760000, "Investor", "Qualified", "Warm", "Send Dubai South location driver deck and 1BR availability.", "Omar"],
  ["Sofia Laurent", "+971 56 440 9833", "Instagram DM", "p-020", 5200000, "End-user", "Viewing", "Hot", "Confirm villa tour and prepare family upgrade comparison.", "Sara"],
  ["Rashid Khan", "+971 52 112 5604", "Website Enquiry", "p-030", 1750000, "Investor", "Contacted", "Warm", "Send district thesis and waterfront comparison to Mina Rashid.", "Mahmoud"],
] as const

export const leads: Lead[] = leadSeeds.map((seed, index) => {
  const project = projects.find((item) => item.id === seed[3]) || projects[0]
  return {
    id: `l-${String(index + 1).padStart(3, "0")}`,
    leadName: seed[0],
    phone: seed[1],
    email: `${seed[0].toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "")}@example.com`,
    source: seed[2],
    interestedProjectId: project.id,
    interestedProjectName: project.projectName,
    budget: seed[4],
    buyerType: seed[5],
    stage: seed[6] as Lead["stage"],
    leadTemperature: seed[7] as Lead["leadTemperature"],
    lastContact: `2026-05-${String(18 - (index % 7)).padStart(2, "0")}`,
    nextAction: seed[8],
    aiSummary: `${seed[0]} is a ${seed[7].toLowerCase()} ${seed[5].toLowerCase()} lead connected to ${project.projectName}. The useful selling angle is: ${project.adAngle}`,
    assignedAgent: seed[9],
    notes: [project.adAngle, project.roiNote, "Capture objection and save learning to Market Notebook after next contact."],
    createdAt: `2026-05-${String(18 - (index % 16)).padStart(2, "0")}`,
  }
})
