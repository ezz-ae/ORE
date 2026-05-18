export type MarketFile = {
  id: string
  fileName: string
  type: "Brochure" | "Payment plan" | "Floor plan" | "Campaign brief" | "Owner intake" | "Market sheet"
  relatedProjectId?: string
  owner: string
  status: "Indexed" | "Needs review" | "Ready for campaign"
  updatedAt: string
}
