import { redirect } from 'next/navigation'

// The Ads launcher is absorbed by the Lead Machine — the app that actually
// runs ads, generates leads and learns from each step. Old links keep working.
export default function AdsLauncher() {
  redirect('/freehold-intelligence/lead-machine')
}
