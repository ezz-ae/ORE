'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Phone, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, XCircle, Zap, Send, Shield } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const TOKEN_KEY = 'fh_whatsapp_token'
const PHONE_KEY = 'fh_whatsapp_phone_id'
const GRAPH     = 'https://graph.facebook.com/v20.0'

type Phase = 'idle' | 'connecting' | 'connected' | 'error'

type WaPhone = {
  id: string
  verified_name: string
  display_phone_number: string
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | string
  status: 'CONNECTED' | 'FLAGGED' | 'RESTRICTED' | string
  name_status?: string
  platform_type?: string
  throughput?: { level: string }
}

type WaTemplate = {
  id: string
  name: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | string
  language: string
  category: string
}

type WaData = {
  phone: WaPhone
  templates: WaTemplate[]
  waba_id?: string
}

async function graph<T = any>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res  = await fetch(url.toString())
  const json = await res.json()
  if (json.error) {
    throw Object.assign(new Error(json.error.message), { code: json.error.code, type: json.error.type })
  }
  return json
}

async function fetchAll(phoneId: string, token: string): Promise<WaData> {
  const phone: WaPhone = await graph(
    `/${phoneId}`,
    token,
    { fields: 'id,verified_name,display_phone_number,quality_rating,status,name_status,platform_type,throughput' },
  )
  const tmplRes = await graph<{ data: WaTemplate[] }>(
    `/${phoneId}/message_templates`,
    token,
    { limit: '20', fields: 'id,name,status,language,category' },
  ).catch(() => ({ data: [] as WaTemplate[] }))

  return { phone, templates: tmplRes.data ?? [] }
}

const QUALITY_COLOR: Record<string, string> = {
  GREEN:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  YELLOW: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  RED:    'text-red-400     bg-red-400/10     border-red-400/20',
}

const STATUS_COLOR: Record<string, string> = {
  CONNECTED:  'text-emerald-400',
  FLAGGED:    'text-amber-400',
  RESTRICTED: 'text-red-400',
}

const TMPL_COLOR: Record<string, string> = {
  APPROVED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  PENDING:  'text-amber-400   bg-amber-400/10   border-amber-400/20',
  REJECTED: 'text-red-400     bg-red-400/10     border-red-400/20',
}

function errKey(err: any): string {
  if (err.code === 190) return 'pintwa.errTokenExpired'
  if (err.code === 100) return 'pintwa.errInvalidPhone'
  if (err.code === 200 || err.code === 10) return 'pintwa.errMissingPerm'
  return err.message || 'pintwa.errGeneric'
}

