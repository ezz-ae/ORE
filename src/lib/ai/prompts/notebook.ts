import type { NotebookRequest } from "@/src/lib/ai/schemas"
import type { Project } from "@/src/types/project"
import type { Note } from "@/src/types/note"

export function buildNotebookPrompt(input: NotebookRequest, projectContext: Project[], noteContext: Note[]) {
  return `Return only valid JSON for Freehold Market Notebook with keys: answer, marketReasoning, recommendedAction, relatedProjects, riskNotes.
Treat all data as internal intelligence and connect the answer to CRM, ads, or manager action.
Question: ${input.question}
Projects: ${JSON.stringify(projectContext)}
Notes: ${JSON.stringify(noteContext)}`
}
