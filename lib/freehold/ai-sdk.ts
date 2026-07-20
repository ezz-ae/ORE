import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Single source for the AI-SDK Gemini model used by the coordinator chat.
// Pro tier: the coordinator reasons across tool results — flash-tier models
// produced wrong-entity answers and asked users for ids their own tools could
// fetch.
export const EXPERT_MODEL = 'gemini-2.5-pro'

export function expertModel(modelName: string = EXPERT_MODEL) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const google = createGoogleGenerativeAI({ apiKey })
  return google(modelName)
}