export default function WhatsAppPage() {
  const t = useT()
  const [token,   setToken]   = useState('')
  const [phoneId, setPhoneId] = useState('')
  const [showTok, setShowTok] = useState(false)
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [data,    setData]    = useState<WaData | null>(null)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedTok   = localStorage.getItem(TOKEN_KEY)
    const savedPhone = localStorage.getItem(PHONE_KEY)
    if (savedTok && savedPhone) {
      setToken(savedTok)
      setPhoneId(savedPhone)
      connect(savedPhone, savedTok)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function connect(pid = phoneId, tok = token) {
    const p = pid.trim(), tk = tok.trim()
    if (!p || !tk) return
    setPhase('connecting')
    setLoading(true)
    setErr('')
    try {
      const d = await fetchAll(p, tk)
      localStorage.setItem(TOKEN_KEY, tk)
      localStorage.setItem(PHONE_KEY, p)
      setData(d)
      setPhase('connected')
    } catch (e: any) {
      setErr(t(errKey(e)))
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(PHONE_KEY)
    setToken('')
    setPhoneId('')
    setData(null)
    setPhase('idle')
    setErr('')
  }

  async function refresh() {
    const t = localStorage.getItem(TOKEN_KEY)
    const p = localStorage.getItem(PHONE_KEY)
    if (t && p) await connect(p, t)
  }

  const approvedTemplates = data?.templates.filter((t) => t.status === 'APPROVED').length ?? 0
  const pendingTemplates  = data?.templates.filter((t) => t.status === 'PENDING').length ?? 0

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-400/10">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-[20px] font-semibold text-white">{t('pintwa.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t('pintwa.subtitle')}</p>
        </div>
        {phase === 'connected' && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:opacity-40">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> {t('pintwa.refresh')}
            </button>
            <button onClick={disconnect}
              className="flex items-center gap-1.5 rounded-full border border-red-400/20 px-3 py-1.5 text-xs text-red-400/70 transition hover:border-red-400/40 hover:text-red-400">
              <XCircle className="h-3 w-3" /> {t('pintwa.disconnect')}
            </button>
          </div>
        )}
      </div>

      {/* Connect form */}
      {phase !== 'connected' && (
        <div className="mb-6 rounded-[18px] border border-emerald-400/15 bg-emerald-400/[0.03] p-5 space-y-3">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-300">{t('pintwa.phoneIdLabel')}</div>
            <input
              type="text"
              placeholder={t('pintwa.phoneIdPlaceholder')}
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-emerald-400/40"
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-300">{t('pintwa.tokenLabel')}</div>
            <div className="relative">
              <input
                type={showTok ? 'text' : 'password'}
                placeholder={t('pintwa.tokenPlaceholder')}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 pr-9 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-emerald-400/40"
              />
              <button onClick={() => setShowTok((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                {showTok ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => connect()} disabled={!token.trim() || !phoneId.trim() || loading}
            className="w-full rounded-[10px] bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40">
            {phase === 'connecting' ? t('pintwa.verifying') : t('pintwa.connect')}
          </button>
          {phase === 'error' && (
            <div className="flex items-start gap-2 rounded-[10px] border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-400/90">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {err}
            </div>
          )}
          <p className="text-xs text-slate-600">
            {t('pintwa.helpText')}
          </p>
        </div>
      )}

      {/* Connected dashboard */}
      {phase === 'connected' && data && (
        <>
          {/* Status bar */}
          <div className="mb-5 flex items-center gap-2 rounded-[12px] border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm text-emerald-400/90">{t('pintwa.connectedBanner')}</span>
            <span className="ml-auto text-xs text-slate-600">{t('pintwa.credentialsNote')}</span>
          </div>

          {/* Phone number card */}
          <section className="mb-5 rounded-[18px] border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-emerald-400/10">
                  <Phone className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{data.phone.verified_name}</div>
                  <div className="mt-0.5 text-sm text-slate-400">{data.phone.display_phone_number}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-medium ${STATUS_COLOR[data.phone.status] ?? 'text-slate-500'}`}>
                  {data.phone.status}
                </span>
                {data.phone.quality_rating && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${QUALITY_COLOR[data.phone.quality_rating] ?? 'text-slate-500 bg-surface-2 border-white/10'}`}>
                    {t('pintwa.qualitySuffix', { rating: data.phone.quality_rating })}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider">{t('pintwa.throughput')}</div>
                <div className="mt-1 text-sm text-slate-300 capitalize">{data.phone.throughput?.level?.toLowerCase().replace('_', ' ') ?? '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider">{t('pintwa.platform')}</div>
                <div className="mt-1 text-sm text-slate-300">{data.phone.platform_type ?? 'Cloud API'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider">{t('pintwa.nameStatus')}</div>
                <div className="mt-1 text-sm text-slate-300 capitalize">{data.phone.name_status?.toLowerCase().replace('_', ' ') ?? '—'}</div>
              </div>
            </div>
          </section>

          {/* Template summary tiles */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              { label: t('pintwa.totalTemplates'), value: data.templates.length, Icon: Zap,       color: 'text-slate-400'   },
              { label: t('pintwa.approved'),        value: approvedTemplates,     Icon: CheckCircle2, color: 'text-emerald-400' },
              { label: t('pintwa.pendingReview'),  value: pendingTemplates,      Icon: Shield,    color: 'text-amber-400'  },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-[14px] border border-line bg-surface p-4">
                <Icon className={`h-4 w-4 ${color}`} />
                <div className="mt-2 text-[20px] font-semibold text-white">{value}</div>
                <div className="mt-0.5 text-xs text-slate-600">{label}</div>
              </div>
            ))}
          </div>

          {/* Templates list */}
          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">{t('pintwa.messageTemplates')}</div>
            <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
              {data.templates.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-slate-600">{t('pintwa.noTemplates')}</div>
                : data.templates.map((tmpl) => (
                    <div key={tmpl.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-surface-2">
                        <Send className="h-3.5 w-3.5 text-emerald-400/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-slate-100 truncate">{tmpl.name}</div>
                        <div className="text-xs text-slate-600">{tmpl.language} · {tmpl.category}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TMPL_COLOR[tmpl.status] ?? 'text-slate-500 bg-surface-2 border-white/10'}`}>
                        {tmpl.status}
                      </span>
                    </div>
                  ))
              }
            </div>
          </section>
        </>
      )}

    </div>
  )
}
