// Broker lead-ownership keys.
//
// `freehold_site_leads.assigned_broker_id` historically holds EITHER the
// broker's user id OR their email — it depends on who (or what) assigned the
// lead (manual assign, automation, landing-page capture). Ownership checks that
// match on only one of those can therefore hide a broker's OWN lead: the lead
// list may show it (matched one way) while the profile 404s (matched the
// other), or a PATCH is rejected 403. Matching on either key removes that whole
// class of false negatives.
export function brokerOwnerKeys(user: { brokerId?: string | null; email?: string | null }): string[] {
  return [user.brokerId, user.email].filter((v): v is string => !!v)
}
