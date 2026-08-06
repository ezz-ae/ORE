'use client'

import { useEffect } from 'react'
import { parseIntent } from '@/lib/meta/intent'

interface TrackerProps {
  slug: string
  projectSlug: string
  metaPixelId?: string
  googleTagId?: string
  googleConversionId?: string
  tiktokPixelId?: string
}

/**
 * UTM attribution, first-touch per session. The lang/theme switchers rebuild
 * the query string (wiping utm_*), so the values captured on arrival are kept
 * in sessionStorage — the lead form reads them at submit time.
 */
export function collectUtm(): Record<string, string> {
  try {
    const utm: Record<string, string> = {}
    const params = new URLSearchParams(window.location.search)
    for (const key of ['source', 'medium', 'campaign', 'term', 'content', 'id']) {
      const v = params.get(`utm_${key}`)
      if (v) utm[key] = v
    }
    // Meta's placement macros, carried on the ad's url_tags under their own
    // prefix (they are not utm_* parameters and must not be renamed into
    // them — utm_term already means the ad set). This is what makes the CLICK
    // event carry the surface it came from, so a placement that draws clicks
    // and no leads is distinguishable from one that draws nothing at all.
    for (const [param, key] of [['fh_placement', 'placement'], ['fh_site', 'site']] as const) {
      const v = params.get(param)
      if (v) utm[key] = v
    }
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('_fp_utm', JSON.stringify(utm))
      return utm
    }
    const stored = sessionStorage.getItem('_fp_utm')
    return stored ? (JSON.parse(stored) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/**
 * Buyer intent declared by the ad click (?intent=), first-touch per session —
 * the same pattern as _fp_utm above: captured once on arrival, kept in
 * sessionStorage so lang/theme navigation (which rebuilds the query string)
 * doesn't lose it. Junk values never stick (parseIntent). Returns '' when the
 * session has no declared intent.
 */
export function collectIntent(): string {
  try {
    const fromUrl = parseIntent(new URLSearchParams(window.location.search).get('intent'))
    if (fromUrl) {
      sessionStorage.setItem('_fp_intent', fromUrl)
      return fromUrl
    }
    return parseIntent(sessionStorage.getItem('_fp_intent')) ?? ''
  } catch {
    return ''
  }
}

export function Tracker({ slug, projectSlug, metaPixelId, googleTagId, googleConversionId, tiktokPixelId }: TrackerProps) {
  useEffect(() => {
    const utm = collectUtm()
    const intent = collectIntent()
    // One sender for every internal event — same endpoint, same shape.
    // keepalive so late events (deep scroll, long dwell) survive navigation.
    const send = (eventName: string, eventValue?: string) =>
      fetch('/api/lp-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          landingSlug: slug,
          projectSlug,
          eventName,
          eventValue: eventValue ?? null,
          path: window.location.pathname,
          referrer: document.referrer,
          sessionId: getSessionId(),
          utm,
          intent: intent || null,
          device: {
            ua: navigator.userAgent.slice(0, 200),
            mobile: /Mobi|Android/i.test(navigator.userAgent),
          },
        }),
      }).catch(() => null)

    send('page_view')

    // ── Behavioural observation ──────────────────────────────────────────
    // Qualification begins before the form is submitted — these are the
    // events the lead's behaviour score is computed from at capture. Each
    // signal fires once per session per milestone.
    const fired = new Set<string>()
    const once = (key: string, name: string, value?: string) => {
      if (fired.has(key)) return
      fired.add(key)
      send(name, value)
    }

    // Scroll depth — 25 / 50 / 75 / 100
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = Math.round((window.scrollY / max) * 100)
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m) once(`scroll_${m}`, 'scroll_depth', String(m))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // Dwell — 15s / 45s / 120s of page age
    const timers = [15, 45, 120].map((sec) =>
      window.setTimeout(() => once(`dwell_${sec}`, 'dwell', String(sec)), sec * 1000),
    )

    // Interaction — delegated: WhatsApp / call / brochure / gallery / section
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('a, button, img') as HTMLElement | null
      if (!el) return
      const href = (el.getAttribute('href') || '').toLowerCase()
      if (href.includes('wa.me') || href.startsWith('https://api.whatsapp')) once('cta_wa', 'cta_click', 'whatsapp')
      else if (href.startsWith('tel:')) once('cta_tel', 'cta_click', 'call')
      else if (href.includes('.pdf') || (el.textContent || '').toLowerCase().includes('brochure')) once('cta_brochure', 'cta_click', 'brochure')
      else if (el.tagName === 'IMG') once('gallery', 'gallery_view')
      const section = el.closest('[data-section]')?.getAttribute('data-section')
      if (section) once(`sec_${section}`, 'section_view', section)
    }
    document.addEventListener('click', onClick, { capture: true })

    // Form start — first focus on any form field
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) once('form_start', 'form_start')
    }
    document.addEventListener('focusin', onFocus)

    const cleanup = () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions)
      document.removeEventListener('focusin', onFocus)
      timers.forEach((tid) => window.clearTimeout(tid))
    }
    window.addEventListener('pagehide', cleanup, { once: true })

    // Meta Pixel
    if (metaPixelId) {
      injectScript(`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${metaPixelId}');fbq('track','PageView');
      `)
    }

    // Google Tag
    if (googleTagId) {
      const el = document.createElement('script')
      el.src = `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`
      el.async = true
      document.head.appendChild(el)
      injectScript(`
        window.dataLayer=window.dataLayer||[];
        function gtag(){dataLayer.push(arguments);}
        gtag('js',new Date());gtag('config','${googleTagId}');
      `)
    }

    // TikTok Pixel
    if (tiktokPixelId) {
      injectScript(`
        !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${tiktokPixelId}');ttq.page();}(window,document,'ttq');
      `)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function injectScript(code: string) {
  const el = document.createElement('script')
  el.textContent = code
  document.head.appendChild(el)
}

// The id joins this visitor's analytics events to the lead they may submit
// (freehold_site_leads.lp_session_id). sessionStorage alone was per-tab: a
// buyer who read in one tab and submitted from another lost the join, and the
// behaviour score came back null. A localStorage copy (30-day expiry) makes
// the id survive tabs and return visits; an in-flight sessionStorage id still
// wins so events already recorded this session keep their session unbroken.
const SID_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function getSessionId(): string {
  try {
    const inFlight = sessionStorage.getItem('_fp_sid')
    if (inFlight) return inFlight
    let id = ''
    try {
      const stored = JSON.parse(localStorage.getItem('_fp_sid_v2') ?? 'null') as { id?: string; ts?: number } | null
      if (stored?.id && typeof stored.ts === 'number' && Date.now() - stored.ts < SID_TTL_MS) id = stored.id
    } catch { /* corrupt entry → regenerate */ }
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      try { localStorage.setItem('_fp_sid_v2', JSON.stringify({ id, ts: Date.now() })) } catch { /* private mode */ }
    }
    sessionStorage.setItem('_fp_sid', id)
    return id
  } catch {
    return ''
  }
}

