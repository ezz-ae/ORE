import { cookies } from 'next/headers'
import Link from 'next/link'
import { Megaphone, Plus, AlertCircle, ArrowUpRight, Zap } from 'lucide-react'
import { CampaignList } from './_components/CampaignList'
import { PageHeader, StatCard, buttonClass } from '@/components/freehold/ui'
import { listCampaigns, getCampaignInsights, MetaConfigError, MetaApiError } from '@/lib/meta/client'
import { demoCampaigns } from '@/lib/meta/demo-data'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import type { MetaCampaign, MetaInsights } from '@/lib/meta/types'

type CampaignWithInsights = MetaCampaign & { insights?: MetaInsights | null; brokerName?: string }

interface CampaignsResponse {
  campaigns: CampaignWithInsights[]
  error?: string
  type?: string
  demo?: boolean
}

async function getCampaigns(): Promise<CampaignsResponse> {
  try {
    const campaigns = await listCampaigns()
    const withInsights = await Promise.all(
      campaigns.map(async (c) => {
        if (c.status === 'ACTIVE') {
          try {
            const insights = await getCampaignInsights(c.id)
            return { ...c, insights }
          } catch {
            return { ...c, insights: null }
          }
        }
        return { ...c, insights: null }
      }),
    )
    return { campaigns: withInsights }
  } catch (err) {
    if (err instanceof MetaConfigError) return { campaigns: demoCampaigns, demo: true }
    if (err instanceof MetaApiError)    return { campaigns: [], error: err.message, type: err.type }
    return { campaigns: [], error: 'Unexpected error loading campaigns', type: 'unknown' }
  }
}

async function getBrokerCampaignIds(brokerId: string): Promise<Set<string>> {
  try {
    const result = await query<{ campaign_id: string }>(
      'SELECT campaign_id FROM meta_campaign_brokers WHERE broker_id = $1',
      [brokerId],
    )
    return new Set(result.map(r => r.campaign_id))
  } catch {
    return new Set()
  }
}

function fmtSpend(spend: string | undefined) {
  if (!spend) return '—'
  const n = parseFloat(spend)
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getLeads(campaign: CampaignWithInsights) {
  return campaign.insights?.actions?.find((a: { action_type: string; value: string }) => a.action_type === 'lead')?.value ?? '0'
}

export default async function CampaignsPage() {
  // Read session to apply role-based filtering
  const cookieStore = await cookies()
  const token       = cookieStore.get(SESSION_COOKIE)?.value
  const sessionUser = await verifySession(token)
  const isBroker    = sessionUser?.role === 'broker'
  const brokerId    = sessionUser?.brokerId ?? sessionUser?.email

  const data = await getCampaigns()
  const isConfigError = data.demo === true

  // Brokers only see campaigns they created; managers see everything
  let campaigns = data.campaigns
  if (isBroker && brokerId) {
    const brokerIds = await getBrokerCampaignIds(brokerId)
    campaigns = campaigns.filter(c => brokerIds.has(c.id))
  }

  const active     = campaigns.filter((c) => c.status === 'ACTIVE').length
  const paused     = campaigns.filter((c) => c.status === 'PAUSED').length
  const totalSpend = campaigns.reduce((s, c) => s + parseFloat(c.insights?.spend ?? '0'), 0)
  const totalLeads = campaigns.reduce((s, c) => s + parseInt(getLeads(c)), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <PageHeader
        eyebrow={isBroker ? 'My Campaigns' : 'Lead Machine'}
        Icon={Megaphone}
        title="Meta Campaigns"
        subtitle={isConfigError ? 'Meta Ads not connected.' : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} tracked.`}
        actions={
          <>
            {!isBroker && (
              <Link href="/freehold-intelligence/lead-machine/campaigns/launch" className={buttonClass('primary', 'md')}>
                <Zap className="h-3.5 w-3.5" /> Launch Campaign
              </Link>
            )}
            <Link href="/freehold-intelligence/lead-machine/campaigns/new" className={buttonClass(isBroker ? 'primary' : 'secondary', 'md')}>
              <Plus className="h-3.5 w-3.5" /> {isBroker ? 'New Campaign' : 'Manual'}
            </Link>
          </>
        }
      />

      {/* Config error state */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">Meta Ads not connected</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              {!isBroker && (
                <Link
                  href="/freehold-intelligence/integrations/meta"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
                >
                  Set up Meta integration <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* API error (non-config) */}
      {data.error && !isConfigError && (
        <div className="mt-8 rounded-xl border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {!isConfigError && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active"      value={active}                       delta={{ value: 'live now', direction: 'up' }} />
          <StatCard label="Paused"      value={paused}                       hint="campaigns" />
          <StatCard label="Total spend" value={fmtSpend(String(totalSpend))} hint="all time" />
          <StatCard label="Total leads" value={totalLeads}                   delta={totalLeads > 0 ? { value: 'generated', direction: 'up' } : undefined} />
        </div>
      )}

      {campaigns.length > 0 && <CampaignList campaigns={campaigns} />}

      {/* Empty state */}
      {!isConfigError && !data.error && campaigns.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
          <Zap className="mx-auto h-8 w-8 text-gold/40" />
          <div className="mt-4 text-[18px] font-semibold text-white">
            {isBroker ? 'No campaigns yet' : 'No campaigns yet'}
          </div>
          <p className="mt-2 text-[14px] text-slate-400">
            {isBroker
              ? 'Launch your first Meta campaign to start generating leads.'
              : 'Create the first campaign to start generating leads from Meta and Instagram.'}
          </p>
          <Link
            href="/freehold-intelligence/lead-machine/campaigns/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]"
          >
            <Plus className="h-4 w-4" /> Launch first campaign
          </Link>
        </div>
      )}

    </div>
  )
}
