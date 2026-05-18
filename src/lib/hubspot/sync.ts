import type { Lead } from "@/src/types/lead"
import { getHubSpotStatus } from "@/src/lib/hubspot/client"
import { mapLeadToHubSpotContact } from "@/src/lib/hubspot/mappers"

export async function syncLeadToHubSpot(lead: Lead) {
  const status = getHubSpotStatus()
  if (!status.connected) {
    return { ok: false, status: "not_connected" as const, message: "HubSpot is not connected. No sync was attempted." }
  }
  return {
    ok: false,
    status: "scaffold_only" as const,
    message: "HubSpot token detected, but sync is blocked until field mapping is approved.",
    payload: mapLeadToHubSpotContact(lead),
  }
}
