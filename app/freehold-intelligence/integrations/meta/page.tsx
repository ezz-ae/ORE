'use client'

import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/lib/i18n/provider'
import {
  Eye, EyeOff, Loader2, CheckCircle, XCircle, RefreshCw,
  LogOut, TrendingUp, TrendingDown, Users, DollarSign,
  Megaphone, MousePointer, Zap, ChevronDown, ChevronUp,
  AlertTriangle, ExternalLink, Copy, Check,
} from 'lucide-react'

// ─── Meta Graph API ────────────────────────────────────────────────────────────

const GRAPH = 'https://graph.facebook.com/v20.0'

async function graph<T = any>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.error) {
    const e = json.error
    throw Object.assign(new Error(e.message), { code: e.code, type: e.type })
  }
  return json
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type MetaUser = {
  id: string
  name: string
  email?: string
}

type AdAccount = {
  id: string           // act_XXXXXXXX
  name: string
  account_id: string
  account_status: number
  currency: string
  amount_spent: string // cents
  timezone_name?: string
}

type Campaign = {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  objective: string
  daily_budget?: string   // cents
  lifetime_budget?: string
  budget_remaining?: string
  created_time: string
}

type Insight = {
  impressions: string
  clicks: string
  spend: string
  cpm: string
  cpc: string
  ctr: string
  reach?: string
  actions?: { action_type: string; value: string }[]
}

type CampaignFull = Campaign & { insight: Insight | null }

type AccountFull = AdAccount & {
  campaigns: CampaignFull[]
  insight: Insight | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string, decimals = 0) {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '—'
  return v.toLocaleString('en-AE', { maximumFractionDigits: decimals })
}

function fmtMoney(cents: string | undefined, currency = 'AED') {
  if (!cents) return '—'
  const aed = parseFloat(cents) / 100
  if (aed >= 1_000_000) return `${currency} ${(aed / 1_000_000).toFixed(2)}M`
  if (aed >= 1_000)     return `${currency} ${(aed / 1_000).toFixed(1)}K`
  return `${currency} ${fmt(aed, 2)}`
}

