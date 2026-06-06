'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSession } from './session'
import type { Role, SessionUser } from './session-types'

interface SessionState {
  ready: boolean
  user: SessionUser | null
}

/** Read the verified session (from /api/server/me). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ ready: false, user: null })

  useEffect(() => {
    let active = true
    fetchSession().then((user) => {
      if (active) setState({ ready: true, user })
    })
    return () => {
      active = false
    }
  }, [])

  return state
}

/**
 * Client guard (belt-and-suspenders on top of middleware): redirects users who
 * shouldn't be here, and returns `ready` only once the correct role is confirmed.
 *   - no session   → /server
 *   - wrong role   → that user's own home
 */
export function useSessionGuard(requireRole?: Role): SessionState {
  const router = useRouter()
  const { ready, user } = useSession()

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/server')
      return
    }
    if (requireRole && user.role !== requireRole) {
      router.replace(user.home)
    }
  }, [ready, user, requireRole, router])

  const allowed = !!user && (!requireRole || user.role === requireRole)
  return { ready: ready && allowed, user }
}
