import { redirect } from 'next/navigation'

// The standalone Quick page duplicated what the Creative Studio home already
// embeds (the same _client component, same data). Nothing linked here, so it
// was an invisible second copy of an existing screen — one door, one surface.
// The _client in this directory stays: the home imports it.
export default function QuickGenerateRedirect() {
  redirect('/freehold-intelligence/creative-studio')
}
