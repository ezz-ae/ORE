'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Target, Users, Globe, ArrowUpRight, Zap, MapPin, Sliders, Search, X } from 'lucide-react'
import { TARGETING_TEMPLATES } from '@/lib/meta/targeting-templates'
import type { TargetingUseCase } from '@/lib/meta/types'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const USE_CASE_CONFIG: Record<TargetingUseCase, { label: string; color: string; badge: string }> = {
  investor:       { label: 'Investor',       color: 'text-gold',   badge: 'border-gold/25 bg-gold/10 text-[#F8E7AE]'   },
  end_user:       { label: 'End user',       color: 'text-gold', badge: 'border-gold/20 bg-gold/10 text-gold' },
  golden_visa:    { label: 'Golden Visa',    color: 'text-slate-400',     badge: 'border-sky-400/20 bg-sky-400/10 text-sky-200'           },
  secondary:      { label: 'Secondary',      color: 'text-slate-400',  badge: 'border-violet-400/20 bg-violet-400/10 text-slate-400'  },
  international:  { label: 'International',  color: 'text-slate-400',    badge: 'border-rose-400/20 bg-rose-400/10 text-rose-200'        },
  custom:         { label: 'Custom',         color: 'text-slate-400',    badge: 'border-white/10 bg-surface-2 text-slate-400'          },
}

const UAE_CITIES = [
  { key: '2562407', name: 'Dubai'        },
  { key: '2563573', name: 'Abu Dhabi'    },
  { key: '2565040', name: 'Sharjah'      },
  { key: '2559677', name: 'Ajman'        },
  { key: '2566793', name: 'Ras Al Khaimah' },
]

function cityName(key: string): string {
  return UAE_CITIES.find((c) => c.key === key)?.name ?? key
}

function countryName(code: string): string {
  const map: Record<string, string> = { AE: 'UAE', SA: 'Saudi Arabia', KW: 'Kuwait', QA: 'Qatar', BH: 'Bahrain', OM: 'Oman', GB: 'UK', DE: 'Germany', IN: 'India' }
  return map[code] ?? code
}

type UseCaseFilter = 'All' | 'investor' | 'end_user' | 'golden_visa' | 'secondary' | 'international' | 'custom'

export default function TargetingPage() {
  const [useCaseFilter, setUseCaseFilter] = useState<UseCaseFilter>('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let items = TARGETING_TEMPLATES
    if (useCaseFilter !== 'All') {
      items = items.filter((t) => t.useCase === useCaseFilter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      )
    }
    return items
  }, [useCaseFilter, query])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Target className="h-3.5 w-3.5" /> Targeting
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Audience templates<br />
          <span className="text-slate-500">{TARGETING_TEMPLATES.length} presets ready.</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-[1.65] text-slate-400">
          Pre-built audience configurations for UAE real estate. Apply one to a new campaign — all parameters pre-filled. Customise before launch.
        </p>
      </section>

      {/* How targeting works */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Users,   title: 'Behaviour-based',   body: 'Interests, purchase signals and on-platform behaviour — not just demographics.' },
          { icon: MapPin,  title: 'Geo-precise',        body: 'City-level targeting within the UAE. Dubai and Abu Dhabi broken out from each other.' },
          { icon: Sliders, title: 'Fully editable',     body: 'All templates are starting points — override any field in the campaign wizard.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-[18px] border border-line bg-surface p-5">
            <Icon className="h-4 w-4 text-gold/60 mb-2" />
            <div className="text-sm font-semibold text-white">{title}</div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="mt-8">
        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates by name or description…"
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-400"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Use-case filter pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setUseCaseFilter('All')}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
              useCaseFilter === 'All'
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
            }`}
          >
            All
          </button>
          {(Object.keys(USE_CASE_CONFIG) as TargetingUseCase[]).map((key) => (
            <button
              key={key}
              onClick={() => setUseCaseFilter(key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                useCaseFilter === key
                  ? USE_CASE_CONFIG[key].badge
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
              }`}
            >
              {USE_CASE_CONFIG[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Templates &mdash; {filtered.length} of {TARGETING_TEMPLATES.length}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-sm text-slate-500">No templates match</p>
            <button
              onClick={() => { setUseCaseFilter('All'); setQuery('') }}
              className="rounded-full border border-line bg-surface-2 px-4 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-100"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {filtered.map((tmpl) => {
              const uc = USE_CASE_CONFIG[tmpl.useCase]
              const campaignUrl = `/freehold-intelligence/lead-machine/campaigns/new?template=${tmpl.id}`

              return (
                <div key={tmpl.id} className="rounded-[24px] border border-line bg-surface p-6">
                  {/* Top */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-[17px] font-semibold text-white">{tmpl.name}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${uc.badge}`}>{uc.label}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-400">{tmpl.description}</p>
                    </div>
                    <Link
                      href={campaignUrl}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] shrink-0"
                    >
                      Use template <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Params grid */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">Age range</div>
                      <div className="text-[14px] font-semibold text-white">{tmpl.targeting.ageMin}–{tmpl.targeting.ageMax}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">Est. reach</div>
                      <div className="text-[14px] font-semibold text-gold">{tmpl.estimatedReach}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">Countries</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tmpl.targeting.countries.map((c) => (
                          <span key={c} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                            {countryName(c)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">Cities</div>
                      <div className="text-sm text-slate-400">
                        {tmpl.targeting.cityKeys.length > 0
                          ? tmpl.targeting.cityKeys.map((k) => cityName(k)).join(', ')
                          : 'All cities'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Interests */}
                  <div className="mt-4">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">Interests</div>
                    <div className="flex flex-wrap gap-2">
                      {tmpl.targeting.interests.map((interest) => (
                        <span key={interest.id} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-sm text-slate-400">
                          {interest.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Platforms */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Globe className="h-3 w-3" />
                    {tmpl.targeting.publisherPlatforms.join(' + ')}
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">{tmpl.audience}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Custom targeting note */}
      <section className="mt-10 rounded-[22px] border border-gold/10 bg-gold/[0.03] p-6">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
          <div>
            <div className="text-[14px] font-semibold text-white">Custom targeting</div>
            <p className="mt-1 text-sm text-slate-400">
              To build a fully custom audience — Lookalike, Website Custom Audience, or Customer List — create it in Meta Ads Manager first, then attach it in the campaign wizard.
              Templates above are interest-based and work immediately without any custom audience setup.
            </p>
            <Link
              href="/freehold-intelligence/lead-machine/campaigns/new"
              className="mt-3 inline-flex items-center gap-1 text-xs text-gold/70 transition hover:text-gold"
            >
              Launch new campaign <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about targeting, audiences, reach, demographics…"
          suggestions={[
            'Which audience template works best for Palm Jumeirah?',
            'How do I target Golden Visa buyers specifically?',
            'What age range converts best for investment property in Dubai?',
            'Should I use broad or narrow targeting for a new listing?',
          ]}
        />
      </section>

    </div>
  )
}
