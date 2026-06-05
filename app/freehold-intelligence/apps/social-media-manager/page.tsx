import Link from 'next/link'
import { ArrowLeft, Megaphone, CheckCircle2, Clock, AlertCircle, ArrowUpRight, Sparkles } from 'lucide-react'
import { getServerApp } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const ANGLES = [
  {
    listing: 'Palm Jumeirah Investor Pack',
    area: 'Palm Jumeirah',
    listingHref: '/freehold-intelligence/lead-machine/listings/lm_001',
    items: [
      { id: 'a1', title: 'Scarcity + Yield', platform: 'Meta', headline: 'Palm Jumeirah — AED 3.2M, 60/40, 5.8% yield. Last 12 units at this price.', hook: 'Lead with scarcity, payment-plan clarity and Palm supply comparison. CTA: investor summary.', status: 'pending_approval' },
      { id: 'a2', title: 'Trophy Address', platform: 'Instagram', headline: 'Own Palm Jumeirah. From AED 3.2M.', hook: 'The address your investors recognise. Lifestyle + prestige angle.', status: 'draft' },
    ],
  },
  {
    listing: 'Dubai Hills Yield Campaign',
    area: 'Dubai Hills Estate',
    listingHref: '/freehold-intelligence/lead-machine/listings/lm_002',
    items: [
      { id: 'a3', title: 'Yield Corridor', platform: 'Meta', headline: 'Dubai Hills — 6.4% net yield. AED 1.85M, 70/30 payment plan.', hook: 'Investors are choosing Dubai Hills for one reason: the numbers work.', status: 'approved' },
      { id: 'a4', title: 'Family + Yield', platform: 'Instagram', headline: 'Dubai Hills from AED 1.85M. Live in it. Earn from it.', hook: 'Your family lives in it. It pays you back. End-user investor crossover.', status: 'draft' },
      { id: 'a5', title: 'Supply Scarcity', platform: 'Meta', headline: 'Only 14 remaining at this phase price. Compare Beach and Downtown.', hook: 'FOMO-motivated investor. Comparison creative vs. equivalent budget options.', status: 'draft' },
    ],
  },
]

const APPROVALS = [
  { id: 'ap1', title: 'Palm investor angle — Meta primary text', listing: 'Palm Jumeirah', submittedBy: 'Marketing', submittedAt: '2026-06-04T10:00:00+04:00' },
  { id: 'ap2', title: 'Dubai Hills — LinkedIn caption set (3 variants)', listing: 'Dubai Hills', submittedBy: 'Marketing', submittedAt: '2026-06-03T16:30:00+04:00' },
]

const WEEK: { day: string; post: string | null; platform: string | null; status: 'scheduled' | 'pending' | 'draft' | 'blocked' | null }[] = [
  { day: 'Mon', post: 'Palm investor teaser (story)', platform: 'Instagram', status: 'scheduled' },
  { day: 'Tue', post: 'Hills yield data carousel', platform: 'LinkedIn', status: 'pending' },
  { day: 'Wed', post: null, platform: null, status: null },
  { day: 'Thu', post: 'Palm payment plan ad', platform: 'Meta Ads', status: 'draft' },
  { day: 'Fri', post: 'UAE market update reel', platform: 'Instagram', status: 'pending' },
  { day: 'Sat', post: null, platform: null, status: null },
  { day: 'Sun', post: 'Hills lead form CTA', platform: 'Meta Ads', status: 'blocked' },
]

