'use client'

import { CalendarBoard } from '@/components/calendar/calendar-board'
import { useSessionGuard } from '@/lib/freehold/use-session'

// The whole company sees the same operations calendar — any signed-in role.
export default function CalendarPage() {
  const { ready } = useSessionGuard()
  if (!ready) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-gold" />
    </div>
  )
  return <CalendarBoard />
}
