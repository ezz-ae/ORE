import { NextResponse } from "next/server"
import { projects } from "@/src/data/projects"
import { buildAdFallback } from "@/src/lib/ai/fallbacks"
import { generateJsonWithGemini } from "@/src/lib/ai/gemini"
import { buildAdsPrompt } from "@/src/lib/ai/prompts/ads"
import { generateAdRequestSchema } from "@/src/lib/ai/schemas"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = generateAdRequestSchema.safeParse(body)
  const input = parsed.success ? parsed.data : generateAdRequestSchema.parse({})
  const project = projects.find((item) => item.id === input.projectId) || projects[0]
  const fallback = buildAdFallback(project, input)
  const result = await generateJsonWithGemini(buildAdsPrompt(project, input), fallback)
  return NextResponse.json(result)
}