// Exported so the lead form can fire a conversion event. `eventId` is shared
// with the server-side Meta CAPI event (fired by /api/leads) so Meta dedups
// the browser/server pair instead of counting the same lead twice.
export function trackConversion(slug: string, pixelIds: { metaPixelId?: string; googleTagId?: string; googleConversionId?: string; tiktokPixelId?: string }, eventId?: string) {
  // Internal analytics
  fetch('/api/lp-analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      landingSlug: slug,
      eventName: 'form_submit',
      sessionId: getSessionId(),
      intent: collectIntent() || null,
    }),
  }).catch(() => null)

  // Meta Pixel conversion
  if (pixelIds.metaPixelId && typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).fbq) {
    (window as unknown as Record<string, (...args: unknown[]) => void>).fbq('track', 'Lead', {}, eventId ? { eventID: eventId } : undefined)
  }

  // Google Ads conversion
  if (pixelIds.googleConversionId && typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).gtag) {
    (window as unknown as Record<string, (...args: unknown[]) => void>).gtag('event', 'conversion', {
      send_to: pixelIds.googleConversionId,
    })
  }

  // TikTok Pixel conversion
  if (pixelIds.tiktokPixelId && typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).ttq) {
    (window as unknown as Record<string, { track: (...args: unknown[]) => void }>).ttq.track('SubmitForm')
  }
}
