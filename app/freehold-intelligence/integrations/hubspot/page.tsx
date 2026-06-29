'use client'

import { useState, useEffect } from 'react'
import { Users2, TrendingUp, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Phone, Mail, XCircle, DollarSign, Clock } from 'lucide-react'

const TOKEN_KEY = 'fh_hubspot_token'
const BASE      = 'https://api.hubapi.com'

type Phase = 'idle' | 'connecting' | 'connected' | 'error'

type HsContact = {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    lifecyclestage?: string
    hs_lead_status?: string
    createdate?: string
  }
}

type HsDeal = {
  id: string
  properties: {
    dealname?: string
    amount?: string
    dealstage?: string
    closedate?: string
  }
}

type HsData = {
  contacts: HsContact[]
  deals: HsDeal[]
  contactTotal: number
  dealTotal: number
}

async function hs<T = any>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const json = await res.json()
  if (!res.ok) {
    throw Object.assign(new Error(json.message || `HTTP ${res.status}`), {
      status: res.status,
      category: json.category,
    })
  }
  return json
}

async function fetchAll(token: string): Promise<HsData> {
  const [contacts, deals] = await Promise.all([
    hs('/crm/v3/objects/contacts?limit=10&properties=firstname,lastname,email,phone,lifecyclestage,hs_lead_status,createdate&sorts=-createdate', token),
    hs('/crm/v3/objects/deals?limit=10&properties=dealname,amount,dealstage,closedate&sorts=-createdate', token),
  ])
  return {
    contacts:     contacts.results  ?? [],
    deals:        deals.results     ?? [],
    contactTotal: contacts.total    ?? 0,
    dealTotal:    deals.total       ?? 0,
  }
}

const STAGE_COLORS: Record<string, string> = {
  leadIn:              'text-teal-400    bg-teal-400/10    border-teal-400/20',
  attemptingcontact:   'text-amber-400  bg-amber-400/10  border-amber-400/20',
  contractsent:        'text-violet-400 bg-violet-400/10 border-violet-400/20',
  closedwon:           'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  closedlost:          'text-red-400    bg-red-400/10    border-red-400/20',
}

function stageStyle(stage?: string) {
  const key = (stage ?? '').toLowerCase().replace(/[^a-z]/g, '')
  return STAGE_COLORS[key] ?? 'text-slate-500 bg-surface-2 border-white/10'
}

