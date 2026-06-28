'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Megaphone, CheckCircle2, Clock, AlertCircle, ArrowUpRight, Sparkles, X } from 'lucide-react'
import { ExpertDepth } from '@/components/freehold/expert-depth'

type AngleItem = { id: string; title: string; platform: string; headline: string; hook: string; status: 'pending_approval' | 'draft' | 'approved' }
type AngleGroup = { listing: string; area: string; listingHref: string; items: AngleItem[] }

const ALL_ANGLES: AngleGroup[] = [
  {
    listing: 'Palm Jumeirah Investor Pack',
    area: 'Palm Jumeirah',
    listingHref: '/freehold-intelligence/lead-machine/listings/lm_001',
    items: [
      { id: 'a1', title: 'Scarcity + Yield',  platform: 'Meta',      headline: 'Palm Jumeirah — AED 3.2M, 60/40, 5.8% yield. Last 12 units at this price.', hook: 'Lead with scarcity, payment-plan clarity and Palm supply comparison. CTA: investor summary.', status: 'pending_approval' as const },
      { id: 'a2', title: 'Trophy Address',    platform: 'Instagram', headline: 'Own Palm Jumeirah. From AED 3.2M.',                                          hook: 'The address your investors recognise. Lifestyle + prestige angle.',                          status: 'draft' as const },
    ],
  },
  {
    listing: 'Dubai Hills Yield Campaign',
    area: 'Dubai Hills Estate',
    listingHref: '/freehold-intelligence/lead-machine/listings/lm_002',
    items: [
      { id: 'a3', title: 'Yield Corridor',   platform: 'Meta',      headline: 'Dubai Hills — 6.4% net yield. AED 1.85M, 70/30 payment plan.',               hook: 'Investors are choosing Dubai Hills for one reason: the numbers work.',                       status: 'approved' as const },
      { id: 'a4', title: 'Family + Yield',   platform: 'Instagram', headline: 'Dubai Hills from AED 1.85M. Live in it. Earn from it.',                       hook: 'Your family lives in it. It pays you back. End-user investor crossover.',                  status: 'draft' as const },
      { id: 'a5', title: 'Supply Scarcity',  platform: 'Meta',      headline: 'Only 14 remaining at this phase price. Compare Beach and Downtown.',           hook: 'FOMO-motivated investor. Comparison creative vs. equivalent budget options.',              status: 'draft' as const },
    ],
  },
]

const INITIAL_APPROVALS = [
  { id: 'ap1', title: 'Palm investor angle — Meta primary text',         listing: 'Palm Jumeirah', submittedBy: 'Marketing', submittedAt: '2026-06-04T10:00:00+04:00' },
  { id: 'ap2', title: 'Dubai Hills — LinkedIn caption set (3 variants)', listing: 'Dubai Hills',  submittedBy: 'Marketing', submittedAt: '2026-06-03T16:30:00+04:00' },
]

const WEEK = [
  { day: 'Mon', post: 'Palm investor teaser (story)',  platform: 'Instagram', status: 'scheduled' as const },
  { day: 'Tue', post: 'Hills yield data carousel',     platform: 'LinkedIn',  status: 'pending'   as const },
  { day: 'Wed', post: null,                             platform: null,        status: null },
  { day: 'Thu', post: 'Palm payment plan ad',          platform: 'Meta Ads',  status: 'draft'     as const },
  { day: 'Fri', post: 'UAE market update reel',        platform: 'Instagram', status: 'pending'   as const },
  { day: 'Sat', post: null,                             platform: null,        status: null },
  { day: 'Sun', post: 'Hills lead form CTA',           platform: 'Meta Ads',  status: 'blocked'   as const },
]

const ANGLE_STATUS = {
  approved:        { label: 'Approved',         classes: 'bg-gold/10 text-gold border-gold/20' },
  pending_approval:{ label: 'Pending approval', classes: 'bg-gold/10 text-gold border-gold/20' },
  draft:           { label: 'Draft',            classes: 'bg-surface-2 text-slate-400 border-line-strong' },
}

