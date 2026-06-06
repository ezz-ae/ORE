'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, type Role, type SessionUser } from './session'

interface GuardState {
  ready: boolean
  user: SessionUser | null
}

/**
 * Client-side route guard. Reads the session, and if `requireRole` is given,
 * redirects users who don't hold that role:
 *   - no session        → /server (login)
 *   - wrong role         → that user's own home
 * Returns { ready, user } so the page can render a spinner until resolved.
 */
export function useSessionGuard(requireRole?: Role): GuardState {
  const router = useRouter()
  const [state, setState] = useState<GuardState>({ ready: false, user: null })

  useEffect(() => {
    const user = getSession()
    if (!user) {
      router.replace('/server')
      return
    }
    if (requireRole && user.role !== requireRole) {
      router.replace(user.home)
      return
    }
    setState({ ready: true, user })
  }, [router, requireRole])

  return state
}
