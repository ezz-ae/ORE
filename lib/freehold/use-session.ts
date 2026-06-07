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
 *
 * Pass a single role or an array of allowed roles.
 */
export function useSessionGuard(requireRole?: Role | Role[]): SessionState {
  const router = useRouter()
  const { ready, user } = useSession()

  const roles: Role[] = requireRole
    ? Array.isArray(requireRole) ? requireRole : [requireRole]
    : []

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace('/server')
      return
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      router.replace(user.home)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user])

  const allowed = !!user && (roles.length === 0 || roles.includes(user.role))
  return { ready: ready && allowed, user }
}
