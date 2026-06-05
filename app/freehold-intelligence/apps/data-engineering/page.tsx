'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, CheckCircle2, AlertCircle, Image, FileText, ArrowUpRight } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type FieldStatus = true | false | 'partial'

type ListingData = {
  id: string
  name: string
  area: string
  developer: string
  completeness: number
  fields: Record<string, FieldStatus>
  urgent: string[]
  href: string
}

type CompletenessFilter = 'All' | 'strong' | 'moderate' | 'critical'

const DATA_FIELDS = [
  'Project name', 'Developer', 'Area', 'Property type',
  'Starting price', 'Payment plan', 'Handover date', 'Service charge',
  'Rental yield', 'Hero image', 'Brochure PDF', 'Floor plans',
]

const LISTINGS: ListingData[] = [
  {
    id: 'lm_001',
    name: 'Palm Jumeirah Investor Pack',
    area: 'Palm Jumeirah',
    developer: 'Nakheel',
    completeness: 75,
    href: '/freehold-intelligence/lead-machine/listings/lm_001',
    fields: {
      'Project name': true, 'Developer': true, 'Area': true,
      'Property type': true, 'Starting price': true, 'Payment plan': true,
      'Handover date': true, 'Service charge': false, 'Rental yield': true,
      'Hero image': true, 'Brochure PDF': false, 'Floor plans': false,
    },
    urgent: ['Service charge not confirmed', 'Brochure PDF missing', 'Floor plans missing'],
  },
  {
    id: 'lm_002',
    name: 'Dubai Hills Yield Campaign',
    area: 'Dubai Hills Estate',
    developer: 'Emaar',
    completeness: 92,
    href: '/freehold-intelligence/lead-machine/listings/lm_002',
    fields: {
      'Project name': true, 'Developer': true, 'Area': true,
      'Property type': true, 'Starting price': true, 'Payment plan': true,
      'Handover date': true, 'Service charge': true, 'Rental yield': true,
      'Hero image': true, 'Brochure PDF': true, 'Floor plans': false,
    },
    urgent: ['Floor plans missing'],
  },
  {
    id: 'lm_003',
    name: 'Business Bay Entry Offer',
    area: 'Business Bay',
    developer: 'Binghatti',
    completeness: 42,
    href: '/freehold-intelligence/lead-machine/listings/lm_003',
    fields: {
      'Project name': true, 'Developer': true, 'Area': true,
      'Property type': true, 'Starting price': false, 'Payment plan': false,
      'Handover date': false, 'Service charge': false, 'Rental yield': false,
      'Hero image': 'partial', 'Brochure PDF': false, 'Floor plans': false,
    },
    urgent: ['Starting price missing', 'Payment plan not set', 'Handover date not confirmed', 'Service charge not confirmed', 'Hero image needs replacement'],
  },
]

const AREA_PROFILES = [
  { area: 'Palm Jumeirah', fieldsComplete: 8, totalFields: 9, status: 'strong' },
  { area: 'Dubai Hills Estate', fieldsComplete: 7, totalFields: 9, status: 'strong' },
  { area: 'Business Bay', fieldsComplete: 5, totalFields: 9, status: 'needs_work' },
  { area: 'Creek Beach', fieldsComplete: 6, totalFields: 9, status: 'moderate' },
  { area: 'JVC', fieldsComplete: 4, totalFields: 9, status: 'needs_work' },
]

const totalFields  = LISTINGS.length * DATA_FIELDS.length
const filledFields = LISTINGS.flatMap((l) => Object.values(l.fields)).filter((v) => v === true).length
const avgComplete  = Math.round(LISTINGS.reduce((s, l) => s + l.completeness, 0) / LISTINGS.length)
const urgentTotal  = LISTINGS.flatMap((l) => l.urgent).length

function FieldDot({ status }: { status: FieldStatus }) {
  if (status === true)      return <CheckCircle2 className="h-3.5 w-3.5 text-[#D4AF37]" />
  if (status === 'partial') return <div className="h-3.5 w-3.5 rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/20" />
  return <div className="h-3.5 w-3.5 rounded-full border border-red-400/40 bg-red-400/10" />
}

