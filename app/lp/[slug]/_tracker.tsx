'use client'

import { useEffect } from 'react'

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

export function Tracker({ slug, projectSlug, metaPixelId, googleTagId, googleConversionId, tiktokPixelId }: TrackerProps) {
  useEffect(() => {
    // Internal page_view
    const utm = collectUtm()
    fetch('/api/lp-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        landingSlug: slug,
        projectSlug,
        eventName: 'page_view',
        path: window.location.pathname,
        referrer: document.referrer,
        sessionId: getSessionId(),
        utm,
        device: {
          ua: navigator.userAgent.slice(0, 200),
          mobile: /Mobi|Android/i.test(navigator.userAgent),
        },
      }),
    }).catch(() => null)

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

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem('_fp_sid')
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('_fp_sid', id)
    }
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
