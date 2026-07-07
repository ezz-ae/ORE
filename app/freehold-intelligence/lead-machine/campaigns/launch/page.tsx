import { redirect } from 'next/navigation'

// The old dual Meta+Google launch wizard ran on seed listings and mixed the
// platforms. Meta campaigns launch from the real wizard; Google campaigns
// from Google's own builder.
export default function LegacyLaunchRedirect() {
  redirect('/freehold-intelligence/lead-machine/campaigns/new')
}
