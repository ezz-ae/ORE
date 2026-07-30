import { redirect } from 'next/navigation'

// The old Generative Studio hub is absorbed by the Creative Suite — one front
// door for every design tool. Old links keep working via this redirect.
export default function GenerativeStudioPage() {
  redirect('/freehold-intelligence/drive/create')
}
