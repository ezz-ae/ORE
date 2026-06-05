'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'

const GOOGLE_BLUE = '#4285F4'

interface GoogleCampaign {
  name: string
  type: string
  status: 'Active' | 'Paused'
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number
}

const campaigns: GoogleCampaign[] = [
  {
    name: 'Palm Jumeirah Investor',
    type: 'Search',
    status: 'Active',
    spend: 5210,
    impressions: 84600,
    clicks: 1920,
    leads: 62,
    cpl: 84.0,
  },
  {
    name: 'Dubai Property Investment',
    type: 'PMax',
    status: 'Active',
    spend: 4380,
    impressions: 94200,
    clicks: 2040,
    leads: 58,
    cpl: 75.5,
  },
  {
    name: 'Off Plan Dubai 2025',
    type: 'Search',
    status: 'Active',
    spend: 3280,
    impressions: 39200,
    clicks: 880,
    leads: 47,
    cpl: 69.8,
  },
]

const searchTerms = [
  { term: 'buy apartment dubai',              impressions: 2840, clicks: 124, ctr: '4.37%', avgCpc: 'AED 3.12' },
  { term: 'off plan property dubai 2025',     impressions: 1920, clicks: 98,  ctr: '5.10%', avgCpc: 'AED 2.84' },
  { term: 'dubai property investment',        impressions: 1640, clicks: 81,  ctr: '4.94%', avgCpc: 'AED 2.91' },
  { term: 'palm jumeirah apartments',         impressions: 1280, clicks: 64,  ctr: '5.00%', avgCpc: 'AED 3.24' },
  { term: 'golden visa dubai property',       impressions: 980,  clicks: 52,  ctr: '5.31%', avgCpc: 'AED 2.67' },
]

type SortCol = 'spend' | 'leads' | 'cpl' | 'impressions'

