/**
 * Client-safe check for Meta CONFIG errors (missing env credentials). Those
 * messages name environment variables — useful to an operator's console, not
 * to a marketer's screen. Pages map them to a friendly, translated
 * "connect Meta in Integrations" hint; real Meta validation errors (budget
 * too low, invalid creative, …) pass through because they are actionable.
 */
export function isMetaConfigErrorMessage(msg: unknown): boolean {
  if (typeof msg !== 'string') return false
  return /not configured|environment variable|META_(ACCESS_TOKEN|AD_ACCOUNT_ID|PAGE_ID|API_VERSION)|missing credential/i.test(msg)
}
