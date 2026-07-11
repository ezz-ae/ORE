/**
 * Map raw AI-provider errors to messages a real-estate professional can act
 * on. The full raw error is logged server-side for operators; the user never
 * sees env-var names, HTTP codes, or deployment instructions.
 */
export function userSafeAiError(err: unknown, fallback = 'The AI couldn’t process this request — try again shortly.'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  console.error('[ai] provider error:', raw)
  if (/403|forbidden|permission|api.?key|not configured|unauthorized|invalid key/i.test(raw)) {
    return 'The AI service isn’t enabled for this workspace yet — ask your administrator to switch it on under Integrations.'
  }
  if (/quota|rate.?limit|429|resource.*exhausted|overloaded|503/i.test(raw)) {
    return 'The AI service is at its usage limit right now — try again in a few minutes.'
  }
  return fallback
}