export default function GoogleAdsPage() {
  const [sortCol, setSortCol] = useState<SortCol>('leads')
  const [sortAsc, setSortAsc] = useState(false)

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const diff = a[sortCol] - b[sortCol]
      return sortAsc ? diff : -diff
    })
  }, [sortCol, sortAsc])

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortAsc((v) => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div
            className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em]"
            style={{ color: `${GOOGLE_BLUE}CC` }}
          >
            {/* Google G icon */}
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.805 10.023H12v3.955h5.63c-.513 2.466-2.694 4.022-5.63 4.022-3.414 0-6.182-2.768-6.182-6.182s2.768-6.182 6.182-6.182c1.533 0 2.926.564 3.99 1.488l2.964-2.964C17.113 2.548 14.659 1.5 12 1.5 6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5c5.523 0 10.5-4 10.5-10.5 0-.657-.066-1.298-.195-1.977z" fill={GOOGLE_BLUE} />
            </svg>
            Google Ads
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Google campaigns<br />
            <span className="text-white/35">search &amp; performance.</span>
          </h1>
        </section>

        <div className="mt-7 flex flex-col items-end gap-2 sm:mt-10">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
            style={{ backgroundColor: `${GOOGLE_BLUE}14`, border: `1px solid ${GOOGLE_BLUE}30`, color: GOOGLE_BLUE }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOOGLE_BLUE }} />
            Account active
          </span>
          <Link
            href="/freehold-intelligence/lead-machine/google"
            className="inline-flex items-center gap-1 text-[12px] text-white/35 transition hover:text-white/60"
          >
            Manage Google Ads <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Spend',        value: 'AED 12,870' },
          { label: 'Impressions',  value: '218,000' },
          { label: 'Clicks',       value: '4,840' },
          { label: 'Leads',        value: '167',        color: 'text-[#D4AF37]' },
          { label: 'CPL',          value: 'AED 77.1' },
          { label: 'Avg CPC',      value: 'AED 2.66' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/40">{k.label}</div>
            <div className={`mt-2 text-[20px] font-semibold leading-none ${k.color ?? 'text-white'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <section className="mt-10">
        <div className="mb-4 text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Active Campaigns</div>
        <div className="overflow-x-auto">
          <div className="min-w-[680px] overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.03]">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_80px_70px_80px_90px_70px_60px_70px] gap-4 border-b border-white/[0.05] px-5 py-3">
              {[
                { label: 'Campaign',  col: null                    },
                { label: 'Type',      col: null                    },
                { label: 'Status',    col: null                    },
                { label: 'Spend',     col: 'spend' as SortCol      },
                { label: 'Impr.',     col: 'impressions' as SortCol },
                { label: 'Clicks',    col: null                    },
                { label: 'Leads',     col: 'leads' as SortCol      },
                { label: 'CPL',       col: 'cpl' as SortCol        },
              ].map(({ label, col }) => (
                <button
                  key={label}
                  onClick={() => col && handleSort(col)}
                  className={[
                    'flex items-center gap-1 text-[12px] font-medium uppercase tracking-[0.16em] transition',
                    col ? 'cursor-pointer text-white/30 hover:text-white/60' : 'cursor-default text-white/30',
                    col && sortCol === col ? 'text-white/60' : '',
                  ].join(' ')}
                >
                  {label}
                  {col && sortCol === col && (
                    sortAsc ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />
                  )}
                </button>
              ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-white/[0.04]">
              {sortedCampaigns.map((c) => (
                <div
                  key={c.name}
                  className="grid grid-cols-[2fr_80px_70px_80px_90px_70px_60px_70px] gap-4 items-center px-5 py-4"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.status === 'Active' ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]'}`} />
                    <span className="truncate text-[13px] font-semibold text-white/90">{c.name}</span>
                  </div>
                  <div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                      style={{
                        backgroundColor: `${GOOGLE_BLUE}14`,
                        border: `1px solid ${GOOGLE_BLUE}28`,
                        color: GOOGLE_BLUE,
                      }}
                    >
                      {c.type}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                        c.status === 'Active'
                          ? 'border border-emerald-400/20 bg-[#D4AF37]/10 text-[#D4AF37]'
                          : 'border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[12px] text-white/70">
                    AED {c.spend.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-white/60">
                    {c.impressions.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-white/60">
                    {c.clicks.toLocaleString()}
                  </div>
                  <div className="text-[13px] font-semibold text-[#D4AF37]">
                    {c.leads}
                  </div>
                  <div className="text-[12px] text-white/70">
                    AED {c.cpl}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Top search terms */}
      <section className="mt-10">
        <div className="mb-4 text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Top Search Terms</div>
        <div className="overflow-x-auto">
          <div className="min-w-[560px] overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.03]">
            {/* Header */}
            <div className="grid grid-cols-[2fr_90px_70px_70px_90px] gap-4 border-b border-white/[0.05] px-5 py-3">
              {['Search Term', 'Impressions', 'Clicks', 'CTR', 'Avg CPC'].map((h) => (
                <div key={h} className="text-[12px] font-medium uppercase tracking-[0.16em] text-white/30">{h}</div>
              ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-white/[0.04]">
              {searchTerms.map((s) => (
                <div
                  key={s.term}
                  className="grid grid-cols-[2fr_90px_70px_70px_90px] gap-4 items-center px-5 py-4"
                >
                  <div className="text-[13px] text-white/85 font-medium">{s.term}</div>
                  <div className="text-[12px] text-white/60">{s.impressions.toLocaleString()}</div>
                  <div className="text-[12px] text-white/70">{s.clicks}</div>
                  <div className="text-[12px] font-semibold" style={{ color: GOOGLE_BLUE }}>{s.ctr}</div>
                  <div className="text-[12px] text-white/70">{s.avgCpc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Link */}
      <div className="mt-8">
        <Link
          href="/freehold-intelligence/lead-machine/google"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white/80 transition hover:border-[#4285F4]/30 hover:text-white"
        >
          Manage Google Ads <ArrowUpRight className="h-3.5 w-3.5" style={{ color: GOOGLE_BLUE }} />
        </Link>
      </div>

    </div>
  )
}
