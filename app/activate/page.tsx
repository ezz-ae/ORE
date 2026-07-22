'use client'

/**
 * White-label activation — the prospect's entry point.
 *
 * Redeem the access key you were given, set your brand name + logo + accent,
 * and enter the full system (pre-populated with the demo dataset). One screen,
 * live preview. Only meaningful when NEXT_PUBLIC_WHITE_LABEL=1.
 */

import { useState, useRef } from 'react'
import { WHITE_LABEL, WL_DEFAULT_ACCENT } from '@/lib/whitelabel/config'

const MAX_LOGO_DIM = 256 // px — downscale before upload so the row stays small

/** Downscale an uploaded image to a small PNG data URL via canvas. */
function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image.'))
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIM / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unavailable.'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function ActivatePage() {
  const [key, setKey] = useState('')
  const [company, setCompany] = useState('')
  const [product, setProduct] = useState('Intelligence')
  const [accent, setAccent] = useState(WL_DEFAULT_ACCENT)
  const [logo, setLogo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!WHITE_LABEL) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] p-6 text-center text-white/70">
        Activation is not enabled on this deployment.
      </div>
    )
  }

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setLogo(await downscaleToDataUrl(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that image.')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!key.trim()) return setError('Enter your access key.')
    if (!company.trim()) return setError('Enter your brand name.')
    setLoading(true)
    try {
      const res = await fetch('/api/wl/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), company: company.trim(), product: product.trim(), accent, logo }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; home?: string; error?: string }
      if (!res.ok || !data.ok) {
        setLoading(false)
        return setError(data.error || 'Activation failed. Check your key and try again.')
      }
      // Full navigation so the server root layout re-reads the cookie and paints the brand.
      window.location.href = data.home || '/freehold-intelligence'
    } catch {
      setLoading(false)
      setError('Network error. Try again.')
    }
  }

  const previewName = company.trim() || 'Your Company'

  return (
    <div className="min-h-screen bg-[#0a1628] text-white" style={{ ['--wl-accent' as string]: accent }}>
      <div className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-2">
        {/* Form */}
        <form onSubmit={submit} className="order-2 md:order-1">
          <div className="mb-8">
            <div className="mb-2 inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-xs font-semibold tracking-widest text-white/60">
              ACTIVATE YOUR WORKSPACE
            </div>
            <h1 className="text-3xl font-bold">Launch your branded system</h1>
            <p className="mt-2 text-sm text-white/60">
              Enter the access key you were given, add your brand, and step into the full platform —
              your company, live.
            </p>
          </div>

          <label className="mb-1 block text-xs font-medium text-white/60">Access key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="WL-XXXX-XXXX-XXXX"
            className="mb-4 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none focus:border-[var(--wl-accent)]"
          />

          <label className="mb-1 block text-xs font-medium text-white/60">Brand name</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Skyline"
            maxLength={40}
            className="mb-4 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
          />

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/60">Product word</label>
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Intelligence"
                maxLength={24}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/60">Accent</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-white/15 bg-transparent"
                />
                <span className="font-mono text-xs text-white/50">{accent}</span>
              </div>
            </div>
          </div>

          <label className="mb-1 block text-xs font-medium text-white/60">Logo (optional)</label>
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08]"
            >
              {logo ? 'Change logo' : 'Upload logo'}
            </button>
            {logo ? (
              <button type="button" onClick={() => setLogo('')} className="text-xs text-white/50 hover:text-white/80">
                Remove
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickLogo(e.target.files?.[0])}
            />
          </div>

          {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-black transition disabled:opacity-60"
            style={{ background: 'var(--wl-accent)' }}
          >
            {loading ? 'Launching…' : 'Enter my system'}
          </button>
        </form>

        {/* Live preview */}
        <div className="order-1 md:order-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Live preview</div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a1628] px-4 py-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-6 w-auto max-w-[120px] object-contain" />
              ) : (
                <span className="h-3 w-3 rounded-full" style={{ background: 'var(--wl-accent)' }} />
              )}
              <span className="text-sm font-semibold">
                {previewName}
                <span className="ml-1" style={{ color: 'var(--wl-accent)' }}>
                  {product.trim() || 'Intelligence'}
                </span>
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {['Leads', 'Deals', 'Revenue'].map((k) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-white/40">{k}</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: 'var(--wl-accent)' }}>
                    ••
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-white/40">
              This is how your brand appears across the platform. Your workspace opens pre-loaded with a
              full demo dataset so every screen is alive.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
