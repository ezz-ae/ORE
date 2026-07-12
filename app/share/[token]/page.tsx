'use client'

import { use, useEffect, useState } from 'react'

// Public share viewer — no login. Resolves the token to a file and shows it:
// images render inline; everything else gets a clean open/download button.
// Standalone (outside the app shell) so a shared link is safe to send anyone.
type Share = { name: string; url: string; kind: string }

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [share, setShare] = useState<Share | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading')

  useEffect(() => {
    fetch(`/api/freehold/public/share/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.share) { setShare(d.share); setState('ok') } else setState('gone') })
      .catch(() => setState('gone'))
  }, [token])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, background: '#0a0c0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {state === 'loading' && <p style={{ color: '#64748b' }}>Loading…</p>}

      {state === 'gone' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>This link is no longer available.</p>
          <p style={{ color: '#64748b', marginTop: 6 }}>The share may have been revoked.</p>
        </div>
      )}

      {state === 'ok' && share && (
        <>
          <div style={{ maxWidth: 720, width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, wordBreak: 'break-word' }}>{share.name}</p>
            {share.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={share.url} alt={share.name} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12, border: '1px solid #1e293b' }} />
            ) : (
              <div style={{ border: '1px solid #1e293b', borderRadius: 12, padding: 40, background: '#0f172a' }}>
                <p style={{ color: '#94a3b8' }}>Preview isn’t available for this file type.</p>
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <a href={share.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', background: '#D4AF37', color: '#06080A', fontWeight: 600, padding: '10px 22px', borderRadius: 999, textDecoration: 'none' }}>
                Open / Download
              </a>
            </div>
          </div>
          <p style={{ color: '#475569', fontSize: 12 }}>Shared via Freehold</p>
        </>
      )}
    </div>
  )
}