const PLATFORM_CLASSES: Record<string, string> = {
  'Meta':     'bg-blue-400/10 text-blue-300 border-blue-400/20',
  'Instagram':'bg-pink-400/10 text-pink-300 border-pink-400/20',
  'LinkedIn': 'bg-sky-400/10 text-slate-400 border-sky-400/20',
  'Meta Ads': 'bg-blue-400/10 text-blue-300 border-blue-400/20',
}

const SCHEDULE_STATUS = {
  scheduled: 'text-gold',
  pending:   'text-gold',
  draft:     'text-slate-500',
  blocked:   'text-red-300',
}

type AngleStatus     = 'all' | 'approved' | 'pending_approval' | 'draft'
type PlatformFilter  = 'All' | 'Meta' | 'Instagram' | 'LinkedIn'

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SocialMediaManagerPage() {
  const [approvalState, setApprovalState] = useState<Record<string, 'approved' | 'changes_requested'>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('All')
  const [angleStatusFilter, setAngleStatusFilter] = useState<AngleStatus>('all')

  function handleApproval(id: string, title: string, action: 'approved' | 'changes_requested') {
    setApprovalState((prev) => ({ ...prev, [id]: action }))
    setFlash(action === 'approved' ? `"${title.slice(0, 40)}" approved` : 'Changes requested — item returned to draft')
    setTimeout(() => setFlash(null), 2800)
  }

  const pendingApprovals = useMemo(
    () => INITIAL_APPROVALS.filter((ap) => !approvalState[ap.id]),
    [approvalState]
  )

  const filteredGroups = useMemo(() => {
    return ALL_ANGLES.map((group) => {
      const items = group.items.filter((angle) => {
        let effectiveStatus: string = angle.status
        if (angle.id === 'a1' && approvalState['ap1'] === 'approved') effectiveStatus = 'approved'
        if (angle.id === 'a2' && approvalState['ap2'] === 'approved') effectiveStatus = 'approved'
        if (platformFilter !== 'All' && angle.platform !== platformFilter) return false
        if (angleStatusFilter !== 'all' && effectiveStatus !== angleStatusFilter) return false
        return true
      })
      return { ...group, items }
    }).filter((g) => g.items.length > 0)
  }, [platformFilter, angleStatusFilter, approvalState])

  const totalAngles = ALL_ANGLES.flatMap((g) => g.items).length
  const approvedCount = ALL_ANGLES.flatMap((g) => g.items).filter(
    (a) => a.status === 'approved' || (a.id === 'a1' && approvalState['ap1'] === 'approved') || (a.id === 'a2' && approvalState['ap2'] === 'approved')
  ).length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
            <Megaphone className="h-3.5 w-3.5" /> Social Media Manager
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-xs font-medium text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Planned
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Campaign angles<br />
          <span className="text-slate-500">{approvedCount}/{totalAngles} approved.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
          Campaign copy, social captions, creative angles and publishing schedule. Approval required before any angle runs in a paid channel.
        </p>
      </section>

      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <div className="mt-8 rounded-[20px] border border-gold/20 bg-gold/[0.04] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{pendingApprovals.length} item{pendingApprovals.length !== 1 ? 's' : ''} waiting for approval</div>
              <div className="mt-3 space-y-2">
                {pendingApprovals.map((ap) => (
                  <div key={ap.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line bg-surface-2 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100">{ap.title}</div>
                      <div className="mt-0.5 text-sm text-slate-500">{ap.listing} · submitted by {ap.submittedBy} · {fmt(ap.submittedAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(ap.id, ap.title, 'approved')}
                        className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-sm font-medium text-gold transition hover:bg-gold/20"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(ap.id, ap.title, 'changes_requested')}
                        className="rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-sm font-medium text-slate-400 transition hover:bg-surface-2"
                      >
                        Request changes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {pendingApprovals.length === 0 && INITIAL_APPROVALS.length > 0 && (
        <div className="mt-8 flex items-center gap-2 rounded-[18px] border border-emerald-400/15 bg-gold/[0.03] px-5 py-4 text-sm text-gold">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> All approval items resolved.
        </div>
      )}

      {/* Campaign angles filter */}
      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Campaign angles</div>
            <h2 className="mt-1 text-xl font-semibold text-white">By listing</h2>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['All', 'Meta', 'Instagram', 'LinkedIn'] as PlatformFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                platformFilter === p
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
          <span className="self-center text-slate-700">|</span>
          {([
            { key: 'all',              label: 'All'         },
            { key: 'approved',         label: 'Approved'    },
            { key: 'pending_approval', label: 'Pending'     },
            { key: 'draft',            label: 'Draft'       },
          ] as { key: AngleStatus; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAngleStatusFilter(key)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                angleStatusFilter === key
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-8">
          {filteredGroups.length === 0 ? (
            <div className="rounded-[18px] border border-line px-6 py-10 text-center text-sm text-slate-500">
              No angles match these filters.{' '}
              <button
                onClick={() => { setPlatformFilter('All'); setAngleStatusFilter('all') }}
                className="text-gold/60 transition hover:text-gold"
              >
                Clear
              </button>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.listing}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gold/70">{group.area}</div>
                    <h3 className="mt-0.5 text-base font-semibold text-white">{group.listing}</h3>
                  </div>
                  <Link href={group.listingHref} className="inline-flex items-center gap-1 text-sm text-gold/60 transition hover:text-gold">
                    Open workspace <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((angle) => {
                    let effectiveStatus: keyof typeof ANGLE_STATUS = angle.status
                    if ((angle.id === 'a1' && approvalState['ap1'] === 'approved') ||
                        (angle.id === 'a2' && approvalState['ap2'] === 'approved')) {
                      effectiveStatus = 'approved'
                    }
                    const st = ANGLE_STATUS[effectiveStatus]
                    return (
                      <div key={angle.id} className={`rounded-[18px] border p-5 ${effectiveStatus === 'approved' ? 'border-emerald-400/15 bg-gold/[0.03]' : 'border-line bg-surface'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-white">{angle.title}</div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PLATFORM_CLASSES[angle.platform] ?? 'border-line-strong text-slate-400'}`}>
                            {angle.platform}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium leading-snug text-slate-100">{angle.headline}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{angle.hook}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.classes}`}>{st.label}</span>
                          {effectiveStatus === 'approved' && <CheckCircle2 className="h-3.5 w-3.5 text-gold" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Weekly publishing schedule */}
      <section className="mt-14">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Publishing schedule</div>
        <h2 className="mt-2 text-xl font-semibold text-white">This week</h2>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {WEEK.map((day) => (
            <div
              key={day.day}
              className={`min-h-[90px] rounded-[14px] border p-3 ${day.post ? 'border-line bg-surface' : 'border-line bg-transparent'}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{day.day}</div>
              {day.post && (
                <>
                  <p className="mt-2 text-xs leading-snug text-slate-300">{day.post}</p>
                  <div className={`mt-2 text-xs font-semibold ${day.status ? SCHEDULE_STATUS[day.status] : 'text-slate-600'}`}>
                    {day.status}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
          {(['scheduled', 'pending', 'draft', 'blocked'] as const).map((s) => (
            <span key={s} className={`flex items-center gap-1.5 ${SCHEDULE_STATUS[s]}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {s}
            </span>
          ))}
        </div>
      </section>

      {/* AI Take */}
      <section className="mt-10 rounded-[24px] border border-line bg-surface-2 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/80">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="mt-3 text-base leading-[1.65] text-slate-100">
          The Dubai Hills yield angle is approved and ready for launch. The Palm angle is one approval away — the scarcity + yield combination is the strongest angle for this market right now. Approve it before the weekend schedule.
        </p>
      </section>

      {/* Ask the single docked Expert — no separate conversation */}
      <ExpertDepth prompts={['expert.depth.marketing.q1', 'expert.depth.marketing.q2', 'expert.depth.marketing.q3']} />

      {/* Flash toast */}
      {flash && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/25 bg-surface px-5 py-2.5 text-sm font-medium text-gold shadow-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {flash}
          <button onClick={() => setFlash(null)} className="text-slate-500 transition hover:text-slate-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