function stageName(stage?: string) {
  if (!stage) return '—'
  return stage.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

function fmtAed(amount?: string) {
  if (!amount) return '—'
  return `AED ${Number(amount).toLocaleString()}`
}

function ago(iso?: string) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

export default function HubSpotPage() {
  const [token,   setToken]   = useState('')
  const [show,    setShow]    = useState(false)
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [data,    setData]    = useState<HsData | null>(null)
  const [errMsg,  setErrMsg]  = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) { setToken(saved); connect(saved) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function connect(tok = token) {
    const t = tok.trim()
    if (!t) return
    setPhase('connecting')
    setLoading(true)
    setErrMsg('')
    try {
      const d = await fetchAll(t)
      localStorage.setItem(TOKEN_KEY, t)
      setData(d)
      setPhase('connected')
    } catch (err: any) {
      setErrMsg(
        err.status === 401 ? 'Invalid token — check your HubSpot Private App token.' :
        err.status === 403 ? 'Token missing required scopes. Enable contacts + deals read.' :
        err.message || 'Connection failed.',
      )
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setData(null)
    setPhase('idle')
    setErrMsg('')
  }

  async function refresh() {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) await connect(saved)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-orange-500/15">
              <Users2 className="h-4 w-4 text-orange-400" />
            </div>
            <h1 className="text-[20px] font-semibold text-white">HubSpot CRM</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">Live contacts and deals from your HubSpot portal</p>
        </div>
        {phase === 'connected' && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:opacity-40">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={disconnect}
              className="flex items-center gap-1.5 rounded-full border border-red-400/20 px-3 py-1.5 text-xs text-red-400/70 transition hover:border-red-400/40 hover:text-red-400">
              <XCircle className="h-3 w-3" /> Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Connect form */}
      {phase !== 'connected' && (
        <div className="mb-6 rounded-[18px] border border-orange-400/15 bg-orange-400/[0.03] p-5">
          <div className="mb-1 text-sm font-medium text-slate-300">HubSpot Private App Token</div>
          <div className="mb-3 text-xs text-slate-600">
            Settings → Integrations → Private Apps → Create app. Enable scopes:{' '}
            <code className="text-slate-500">crm.objects.contacts.read</code> and{' '}
            <code className="text-slate-500">crm.objects.deals.read</code>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={show ? 'text' : 'password'}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 pr-9 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-orange-400/40"
              />
              <button onClick={() => setShow((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={() => connect()} disabled={!token.trim() || loading}
              className="rounded-[10px] bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-40">
              {phase === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {phase === 'error' && (
            <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-400/90">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {errMsg}
            </div>
          )}
        </div>
      )}

      {/* Connected dashboard */}
      {phase === 'connected' && data && (
        <>
          {/* Status */}
          <div className="mb-5 flex items-center gap-2 rounded-[12px] border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm text-emerald-400/90">Connected to HubSpot</span>
            <span className="ml-auto text-xs text-slate-600">Token stored in browser only</span>
          </div>

          {/* Summary tiles */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Contacts',     value: data.contactTotal.toLocaleString(), Icon: Users2,       color: 'text-orange-400'  },
              { label: 'Deals',        value: data.dealTotal.toLocaleString(),    Icon: TrendingUp,   color: 'text-violet-400'  },
              { label: 'Active deals', value: data.deals.filter((d) => !['closedwon','closedlost'].includes((d.properties.dealstage ?? '').toLowerCase())).length.toString(), Icon: DollarSign, color: 'text-amber-400' },
              { label: 'Won',          value: data.deals.filter((d) => (d.properties.dealstage ?? '').toLowerCase() === 'closedwon').length.toString(), Icon: CheckCircle2, color: 'text-emerald-400' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-[14px] border border-line bg-surface p-4">
                <Icon className={`h-4 w-4 ${color}`} />
                <div className="mt-2 text-[20px] font-semibold text-white">{value}</div>
                <div className="mt-0.5 text-xs text-slate-600">{label}</div>
              </div>
            ))}
          </div>

          {/* Contacts table */}
          <section className="mb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              Recent Contacts <span className="text-slate-600 normal-case font-normal">({data.contactTotal.toLocaleString()} total)</span>
            </div>
            <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
              {data.contacts.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-slate-600">No contacts found</div>
                : data.contacts.map((c) => {
                    const name = [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || 'Unknown'
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-400/10 text-xs font-semibold text-orange-400">
                          {name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{name}</div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {c.properties.email && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[140px]">{c.properties.email}</span>
                              </span>
                            )}
                            {c.properties.phone && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Phone className="h-3 w-3 shrink-0" /> {c.properties.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.properties.lifecyclestage && (
                            <span className={`hidden sm:flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${stageStyle(c.properties.lifecyclestage)}`}>
                              {stageName(c.properties.lifecyclestage)}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-600">{ago(c.properties.createdate)}</span>
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </section>

          {/* Deals table */}
          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              Recent Deals <span className="text-slate-600 normal-case font-normal">({data.dealTotal.toLocaleString()} total)</span>
            </div>
            <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
              {data.deals.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-slate-600">No deals found</div>
                : data.deals.map((d) => (
                    <div key={d.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{d.properties.dealname || 'Unnamed deal'}</div>
                        {d.properties.closedate && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-600">
                            <Clock className="h-3 w-3" />
                            Close {new Date(d.properties.closedate).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-slate-400">{fmtAed(d.properties.amount)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${stageStyle(d.properties.dealstage)}`}>
                          {stageName(d.properties.dealstage)}
                        </span>
                      </div>
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