export default function DataEngineeringPage() {
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('All')

  const filteredListings = useMemo(() => {
    if (completenessFilter === 'All')      return LISTINGS
    if (completenessFilter === 'strong')   return LISTINGS.filter((l) => l.completeness >= 80)
    if (completenessFilter === 'moderate') return LISTINGS.filter((l) => l.completeness >= 60 && l.completeness < 80)
    return LISTINGS.filter((l) => l.completeness < 60) // critical
  }, [completenessFilter])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Database className="h-3.5 w-3.5" /> Data Engineering
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#D4AF37]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" /> In progress
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Project data<br /><span className="text-white/35">{avgComplete}% complete.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          Field completeness, media quality, and area profile coverage. Every missing field is a gap that weakens a landing page or blocks campaign launch.
        </p>
      </section>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Avg. completeness', value: `${avgComplete}%`, color: avgComplete >= 80 ? 'text-[#D4AF37]' : 'text-[#D4AF37]' },
          { label: 'Fields filled',    value: `${filledFields}/${totalFields}`, color: 'text-white' },
          { label: 'Urgent gaps',      value: urgentTotal,       color: urgentTotal > 0 ? 'text-red-300' : 'text-[#D4AF37]' },
          { label: 'Listings tracked', value: LISTINGS.length,   color: 'text-white' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4">
            <div className={`text-[28px] font-semibold leading-none ${stat.color}`}>{stat.value}</div>
            <div className="mt-1.5 text-[13px] text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Completeness matrix */}
      <section className="mt-12">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Field matrix</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Listing data completeness</h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { key: 'All',      label: 'All' },
            { key: 'strong',   label: 'Strong (≥80%)' },
            { key: 'moderate', label: 'Moderate' },
            { key: 'critical', label: 'Critical (<60%)' },
          ] as { key: CompletenessFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCompletenessFilter(key)}
              className={[
                'rounded-full border px-3 py-1 text-[13px] font-medium transition',
                completenessFilter === key
                  ? key === 'critical' ? 'border-red-400/40 bg-red-400/10 text-red-300'
                    : key === 'moderate' ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : key === 'strong' ? 'border-emerald-400/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-white/30">
          {filteredListings.length === LISTINGS.length
            ? `${LISTINGS.length} listings`
            : `${filteredListings.length} of ${LISTINGS.length} listings`}
        </p>

        {filteredListings.length === 0 ? (
          <div className="rounded-[22px] border border-white/[0.08] bg-[#131B2B] px-6 py-10 text-center text-[13px] text-white/35">
            No listings match this filter.{' '}
            <button onClick={() => setCompletenessFilter('All')} className="ml-1 text-[#D4AF37]/60 hover:text-[#D4AF37]">Show all</button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {filteredListings.map((listing) => (
              <div key={listing.id} className={`rounded-[22px] border p-5 sm:p-6 ${listing.completeness < 60 ? 'border-red-400/15 bg-red-400/[0.03]' : 'border-white/[0.08] bg-[#131B2B]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/70">{listing.area} · {listing.developer}</div>
                    <h3 className="mt-1 text-[16px] font-semibold text-white">{listing.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[13px] font-semibold ${listing.completeness >= 80 ? 'text-[#D4AF37]' : listing.completeness >= 60 ? 'text-[#D4AF37]' : 'text-red-300'}`}>
                      {listing.completeness}%
                    </span>
                    <Link href={listing.href} className="inline-flex items-center gap-1 text-[13px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]">
                      Open <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${listing.completeness >= 80 ? 'bg-[#D4AF37]' : listing.completeness >= 60 ? 'bg-[#D4AF37]' : 'bg-red-400'}`}
                    style={{ width: `${listing.completeness}%` }}
                  />
                </div>

                {/* Field grid */}
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                  {DATA_FIELDS.map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <FieldDot status={listing.fields[field] ?? false} />
                      <span className={`text-[12px] ${listing.fields[field] === true ? 'text-white/65' : 'text-white/35'}`}>{field}</span>
                    </div>
                  ))}
                </div>

                {/* Urgent gaps */}
                {listing.urgent.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {listing.urgent.map((gap) => (
                      <span key={gap} className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/[0.06] px-2.5 py-1 text-[13px] text-red-300">
                        <AlertCircle className="h-3 w-3" /> {gap}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Area profiles */}
      <section className="mt-14">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Area profiles</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Coverage by area</h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#131B2B]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Area</th>
                <th className="px-4 py-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Fields</th>
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Coverage</th>
                <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {AREA_PROFILES.map((area) => {
                const pct = Math.round((area.fieldsComplete / area.totalFields) * 100)
                return (
                  <tr key={area.area} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-medium text-white/85">{area.area}</td>
                    <td className="px-4 py-4 text-center text-white/50">{area.fieldsComplete}/{area.totalFields}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={`h-full rounded-full ${pct >= 75 ? 'bg-[#D4AF37]' : pct >= 55 ? 'bg-[#D4AF37]' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[12px] text-white/50">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[13px] font-medium ${area.status === 'strong' ? 'text-[#D4AF37]' : area.status === 'moderate' ? 'text-[#D4AF37]' : 'text-red-300'}`}>
                        {area.status === 'strong' ? 'Strong' : area.status === 'moderate' ? 'Moderate' : 'Needs work'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Media quality note */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">
            <Image className="h-3 w-3" /> Media quality
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/65">
            Palm and Hills have production-grade hero images. Business Bay has a placeholder — needs a real render or developer-supplied photo before landing can go live.
          </p>
        </div>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">
            <FileText className="h-3 w-3" /> Brochures
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/65">
            Palm brochure PDF is missing — required for the investor lead follow-up flow. Dubai Hills brochure ready. Business Bay needs a full document set from the developer.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about data gaps, media quality, field completeness…"
          suggestions={[
            'Which listing has the most critical missing fields?',
            'What data does Business Bay still need before launch?',
            'Which areas have the strongest data coverage?',
          ]}
        />
      </section>

    </div>
  )
}
