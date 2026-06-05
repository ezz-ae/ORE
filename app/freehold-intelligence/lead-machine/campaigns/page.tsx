import Link from 'next/link'
import { Megaphone, Plus, AlertCircle, CheckCircle2, Pause, ArrowUpRight, Zap } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { CampaignList } from './_components/CampaignList'

interface Campaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  created_time: string
  insights?: {
    impressions: string
    clicks: string
    spend: string
    actions?: { action_type: string; value: string }[]
    cpc?: string
    cpm?: string
  } | null
}

interface CampaignsResponse {
  campaigns?: Campaign[]
  error?: string
  type?: string
}

async function getCampaigns(): Promise<CampaignsResponse> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/meta/campaigns`, { next: { revalidate: 60 } })
    return res.json()
  } catch {
    return { error: 'Failed to reach Meta API', type: 'network' }
  }
}

function fmtSpend(spend: string | undefined) {
  if (!spend) return '—'
  const n = parseFloat(spend)
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getLeads(campaign: Campaign) {
  return campaign.insights?.actions?.find((a) => a.action_type === 'lead')?.value ?? '0'
}

export default async function CampaignsPage() {
  const data = await getCampaigns()
  const isConfigError = data.type === 'config'
  const campaigns     = data.campaigns ?? []
  const active        = campaigns.filter((c) => c.status === 'ACTIVE').length
  const paused        = campaigns.filter((c) => c.status === 'PAUSED').length
  const totalSpend    = campaigns
    .reduce((s, c) => s + parseFloat(c.insights?.spend ?? '0'), 0)
  const totalLeads    = campaigns
    .reduce((s, c) => s + parseInt(getLeads(c)), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Megaphone className="h-3.5 w-3.5" /> Meta Campaigns
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
            Live campaigns<br />
            <span className="text-white/35">
              {isConfigError ? 'not connected.' : `${campaigns.length} total.`}
            </span>
          </h1>
        </section>

        <Link
          href="/freehold-intelligence/lead-machine/campaigns/new"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE] sm:mt-10"
        >
          <Plus className="h-4 w-4" /> New campaign
        </Link>
      </div>

      {/* Config error state */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Meta Ads not connected</div>
              <p className="mt-1 text-[13px] text-white/60">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/meta"
                className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#D4AF37]/80 transition hover:text-[#D4AF37]"
              >
                Set up Meta integration <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* API error (non-config) */}
      {data.error && !isConfigError && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-[13px] text-white/65">{data.error}</p>
          </div>
        </div>
      )}

      {/* Stats row */}
      {!isConfigError && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Active',      value: active,                        color: 'text-[#D4AF37]' },
            { label: 'Paused',      value: paused,                        color: 'text-[#D4AF37]' },
            { label: 'Total spend', value: fmtSpend(String(totalSpend)),  color: 'text-white' },
            { label: 'Total leads', value: totalLeads,                    color: totalLeads > 0 ? 'text-[#D4AF37]' : 'text-white' },
          ].map((s) => (
            <div key={s.label} className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-4">
              <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
              <div className="mt-1.5 text-[13px] text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length > 0 && <CampaignList campaigns={campaigns} />}

      {/* Empty state — connected but no campaigns */}
      {!isConfigError && !data.error && campaigns.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-14 text-center">
          <Zap className="mx-auto h-8 w-8 text-[#D4AF37]/40" />
          <div className="mt-4 text-[18px] font-semibold text-white">No campaigns yet</div>
          <p className="mt-2 text-[14px] text-white/40">Create the first campaign to start generating leads from Meta and Instagram.</p>
          <Link
            href="/freehold-intelligence/lead-machine/campaigns/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE]"
          >
            <Plus className="h-4 w-4" /> Launch first campaign
          </Link>
        </div>
      )}

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about campaign performance, spend, leads…"
          suggestions={[
            'Which campaign has the lowest cost per lead?',
            'How much did we spend on Meta this month?',
            'Which campaigns should I pause?',
          ]}
        />
      </section>

    </div>
  )
}