function leads(insight: Insight | null) {
  if (!insight?.actions) return 0
  return insight.actions
    .filter((a) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead')
    .reduce((s, a) => s + parseInt(a.value, 10), 0)
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

function accountStatusLabel(status: number, t: TFn) {
  switch (status) {
    case 1:  return { label: t('pintmeta.statusActive'),     color: 'text-emerald-400' }
    case 2:  return { label: t('pintmeta.statusDisabled'),   color: 'text-red-400'     }
    case 3:  return { label: t('pintmeta.statusUnsettled'),  color: 'text-amber-400'   }
    case 7:  return { label: t('pintmeta.statusPending'),    color: 'text-sky-400'     }
    case 9:  return { label: t('pintmeta.statusInReview'),   color: 'text-violet-400'  }
    default: return { label: t('pintmeta.statusOther', { n: status }), color: 'text-slate-400' }
  }
}

const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  ACTIVE:   'text-emerald-400',
  PAUSED:   'text-amber-400',
  DELETED:  'text-red-400',
  ARCHIVED: 'text-slate-500',
}

// ─── Fetch pipeline ────────────────────────────────────────────────────────────

async function fetchAll(token: string): Promise<{ user: MetaUser; accounts: AccountFull[] }> {
  // 1. Verify token & get user
  const user = await graph<MetaUser>('/me', token, { fields: 'id,name,email' })

  // 2. Get ad accounts
  const accountsRes = await graph<{ data: AdAccount[] }>(
    '/me/adaccounts', token,
    { fields: 'id,name,account_id,account_status,currency,amount_spent,timezone_name', limit: '20' },
  )
  const accounts = accountsRes.data ?? []

  // 3. For each account — campaigns + account-level insights in parallel
  const accountsFull = await Promise.all(
    accounts.map(async (account) => {
      const [campaignsRes, insightRes] = await Promise.allSettled([
        graph<{ data: Campaign[] }>(
          `/${account.id}/campaigns`, token,
          { fields: 'id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,created_time', limit: '50' },
        ),
        graph<{ data: Insight[] }>(
          `/${account.id}/insights`, token,
          { fields: 'impressions,clicks,spend,cpm,cpc,ctr,reach,actions', date_preset: 'last_30d', level: 'account' },
        ),
      ])

      const campaigns: Campaign[] = campaignsRes.status === 'fulfilled' ? (campaignsRes.value.data ?? []) : []
      const accountInsight: Insight | null =
        insightRes.status === 'fulfilled' ? (insightRes.value.data?.[0] ?? null) : null

      // 4. For each campaign, fetch campaign-level insights
      const campaignsFull: CampaignFull[] = await Promise.all(
        campaigns.slice(0, 20).map(async (c) => {
          try {
            const r = await graph<{ data: Insight[] }>(
              `/${c.id}/insights`, token,
              { fields: 'impressions,clicks,spend,cpm,cpc,ctr,reach,actions', date_preset: 'last_30d' },
            )
            return { ...c, insight: r.data?.[0] ?? null }
          } catch {
            return { ...c, insight: null }
          }
        }),
      )

      return { ...account, campaigns: campaignsFull, insight: accountInsight }
    }),
  )

  return { user, accounts: accountsFull }
}

// ─── Component ─────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'fh_meta_access_token'

type Phase = 'idle' | 'connecting' | 'connected' | 'error'

export default function MetaIntegrationPage() {
  const t = useT()
  const [phase, setPhase]       = useState<Phase>('idle')
  const [token, setToken]       = useState('')
  const [showToken, setShowToken] = useState(false)
  const [user, setUser]         = useState<MetaUser | null>(null)
  const [accounts, setAccounts] = useState<AccountFull[]>([])
  const [errMsg, setErrMsg]     = useState('')
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const [syncing, setSyncing]   = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copied, setCopied]     = useState(false)

  // Restore saved token on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      setToken(saved)
      connect(saved)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async (rawToken: string) => {
    const tok = rawToken.trim()
    if (!tok) return
    setPhase('connecting')
    setErrMsg('')
    try {
      const data = await fetchAll(tok)
      localStorage.setItem(TOKEN_KEY, tok)
      setUser(data.user)
      setAccounts(data.accounts)
      setSyncedAt(new Date())
      setPhase('connected')
      // Auto-expand first account
      if (data.accounts[0]) setExpanded(new Set([data.accounts[0].id]))
    } catch (err: any) {
      setPhase('error')
      if (err.code === 190) {
        setErrMsg(t('pintmeta.errTokenExpired'))
      } else if (err.code === 200 || err.code === 10) {
        setErrMsg(t('pintmeta.errPermission'))
      } else {
        setErrMsg(err.message ?? t('pintmeta.errUnknown'))
      }
    }
  }, [t])

  async function refresh() {
    setSyncing(true)
    try {
      const saved = localStorage.getItem(TOKEN_KEY) ?? token
      const data = await fetchAll(saved)
      setUser(data.user)
      setAccounts(data.accounts)
      setSyncedAt(new Date())
    } catch (err: any) {
      setErrMsg(err.message)
    } finally {
      setSyncing(false)
    }
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY)
    setPhase('idle')
    setToken('')
    setUser(null)
    setAccounts([])
    setSyncedAt(null)
  }

  function toggleAccount(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function copyToken() {
    const saved = localStorage.getItem(TOKEN_KEY) ?? token
    navigator.clipboard.writeText(saved).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ── Totals across all accounts ─────────────────────────────────────────────
  const totalSpend = accounts.reduce((s, a) => s + parseFloat(a.amount_spent || '0') / 100, 0)
  const totalImpressions = accounts.reduce((s, a) => s + parseInt(a.insight?.impressions || '0', 10), 0)
  const totalClicks = accounts.reduce((s, a) => s + parseInt(a.insight?.clicks || '0', 10), 0)
  const totalLeads  = accounts.reduce((s, a) => s + leads(a.insight), 0)
  const blendedCPL  = totalLeads > 0 ? totalSpend / totalLeads : 0

  // ── RENDER ─────────────────────────────────────────────────────────────────

  // ── Idle / Error: connection form ──────────────────────────────────────────
  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-8 sm:px-8">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-blue-500/25 bg-blue-500/10">
            <span className="text-[20px]">🔵</span>
          </div>
          <div>
            <h1 className="text-[20px] font-semibold text-white">{t('pintmeta.title')}</h1>
            <p className="text-xs text-slate-500">{t('pintmeta.subtitle')}</p>
          </div>
        </div>

        {/* Error banner */}
        {phase === 'error' && errMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-red-400/20 bg-red-400/[0.06] px-4 py-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-red-300">{t('pintmeta.connFailed')}</div>
              <div className="mt-0.5 text-xs text-red-300/70 leading-relaxed">{errMsg}</div>
            </div>
          </div>
        )}

        {/* Token form */}
        <div className="rounded-[20px] border border-line bg-surface p-6">
          <div className="mb-5 text-sm font-semibold text-white">{t('pintmeta.accessToken')}</div>

          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connect(token)}
              placeholder="EAABwzLixnjYBO..."
              className="w-full rounded-[12px] border border-line bg-surface-2 py-3 pl-4 pr-12 font-mono text-sm text-white placeholder:text-slate-500 outline-none focus:border-gold/50 transition"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            onClick={() => connect(token)}
            disabled={!token.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-gold py-3 text-[14px] font-semibold text-black transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('pintmeta.connectBtn')}
          </button>
        </div>

        {/* How to get the token */}
        <div className="mt-6 rounded-[18px] border border-line bg-surface-2 p-5">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
            {t('pintmeta.howToTitle')}
          </div>
          <ol className="space-y-2.5">
            {[
              t('pintmeta.step1'),
              t('pintmeta.step2'),
              t('pintmeta.step3'),
              t('pintmeta.step4'),
              t('pintmeta.step5'),
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-slate-400">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <a
            href="https://business.facebook.com/settings/system-users"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-gold/70 transition hover:text-gold"
          >
            {t('pintmeta.openBusinessManager')} <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Permissions required */}
        <div className="mt-4 rounded-[14px] border border-line bg-transparent px-4 py-3.5">
          <div className="mb-2 text-xs text-slate-500 uppercase tracking-wider">{t('pintmeta.requiredScopes')}</div>
          <div className="flex flex-wrap gap-1.5">
            {['ads_management', 'ads_read', 'leads_retrieval', 'business_management'].map((s) => (
              <span key={s} className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs text-slate-400">{s}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Connecting spinner ─────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <div className="text-[14px] text-slate-400">{t('pintmeta.connectingTitle')}</div>
        <div className="text-xs text-slate-500">{t('pintmeta.connectingSub')}</div>
      </div>
    )
  }

  // ── Connected dashboard ────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-7 sm:px-8">

      {/* Connected header */}
      <div className="mb-7 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-blue-500/25 bg-blue-500/10 text-[16px]">
            🔵
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{t('pintmeta.title')}</span>
              <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('pintmeta.connected')}
              </span>
            </div>
            <div className="text-xs text-slate-500">{accounts.length !== 1 ? t('pintmeta.accountSummaryMany', { name: user?.name ?? '', n: accounts.length }) : t('pintmeta.accountSummaryOne', { name: user?.name ?? '', n: accounts.length })}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {syncedAt && (
            <span className="hidden text-xs text-slate-500 sm:block">
              {t('pintmeta.synced', { time: syncedAt.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={syncing}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-slate-400 transition hover:border-line-strong hover:text-slate-200 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={copyToken}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-slate-500 transition hover:border-line-strong hover:text-slate-300"
            title={t('pintmeta.copyToken')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={disconnect}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-slate-500 transition hover:border-red-400/20 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" /> {t('pintmeta.disconnect')}
          </button>
        </div>
      </div>

      {/* Summary tiles — 30-day totals */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: t('pintmeta.tileSpend'),       value: `AED ${fmt(totalSpend, 0)}`,         Icon: DollarSign,    color: 'text-gold'  },
          { label: t('pintmeta.tileImpressions'), value: totalImpressions > 0 ? fmt(totalImpressions) : '—', Icon: Megaphone, color: 'text-blue-400' },
          { label: t('pintmeta.tileClicks'),      value: totalClicks > 0 ? fmt(totalClicks) : '—', Icon: MousePointer, color: 'text-sky-400' },
          { label: t('pintmeta.tileLeads'),       value: totalLeads > 0 ? String(totalLeads) : '—', Icon: Users, color: 'text-emerald-400' },
          { label: t('pintmeta.tileBlendedCPL'),  value: blendedCPL > 0 ? `AED ${fmt(blendedCPL, 0)}` : '—', Icon: Zap, color: blendedCPL > 0 && blendedCPL < 200 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-[16px] border border-line bg-surface px-4 py-3.5">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className={`mt-2 text-[17px] font-semibold tabular-nums ${color}`}>{value}</div>
            <div className="mt-0.5 text-[10px] text-slate-500 leading-relaxed">{label}</div>
          </div>
        ))}
      </section>

      {/* Error banner if partial refresh error */}
      {errMsg && (
        <div className="mb-5 flex items-center gap-2 rounded-[12px] border border-amber-400/20 bg-amber-400/[0.05] px-4 py-2.5 text-xs text-amber-400/80">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {errMsg}
          <button onClick={() => setErrMsg('')} className="ml-auto text-slate-500 hover:text-slate-300"><XCircle className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Ad accounts */}
      {accounts.length === 0 ? (
        <div className="rounded-[18px] border border-line bg-surface px-6 py-12 text-center">
          <div className="text-sm text-slate-400">{t('pintmeta.noAccounts')}</div>
          <div className="mt-1 text-xs text-slate-500">{t('pintmeta.noAccountsHint')}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const isOpen = expanded.has(account.id)
            const st = accountStatusLabel(account.account_status, t)
            const activeCampaigns = account.campaigns.filter((c) => c.status === 'ACTIVE').length
            const accountLeads = leads(account.insight)
            const accountSpend = parseFloat(account.amount_spent || '0') / 100
            const avgCPL = accountLeads > 0 ? accountSpend / accountLeads : 0

            return (
              <div key={account.id} className={`rounded-[20px] border bg-surface transition ${isOpen ? 'border-line-strong' : 'border-line'}`}>

                {/* Account header row */}
                <button
                  className="flex w-full items-center gap-4 px-6 py-5 text-left"
                  onClick={() => toggleAccount(account.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{account.name}</span>
                      <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span>act_{account.account_id}</span>
                      <span>{account.currency}</span>
                      {account.timezone_name && <span>{account.timezone_name}</span>}
                    </div>
                  </div>

                  {/* Account summary metrics */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[14px] font-semibold text-white tabular-nums">{fmtMoney(account.amount_spent, account.currency)}</div>
                      <div className="text-[10px] text-slate-500">{t('pintmeta.totalSpent')}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[14px] font-semibold tabular-nums ${activeCampaigns > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{activeCampaigns}</div>
                      <div className="text-[10px] text-slate-500">{t('pintmeta.active')}</div>
                    </div>
                    {accountLeads > 0 && (
                      <div className="text-right">
                        <div className="text-[14px] font-semibold text-sky-400 tabular-nums">{accountLeads}</div>
                        <div className="text-[10px] text-slate-500">{t('pintmeta.leads30d')}</div>
                      </div>
                    )}
                    {avgCPL > 0 && (
                      <div className="text-right">
                        <div className="text-[14px] font-semibold text-gold tabular-nums">AED {fmt(avgCPL, 0)}</div>
                        <div className="text-[10px] text-slate-500">{t('pintmeta.cpl')}</div>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-slate-500">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Campaigns table */}
                {isOpen && (
                  <div className="border-t border-line">
                    {account.campaigns.length === 0 ? (
                      <div className="px-6 py-6 text-sm text-slate-400">{t('pintmeta.noCampaigns')}</div>
                    ) : (
                      <>
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px] items-center gap-3 border-b border-line px-6 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          <div>{t('pintmeta.colCampaign')}</div>
                          <div className="text-right">{t('pintmeta.colStatus')}</div>
                          <div className="text-right">{t('pintmeta.colSpend')}</div>
                          <div className="text-right">{t('pintmeta.colImpr')}</div>
                          <div className="text-right">{t('pintmeta.colClicks')}</div>
                          <div className="text-right">{t('pintmeta.colCTR')}</div>
                          <div className="text-right">{t('pintmeta.colLeads')}</div>
                        </div>
                        {/* Campaign rows */}
                        <div className="divide-y divide-line">
                          {account.campaigns.map((c) => {
                            const ins   = c.insight
                            const cLeads = leads(ins)
                            const ctr   = ins ? parseFloat(ins.ctr) : 0
                            const statusColor = CAMPAIGN_STATUS_COLOR[c.status] ?? 'text-slate-500'

                            return (
                              <div key={c.id} className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_80px] items-center gap-3 px-6 py-3.5 hover:bg-surface-2 transition">
                                <div className="min-w-0 pr-2">
                                  <div className="truncate text-sm font-medium text-slate-100">{c.name}</div>
                                  <div className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wide">
                                    {c.objective?.replace(/_/g, ' ')}
                                  </div>
                                </div>
                                <div className={`text-right text-xs font-semibold ${statusColor}`}>
                                  {c.status === 'ACTIVE' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle animate-pulse" />}
                                  {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                                </div>
                                <div className="text-right text-xs text-slate-300 tabular-nums">
                                  {ins?.spend ? `${account.currency} ${fmt(parseFloat(ins.spend), 0)}` : '—'}
                                </div>
                                <div className="text-right text-xs text-slate-400 tabular-nums">
                                  {ins?.impressions ? fmt(parseInt(ins.impressions, 10)) : '—'}
                                </div>
                                <div className="text-right text-xs text-slate-400 tabular-nums">
                                  {ins?.clicks ? fmt(parseInt(ins.clicks, 10)) : '—'}
                                </div>
                                <div className={`text-right text-xs font-medium tabular-nums ${ctr > 2 ? 'text-emerald-400' : ctr > 1 ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {ins?.ctr ? `${parseFloat(ins.ctr).toFixed(2)}%` : '—'}
                                </div>
                                <div className={`text-right text-xs font-semibold tabular-nums ${cLeads > 0 ? 'text-sky-400' : 'text-slate-600'}`}>
                                  {cLeads > 0 ? cLeads : '—'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {/* Account-level insight bar */}
                    {account.insight && (
                      <div className="border-t border-line px-6 py-4">
                        <div className="flex flex-wrap gap-6 text-xs text-slate-400">
                          <span>{t('pintmeta.accountTotals')}</span>
                          <span className="text-slate-400">{t('pintmeta.imprLabel')} <strong className="text-slate-100">{fmt(parseInt(account.insight.impressions || '0', 10))}</strong></span>
                          <span className="text-slate-400">{t('pintmeta.clicksLabel')} <strong className="text-slate-100">{fmt(parseInt(account.insight.clicks || '0', 10))}</strong></span>
                          <span className="text-slate-400">{t('pintmeta.spendLabel')} <strong className="text-slate-100">{account.currency} {fmt(parseFloat(account.insight.spend || '0'), 0)}</strong></span>
                          {account.insight.cpm && <span className="text-slate-400">{t('pintmeta.cpmLabel')} <strong className="text-slate-100">{account.currency} {parseFloat(account.insight.cpm).toFixed(2)}</strong></span>}
                          {accountLeads > 0 && <span className="text-sky-400">{t('pintmeta.leadsLabel')} <strong>{accountLeads}</strong></span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer: token management */}
      <div className="mt-8 flex items-center justify-between rounded-[14px] border border-line bg-surface-2 px-5 py-3.5">
        <div className="text-xs text-slate-500">
          {t('pintmeta.tokenStored')}
        </div>
        <a
          href="https://business.facebook.com/settings/system-users"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
        >
          {t('pintmeta.businessManager')} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
