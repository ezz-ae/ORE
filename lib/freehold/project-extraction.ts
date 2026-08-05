// The ONE "source → project fields" extraction contract, shared by
// /api/dashboard/projects/parse-brochure (PDF) and
// /api/dashboard/projects/parse-source (link / pasted text) so every intake
// path produces the exact same field shape for the same confirm-fields modal.

/** Build the extraction prompt around a source block (brochure text, attached
 *  PDF note, web-page text or pasted text). */
export const buildProjectExtractionPrompt = (sourceBlock: string) => `You are an AI data extraction engine for real estate brochures.
Return ONLY valid JSON. No markdown.

Extract these fields from the brochure text:
{
  "name": string,
  "slug": string,
  "area": string,
  "developer": string,
  "priceFrom": number | null,
  "priceTo": number | null,
  "roi": number | null,
  "paymentPlan": string,
  "handoverDate": string,
  "description": string,
  "highlights": string[],
  "amenities": string[]
}

Rules:
- slug should be URL-safe and start with "freehold-".
- priceFrom/priceTo should be numbers in AED (no commas).
- roi should be a number (percent) without the % sign.
- If any field is not found, return null or an empty string/array.

${sourceBlock}
`

/** Pull the first {...} JSON object out of a model reply (or null). */
export const extractJsonBlock = (value: string): Record<string, unknown> | null => {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start === -1 || end === -1) return null
  const snippet = value.slice(start, end + 1)
  try {
    return JSON.parse(snippet) as Record<string, unknown>
  } catch {
    return null
  }
}
