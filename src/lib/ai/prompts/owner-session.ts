import type { OwnerSessionRequest } from "@/src/lib/ai/schemas"

export function buildOwnerSessionPrompt(input: OwnerSessionRequest) {
  return `Return only valid JSON for a paid Freehold owner session with keys: propertyAngle, targetAudience, metaAdCopy, instagramCaption, whatsappScript, leadForm, followUpScript, launchChecklist, mistakesToAvoid.
Positioning: We do not sell leads. We build the advertising system around the property.
Owner intake: ${JSON.stringify(input)}`
}
