import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Single source for the AI-SDK Gemini model used by the coordinator chat.
// Mirrors the model names lib/gemini-rest.ts already uses.
export const EXPERT_MODEL = 'gemini-2.0-flash'

export function expertModel(modelName: string = EXPERT_MODEL) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const google = createGoogleGenerativeAI({ apiKey })
  return google(modelName)
}
