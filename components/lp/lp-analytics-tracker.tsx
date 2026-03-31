"use client"

import { useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

interface LpAnalyticsTrackerProps {
  landingSlug: string
  projectSlug: string
}

const TRACKED_DEPTHS = [25, 50, 75, 100]

export function LpAnalyticsTracker({ landingSlug, projectSlug }: LpAnalyticsTrackerProps) {
  const path = usePathname()
  const params = useSearchParams()
  const trackedDepthsRef = useRef<Set<number>>(new Set())

  const utm = useMemo(
    () => ({
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      term: params.get("utm_term") || "",
      content: params.get("utm_content") || "",
      id: params.get("utm_id") || "",
    }),
    [params],
  )

  const getSessionId = () => {
    if (typeof window === "undefined") return ""
    const key = `lp-session:${landingSlug}`
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    const created = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    window.sessionStorage.setItem(key, created)
    return created
  }

  const sendEvent = (eventName: string, eventValue?: string) => {
    const payload = {
      landingSlug,
      projectSlug,
      eventName,
      eventValue: eventValue || "",
      sessionId: getSessionId(),
      path: path || "",
      referrer: document.referrer || "",
      utm,
      device: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
      },
    }

    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" })
      navigator.sendBeacon("/api/lp-analytics", blob)
      return
    }

    fetch("/api/lp-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined)
  }

  useEffect(() => {
    sendEvent("page_view")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingSlug])

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      if (total <= 0) return
      const depth = Math.round((window.scrollY / total) * 100)

      for (const threshold of TRACKED_DEPTHS) {
        if (depth >= threshold && !trackedDepthsRef.current.has(threshold)) {
          trackedDepthsRef.current.add(threshold)
          sendEvent("scroll_depth", String(threshold))
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingSlug])

  return null
}
