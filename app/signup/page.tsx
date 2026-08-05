'use client'

/**
 * Self-serve trial signup — the public door into the SaaS.
 *
 * One screen: brand (company, subdomain with live availability, product word,
 * accent, logo) + the owner account (name, email, password), with a live
 * brand preview. Submitting provisions the tenant and redirects straight into
 * {sub}.TENANT_BASE_DOMAIN via the claim endpoint — the broker lands inside
 * THEIR branded instance, already signed in. Only meaningful when
 * NEXT_PUBLIC_TENANT_BASE_DOMAIN is set.
 */

import { useEffect, useRef, useState } from 'react'
import { I18nProvider, useT } from '@/lib/i18n/provider'
import { SAAS_TENANCY, TENANT_BASE_DOMAIN } from '@/lib/tenancy/config'
import { SUBDOMAIN_RE, RESERVED_SUBDOMAINS } from '@/lib/tenancy/reserved'

const MAX_LOGO_DIM = 256 // px — downscale before upload so the row stays small
const DEFAULT_ACCENT = '#D4AF37'
const TRIAL_DAYS = 14

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

type SubState = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid'

export default function SignupPage() {
  return (
    <I18nProvider>
      <SignupForm />
    </I18nProvider>
  )
}

function SignupForm() {
  const t = useT()
  const [company, setCompany] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [subState, setSubState] = useState<SubState>('idle')
  const [product, setProduct] = useState('Lead Machine')
  const [accent, setAccent] = useState(DEFAULT_ACCENT)
  const [logo, setLogo] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const checkSeq = useRef(0)

  // Live availability, debounced. Local grammar/reserved checks answer
  // instantly; only plausible names hit the API.
  useEffect(() => {
    const sub = subdomain.trim().toLowerCase()
    if (!sub) { setSubState('idle'); return }
    if (!SUBDOMAIN_RE.test(sub)) { setSubState('invalid'); return }
    if (RESERVED_SUBDOMAINS.has(sub)) { setSubState('reserved'); return }
    setSubState('checking')
    const seq = ++checkSeq.current
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wl/subdomain-check?sub=${encodeURIComponent(sub)}`)
        const data = (await res.json().catch(() => ({}))) as { available?: boolean; reason?: string | null }
        if (seq !== checkSeq.current) return // a newer keystroke superseded this check
        if (data.available) setSubState('available')
        else if (data.reason === 'reserved') setSubState('reserved')
        else if (data.reason === 'invalid_subdomain') setSubState('invalid')
        else setSubState('taken')
      } catch {
        if (seq === checkSeq.current) setSubState('idle') // advisory only — createTenant re-checks
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [subdomain])

  if (!SAAS_TENANCY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] p-6 text-center text-white/70">
        {t('wl.signup.notEnabled')}
      </div>
    )
  }

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setLogo(await downscaleToDataUrl(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('wl.signup.errGeneric'))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!company.trim()) return setError(t('wl.signup.errCompany'))
    if (!subdomain.trim() || subState === 'invalid' || subState === 'reserved' || subState === 'taken') {
      return setError(t('wl.signup.errSubdomain'))
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) return setError(t('wl.signup.errEmail'))
    if (password.length < 8) return setError(t('wl.signup.errPassword'))
    setLoading(true)
    try {
      const res = await fetch('/api/wl/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          subdomain: subdomain.trim().toLowerCase(),
          product: product.trim(),
          accent,
          logo,
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          password,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; error?: string }
      if (!res.ok || !data.ok || !data.redirect) {
        setLoading(false)
        const key = {
          taken: 'wl.signup.taken',
          reserved: 'wl.signup.reserved',
          invalid_subdomain: 'wl.signup.invalid',
          email_invalid: 'wl.signup.errEmail',
          password_short: 'wl.signup.errPassword',
          rate_limited: 'wl.signup.errRate',
        }[data.error ?? ''] ?? 'wl.signup.errGeneric'
        return setError(t(key))
      }
      // Full navigation onto THEIR subdomain — the claim endpoint signs them in.
      window.location.href = data.redirect
    } catch {
      setLoading(false)
      setError(t('wl.signup.errGeneric'))
    }
  }

  const previewName = company.trim() || t('wl.signup.companyPh')
  const subHintByState: Record<SubState, { text: string; tone: string }> = {
    idle: { text: t('wl.signup.subdomainHint'), tone: 'text-white/40' },
    checking: { text: t('wl.signup.checking'), tone: 'text-white/40' },
    available: { text: t('wl.signup.available'), tone: 'text-emerald-400' },
    taken: { text: t('wl.signup.taken'), tone: 'text-red-400' },
    reserved: { text: t('wl.signup.reserved'), tone: 'text-red-400' },
    invalid: { text: t('wl.signup.invalid'), tone: 'text-red-400' },
  }
  const subHint = subHintByState[subState]

  return (
    <div className="min-h-screen bg-[#0a1628] text-white" style={{ ['--wl-accent' as string]: accent }}>
      <div className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-2">
        {/* Form */}
        <form onSubmit={submit} className="order-2 md:order-1">
          <div className="mb-8">
            <div className="mb-2 inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/60">
              {t('wl.signup.eyebrow')}
            </div>
            <h1 className="text-3xl font-bold">{t('wl.signup.title')}</h1>
            <p className="mt-2 text-sm text-white/60">{t('wl.signup.subtitle')}</p>
          </div>

          <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.company')}</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t('wl.signup.companyPh')}
            maxLength={40}
            className="mb-4 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
          />

          <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.subdomain')}</label>
          <div className="flex items-center gap-2">
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              placeholder={t('wl.signup.subdomainPh')}
              maxLength={40}
              dir="ltr"
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none focus:border-[var(--wl-accent)]"
            />
            <span dir="ltr" className="whitespace-nowrap font-mono text-xs text-white/50">.{TENANT_BASE_DOMAIN}</span>
          </div>
          <p className={`mb-4 mt-1 text-xs ${subHint.tone}`}>{subHint.text}</p>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.product')}</label>
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder={t('wl.signup.productPh')}
                maxLength={24}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.accent')}</label>
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

          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08]"
            >
              {logo ? t('wl.signup.logoChange') : t('wl.signup.logoUpload')}
            </button>
            {logo ? (
              <button type="button" onClick={() => setLogo('')} className="text-xs text-white/50 hover:text-white/80">
                {t('wl.signup.logoRemove')}
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

          <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-widest text-white/40">
              {t('wl.signup.adminTitle')}
            </div>
            <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.adminName')}</label>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder={t('wl.signup.adminNamePh')}
              maxLength={60}
              className="mb-3 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
            />
            <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.adminEmail')}</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              dir="ltr"
              className="mb-3 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
            />
            <label className="mb-1 block text-xs font-medium text-white/60">{t('wl.signup.adminPassword')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-[var(--wl-accent)]"
            />
            <p className="mt-1 text-xs text-white/40">{t('wl.signup.adminPasswordHint')}</p>
          </div>

          {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-black transition disabled:opacity-60"
            style={{ background: 'var(--wl-accent)' }}
          >
            {loading ? t('wl.signup.submitting') : t('wl.signup.submit')}
          </button>
          <p className="mt-3 text-center text-xs text-white/40">{t('wl.signup.trialNote', { days: TRIAL_DAYS })}</p>
        </form>

        {/* Live preview */}
        <div className="order-1 md:order-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">
              {t('wl.signup.previewTitle')}
            </div>
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
                  {product.trim() || t('wl.signup.productPh')}
                </span>
              </span>
            </div>
            <div dir="ltr" className="mt-3 truncate rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-xs text-white/50">
              https://{subdomain.trim() || t('wl.signup.subdomainPh')}.{TENANT_BASE_DOMAIN}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(['previewLeads', 'previewDeals', 'previewRevenue'] as const).map((k) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-white/40">{t(`wl.signup.${k}`)}</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: 'var(--wl-accent)' }}>
                    ••
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-white/40">{t('wl.signup.previewNote')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
