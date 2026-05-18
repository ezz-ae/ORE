export function getHubSpotStatus() {
  const connected = Boolean(process.env.HUBSPOT_ACCESS_TOKEN)
  return {
    connected,
    label: connected ? "Connected" : "Not Connected",
    message: connected ? "HubSpot token is configured server-side. Field mapping approval is still required." : "HubSpot access token is missing. No sync will be attempted.",
  }
}
