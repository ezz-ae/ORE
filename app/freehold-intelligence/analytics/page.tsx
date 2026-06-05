'use client'

import { siteAnalytics } from '@/src/features/freehold-intelligence/analytics'

const FLAG: Record<string, string> = {
  AE: '🇦🇪',
  SA: '🇸🇦',
  GB: '🇬🇧',
  IN: '🇮🇳',
  KW: '🇰🇼',
  DE: '🇩🇪',
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function SourceBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    organic:  'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    paid:     'border-blue-500/20 bg-blue-500/10 text-blue-400',
    social:   'border-violet-500/20 bg-violet-500/10 text-violet-400',
    direct:   'border-white/[0.08] bg-white/[0.04] text-white/45',
    referral: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    email:    'border-orange-500/20 bg-orange-500/10 text-orange-400',
  }
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${styles[type] ?? styles.direct}`}>
      {label}
    </span>
  )
}

export default function AnalyticsPage() {
  const a = siteAnalytics

  const mobile  = a.devices.find((d) => d.device === 'mobile')!
  const desktop = a.devices.find((d) => d.device === 'desktop')!
  const tablet  = a.devices.find((d) => d.device === 'tablet')!

  const funnelMax = a.funnel[0].users

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Site Analytics</h1>
          <p className="mt-1 text-sm text-white/40">Traffic, conversions, and audience insights</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3.5 py-2 text-sm font-medium text-violet-400">
          Last 30 days
        </div>
      </div>

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Page Views</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">
            {a.totalPageViews.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-white/35">Total impressions</div>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Unique Visitors</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">
            {a.totalUniqueSessions.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-white/35">Sessions · 30d</div>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Conversions</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-[#D4AF37]">
            {a.totalConversions.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-white/35">
            {(a.conversionRate * 100).toFixed(1)}% conv. rate
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/40">Avg Session</div>
          <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">
            {formatDuration(a.avgSessionDuration)}
          </div>
          <div className="mt-1 text-xs text-white/35">Avg duration</div>
        </div>
      </div>

      {/* ── Traffic Sources ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Traffic Sources</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Source</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Type</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Sessions</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Conversions</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {a.sources.map((src) => (
                  <tr key={src.name} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-medium text-white/75">{src.name}</td>
                    <td className="px-5 py-4">
                      <SourceBadge type={src.type} />
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/65">
                      {src.sessions.toLocaleString('en-US')}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/65">{src.conversions}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium tabular-nums ${src.convRate >= 0.05 ? 'text-[#D4AF37]' : src.convRate >= 0.03 ? 'text-emerald-400' : 'text-white/50'}`}>
                        {(src.convRate * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Top Pages ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Top Pages</div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Page</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Views</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Avg Time</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Bounce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {a.topPages.map((page) => (
                  <tr key={page.path} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white/75">{page.title}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-white/30">{page.path}</div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/65">
                      {page.pageViews.toLocaleString('en-US')}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/65">
                      {formatDuration(page.avgTimeOnPage)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium tabular-nums ${page.bounceRate >= 0.6 ? 'text-amber-400' : page.bounceRate <= 0.35 ? 'text-emerald-400' : 'text-white/50'}`}>
                        {Math.round(page.bounceRate * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Device Breakdown ── */}
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Device Breakdown</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Mobile',  data: mobile,  color: 'text-sky-400',    bar: 'bg-sky-500'    },
            { label: 'Desktop', data: desktop, color: 'text-violet-400', bar: 'bg-violet-500' },
            { label: 'Tablet',  data: tablet,  color: 'text-amber-400',  bar: 'bg-amber-500'  },
          ].map(({ label, data, color, bar }) => {
            const totalSessions = a.devices.reduce((s, d) => s + d.sessions, 0)
            const pct = Math.round((data.sessions / totalSessions) * 100)
            return (
              <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</span>
                  <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
                </div>
                <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90">
                  {data.sessions.toLocaleString('en-US')}
                  <span className="ml-1 text-sm font-normal text-white/30">sessions</span>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/40">
                  <div>
                    <span className="block text-white/60 font-medium">{Math.round(data.bounceRate * 100)}%</span>
                    Bounce rate
                  </div>
                  <div>
                    <span className="block text-white/60 font-medium">{data.conversions}</span>
                    Conversions
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Countries + Conversion Funnel ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Countries */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Countries</div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/35">Country</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Sessions</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-white/35">Convs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {a.countries.map((c) => (
                  <tr key={c.code} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4 text-white/75">
                      <span className="mr-2 text-base">{FLAG[c.code] ?? ''}</span>
                      {c.country}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-white/60">
                      {c.sessions.toLocaleString('en-US')}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-[#D4AF37]">{c.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Conversion Funnel */}
        <section>
          <div className="mb-4 text-xs font-medium uppercase tracking-widest text-white/40">Conversion Funnel</div>
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5 space-y-4">
            {a.funnel.map((step, i) => {
              const widthPct = Math.round((step.users / funnelMax) * 100)
              const isLast = i === a.funnel.length - 1
              return (
                <div key={step.step}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-white/60">{step.step}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums font-semibold text-white/80">
                        {step.users.toLocaleString('en-US')}
                      </span>
                      {step.dropRate > 0 && (
                        <span className="text-red-400/70">
                          −{Math.round(step.dropRate * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-6 w-full rounded-lg bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all ${isLast ? 'bg-[#D4AF37]/70' : 'bg-white/[0.12]'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>

    </div>
  )
}
