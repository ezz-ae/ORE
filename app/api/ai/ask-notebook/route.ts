import { NextResponse } from "next/server"
import { notes } from "@/src/data/notes"
import { projects } from "@/src/data/projects"
import { buildNotebookFallback } from "@/src/lib/ai/fallbacks"
import { generateJsonWithGemini } from "@/src/lib/ai/gemini"
import { buildNotebookPrompt } from "@/src/lib/ai/prompts/notebook"
import { notebookRequestSchema } from "@/src/lib/ai/schemas"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = notebookRequestSchema.safeParse(body)
  const input = parsed.success ? parsed.data : { question: "What should Freehold do with today's market signals?" }
  const projectContext = input.projectId ? projects.filter((project) => project.id === input.projectId) : projects.slice(0, 8)
  const noteContext = input.category ? notes.filter((note) => note.category === input.category).slice(0, 6) : notes.slice(0, 8)
  const fallback = buildNotebookFallback(input)
  const result = await generateJsonWithGemini(buildNotebookPrompt(input, projectContext, noteContext), fallback)
  return NextResponse.json(result)
}