const ANGLE_STATUS = {
  approved:        { label: 'Approved',          classes: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' },
  pending_approval:{ label: 'Pending approval',  classes: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20' },
  draft:           { label: 'Draft',             classes: 'bg-white/[0.06] text-white/50 border-white/10' },
}

const PLATFORM_CLASSES: Record<string, string> = {
  'Meta':     'bg-blue-400/10 text-blue-300 border-blue-400/20',
  'Instagram':'bg-pink-400/10 text-pink-300 border-pink-400/20',
  'LinkedIn': 'bg-sky-400/10 text-sky-300 border-sky-400/20',
  'Meta Ads': 'bg-blue-400/10 text-blue-300 border-blue-400/20',
}

const SCHEDULE_STATUS = {
  scheduled: 'text-emerald-300',
  pending:   'text-[#D4AF37]',
  draft:     'text-white/35',
  blocked:   'text-red-300',
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SocialMediaManagerPage() {
  const app = getServerApp('social-media-manager')
  const totalAngles   = ANGLES.flatMap((g) => g.items).length
  const approved      = ANGLES.flatMap((g) => g.items).filter((a) => a.status === 'approved').length
  const pendingCount  = APPROVALS.length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Megaphone className="h-3.5 w-3.5" /> Social Media Manager
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-medium text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Planned
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Campaign angles<br /><span className="text-white/35">{approved}/{totalAngles} approved.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          Campaign copy, social captions, creative angles and publishing schedule. Approval required before any angle runs in a paid channel.
        </p>
      </section>

      {/* Pending approvals */}
      {pendingCount > 0 && (
        <div className="mt-8 rounded-[20px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white">{pendingCount} items waiting for approval</div>
              <div className="mt-3 space-y-2">
                {APPROVALS.map((ap) => (
                  <div key={ap.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-white/85">{ap.title}</div>
                      <div className="mt-0.5 text-[11px] text-white/40">{ap.listing} · submitted by {ap.submittedBy} · {fmt(ap.submittedAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-400/20">Approve</button>
                      <button className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/50 transition hover:bg-white/[0.07]">Request changes</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign angles by listing */}
      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Campaign angles</div>
        <h2 className="mt-2 text-xl font-semibold text-white">By listing</h2>
        <div className="mt-5 space-y-8">
          {ANGLES.map((group) => (
            <div key={group.listing}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/70">{group.area}</div>
                  <h3 className="mt-0.5 text-[16px] font-semibold text-white">{group.listing}</h3>
                </div>
                <Link href={group.listingHref} className="inline-flex items-center gap-1 text-[11px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]">
                  Open workspace <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((angle) => {
                  const st = ANGLE_STATUS[angle.status as keyof typeof ANGLE_STATUS]
                  return (
                    <div key={angle.id} className={`rounded-[18px] border p-5 ${angle.status === 'approved' ? 'border-emerald-400/15 bg-emerald-400/[0.03]' : 'border-white/[0.06] bg-[#0A0D10]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] font-semibold text-white">{angle.title}</div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${PLATFORM_CLASSES[angle.platform] ?? 'border-white/10 text-white/40'}`}>
                          {angle.platform}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] font-medium leading-snug text-white/75">{angle.headline}</p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{angle.hook}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${st.classes}`}>{st.label}</span>
                        {angle.status === 'approved' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly publishing schedule */}
      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Publishing schedule</div>
        <h2 className="mt-2 text-xl font-semibold text-white">This week</h2>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {WEEK.map((day) => (
            <div
              key={day.day}
              className={`min-h-[90px] rounded-[14px] border p-3 ${day.post ? 'border-white/[0.06] bg-[#0A0D10]' : 'border-white/[0.03] bg-transparent'}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">{day.day}</div>
              {day.post && (
                <>
                  <p className="mt-2 text-[10px] leading-snug text-white/65">{day.post}</p>
                  <div className={`mt-2 text-[10px] font-semibold ${day.status ? SCHEDULE_STATUS[day.status] : 'text-white/25'}`}>
                    {day.status}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/35">
          {(['scheduled', 'pending', 'draft', 'blocked'] as const).map((s) => (
            <span key={s} className={`flex items-center gap-1.5 ${SCHEDULE_STATUS[s]}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {s}
            </span>
          ))}
        </div>
      </section>

      {/* AI Take */}
      <section className="mt-10 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="mt-3 text-[15px] leading-[1.65] text-white/80">
          The Dubai Hills yield angle is approved and ready for launch. The Palm angle is one approval away — the scarcity + yield combination is the strongest angle for this market right now. Approve it before the weekend schedule.
        </p>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about campaign angles, captions, approval queue…"
          suggestions={[
            'Which angle should launch first this week?',
            'Write a LinkedIn caption for the Hills yield data.',
            'What Palm angle would perform best with UAE investors?',
          ]}
        />
      </section>

    </div>
  )
}
