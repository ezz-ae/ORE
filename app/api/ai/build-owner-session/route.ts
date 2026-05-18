import { NextResponse } from "next/server"
import { buildOwnerSessionFallback } from "@/src/lib/ai/fallbacks"
import { generateJsonWithGemini } from "@/src/lib/ai/gemini"
import { buildOwnerSessionPrompt } from "@/src/lib/ai/prompts/owner-session"
import { ownerSessionRequestSchema } from "@/src/lib/ai/schemas"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = ownerSessionRequestSchema.safeParse(body)
  const input = parsed.success ? parsed.data : ownerSessionRequestSchema.parse({})
  const fallback = buildOwnerSessionFallback(input)
  const result = await generateJsonWithGemini(buildOwnerSessionPrompt(input), fallback)
  return NextResponse.json(result)
}
