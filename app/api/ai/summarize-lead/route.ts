import { NextResponse } from "next/server"
import { leads } from "@/src/data/leads"
import { buildLeadSummaryFallback } from "@/src/lib/ai/fallbacks"
import { generateJsonWithGemini } from "@/src/lib/ai/gemini"
import { buildCrmPrompt } from "@/src/lib/ai/prompts/crm"
import { leadRequestSchema } from "@/src/lib/ai/schemas"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = leadRequestSchema.safeParse(body)
  const lead = parsed.success && parsed.data.leadId ? leads.find((item) => item.id === parsed.data.leadId) || leads[0] : leads[0]
  const fallback = buildLeadSummaryFallback(lead)
  const result = await generateJsonWithGemini(buildCrmPrompt(lead), fallback)
  return NextResponse.json(result)
}
