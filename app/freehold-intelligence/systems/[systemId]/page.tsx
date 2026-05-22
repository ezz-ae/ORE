import { redirect } from "next/navigation"

const appIdBySystemId: Record<string, string> = {
  mod_data_eng: "data-engineering",
  mod_ai_learn: "ai-learning",
  mod_crm: "crm-intelligence",
  mod_leadgen: "lead-machine",
  mod_social: "social-media-manager",
  mod_reports: "freehold-ai",
  mod_public_web: "platform-manager",
}

export default async function LegacySystemRoute({ params }: { params: Promise<{ systemId: string }> }) {
  const { systemId } = await params
  redirect(`/freehold-intelligence/apps/${appIdBySystemId[systemId] ?? systemId.replace(/^mod_/, "").replaceAll("_", "-")}`)
}
