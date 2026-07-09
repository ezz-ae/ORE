// Client-facing error codes for Creative Studio.
//
// The run panel and node cards must NEVER show a raw provider message — lines
// like "Gemini free tier exhausted, enable billing" read to a client as if the
// system is unfinished or broken on our side. Instead we show a short, neutral
// code. Paste the code to the team and we decode it from the map below.
//
// INTERNAL CODE MAP (do not surface to clients):
//   CS-17  provider over quota / rate-limited / billing not enabled (e.g. Gemini free tier)
//   CS-04  API key rejected / invalid / unauthorized (configuration)
//   CS-22  image generation unavailable (Imagen / Gemini image / fal all failed, or no key)
//   CS-23  video generation needs a video-capable provider key
//   CS-08  network / timeout reaching the provider
//   CS-11  provider returned empty or unparseable output
//   CS-01  unclassified — pull the run id and check server logs

export function toStudioErrorCode(raw: string | undefined | null): string {
  const s = (raw || "").toLowerCase()
  if (/quota|rate.?limit|resource_exhausted|(^|\D)429(\D|$)|billing|free.?tier|limit:\s*0/.test(s)) return "CS-17"
  if (/api.?key|api_key_invalid|unauthor|(^|\D)40[13](\D|$)|invalid key|rejected|not valid/.test(s)) return "CS-04"
  if (/imagen|image generation|no image|image gen/.test(s)) return "CS-22"
  if (/\bveo\b|video generation|video needs/.test(s)) return "CS-23"
  if (/network|fetch failed|timeout|timed out|econn|socket|dns|enotfound/.test(s)) return "CS-08"
  if (/no content|returned no|empty|unparse|invalid json|parse failed/.test(s)) return "CS-11"
  return "CS-01"
}

/** The neutral one-line label shown to the client (code included, no jargon). */
export function studioErrorLabel(raw: string | undefined | null): string {
  return `Couldn’t finish this step — code ${toStudioErrorCode(raw)}. Tap retry, or send this code to support.`
}
