import type { Note, NoteCategory } from "@/src/types/note"

const noteSeeds: Array<[string, NoteCategory, string, string[], string[], Note["priority"]]> = [
  ["JVC 1BR WhatsApp angle is converting", "Campaign Angles", "Frame JVC as a rent-renewal alternative plus practical monthly payment route.", ["p-002"], ["l-001"], "High"],
  ["Business Bay needs supply objection handling", "Buyer Objections", "Answer oversupply with micro-location, canal access, and payment-plan suitability.", ["p-001", "p-035"], ["l-002", "l-009"], "High"],
  ["Owner sessions require photo-readiness checkpoint", "Owner Sessions", "Do not launch owner ad spend without photos, valuation logic, and buyer filter.", ["p-003"], ["l-010"], "Medium"],
  ["Al Furjan metro hook", "Areas", "Transport access is the strongest opener. Ask commute location before brochures.", ["p-015"], ["l-003"], "High"],
  ["RAK beachfront needs no-guarantee disclaimer", "Sales Scripts", "Use district thesis and risk notes, never guaranteed performance.", ["p-025"], ["l-007"], "High"],
  ["Dubai Hills family qualification", "Buyer Objections", "Qualify school routes, bedroom need, and mortgage status before selling amenities.", ["p-005"], ["l-008"], "Medium"],
  ["Post-handover copy is strong for mid-budget buyers", "Payment Plans", "Post-handover language reduces anxiety for AED 800K-1.8M buyers.", ["p-001", "p-015", "p-028"], ["l-001", "l-002"], "High"],
  ["Meta forms must filter low-ticket investors", "Meta Ads", "Add cash/finance and decision-timeline questions to protect agent capacity.", ["p-034", "p-027", "p-009"], ["l-013", "l-015"], "High"],
  ["Commercial office ads need lease-versus-buy logic", "Google Ads", "Business Bay commercial buyers respond to ownership cost framing.", ["p-035"], ["l-009"], "Medium"],
  ["Mina Rashid and Maritime City comparison", "Areas", "Build a comparison asset around maturity, payment plan, and exit story.", ["p-019", "p-030"], ["l-018"], "Medium"],
  ["Family townhouse lead form", "Sales Scripts", "Ask current home type, children, school commute, and move timeline before stock.", ["p-011", "p-020", "p-031"], ["l-017"], "Medium"],
  ["Free data access is a partner signal", "Developers", "Verified company access requests can become CRM opportunities or agent-network partners.", ["p-024"], ["l-006"], "High"],
]

export const notes: Note[] = noteSeeds.map((seed, index) => ({
  id: `n-${String(index + 1).padStart(3, "0")}`,
  title: seed[0],
  category: seed[1],
  summary: seed[2],
  relatedProjectIds: seed[3],
  relatedLeadIds: seed[4],
  priority: seed[5],
  createdAt: `2026-05-${String(18 - (index % 9)).padStart(2, "0")}`,
}))
