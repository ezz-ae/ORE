export type NoteCategory =
  | "Areas"
  | "Developers"
  | "Campaign Angles"
  | "Buyer Objections"
  | "Payment Plans"
  | "Owner Sessions"
  | "Sales Scripts"
  | "Meta Ads"
  | "Google Ads"

export type Note = {
  id: string
  title: string
  category: NoteCategory
  summary: string
  relatedProjectIds: string[]
  relatedLeadIds: string[]
  priority: "Low" | "Medium" | "High"
  createdAt: string
}
