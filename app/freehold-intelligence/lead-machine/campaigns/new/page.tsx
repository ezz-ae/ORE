'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Megaphone,
  DollarSign, Users, FileText, Rocket, AlertCircle, Loader2,
} from 'lucide-react'
import { leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import type { LaunchCampaignPayload, MetaCampaignObjective, MetaCta } from '@/lib/meta/types'

// ─── UAE interest targets ────────────────────────────────────────────────────
const UAE_INTERESTS = [
  { id: '6002714398372', name: 'Real estate investing' },
  { id: '6003105898571', name: 'Property' },
  { id: '6003193636887', name: 'Luxury goods' },
  { id: '6004132891184', name: 'Investment' },
  { id: '6003409935589', name: 'Architecture' },
]

const UAE_CITIES = [
  { key: '297928',   name: 'Dubai' },
  { key: '295424',   name: 'Abu Dhabi' },
  { key: '297999',   name: 'Sharjah' },
  { key: '289274',   name: 'Ajman' },
  { key: '290095',   name: 'Ras Al Khaimah' },
]

// ─── Wizard state ─────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  // Step 1
  listingId:     string
  objective:     MetaCampaignObjective
  campaignName:  string
  // Step 2
  dailyBudgetAED: number
  cityKeys:      string[]
  ageMin:        number
  ageMax:        number
  interestIds:   string[]
  publisherPlatforms: string[]
  // Step 3
  primaryText:   string
  headline:      string
  description:   string
  landingUrl:    string
  cta:           MetaCta
  imageUrl:      string
  // Step 4
  launchStatus:  'ACTIVE' | 'PAUSED'
}

const OBJECTIVES: { value: MetaCampaignObjective; label: string; desc: string }[] = [
  { value: 'LEAD_GENERATION', label: 'Lead generation',  desc: 'Collect leads directly on Facebook/Instagram with a native form.' },
  { value: 'CONVERSIONS',     label: 'Conversions',      desc: 'Drive traffic to your landing page and track pixel conversions.' },
  { value: 'LINK_CLICKS',     label: 'Traffic',          desc: 'Maximise clicks to your landing page. Good for awareness.' },
]

const CTA_OPTIONS: { value: MetaCta; label: string }[] = [
  { value: 'LEARN_MORE',   label: 'Learn More' },
  { value: 'GET_QUOTE',    label: 'Get Quote' },
  { value: 'SIGN_UP',      label: 'Sign Up' },
  { value: 'CONTACT_US',   label: 'Contact Us' },
  { value: 'BOOK_NOW',     label: 'Book Now' },
  { value: 'APPLY_NOW',    label: 'Apply Now' },
]

const STEPS = [
  { n: 1, label: 'Campaign', icon: Megaphone },
  { n: 2, label: 'Targeting', icon: Users },
  { n: 3, label: 'Creative', icon: FileText },
  { n: 4, label: 'Launch', icon: Rocket },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputCls(err?: boolean) {
  return [
    'w-full rounded-[12px] border bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none transition',
    err
      ? 'border-red-400/40 focus:border-red-400'
      : 'border-white/[0.08] focus:border-[#D4AF37]/50',
  ].join(' ')
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-medium text-white/60">{children}</label>
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewCampaignPage() {
  const router = useRouter()
  const [step,    setStep]    = useState<WizardStep>(1)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [launched, setLaunched] = useState<{ campaignId: string; status: string } | null>(null)

  // Seed initial creative from first listing
  const defaultListing = leadMachineListings[0]

  const [form, setForm] = useState<WizardState>({
    listingId:    defaultListing?.id ?? '',
    objective:    'LEAD_GENERATION',
    campaignName: defaultListing ? `${defaultListing.projectName} — Lead Gen` : '',
    dailyBudgetAED: 200,
    cityKeys:     ['297928'], // Dubai
    ageMin:       28,
    ageMax:       65,
    interestIds:  [UAE_INTERESTS[0].id, UAE_INTERESTS[3].id],
    publisherPlatforms: ['facebook', 'instagram'],
    primaryText:  defaultListing
      ? `${defaultListing.projectName} — starting from AED ${defaultListing.startingPrice?.toLocaleString() ?? '—'}. ${defaultListing.paymentPlan ?? ''}`
      : '',
    headline:     defaultListing?.projectName ?? '',
    description:  'Request the investor summary now.',
    landingUrl:   defaultListing
      ? `https://freeholdproperty.ae/off-plan/${defaultListing.projectId}`
      : 'https://freeholdproperty.ae',
    cta:          'LEARN_MORE',
    imageUrl:     defaultListing?.imageUrl ?? '',
    launchStatus: 'PAUSED',
  })

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setApiError(null)
  }

  // ── Listing change pre-populates creative ──────────────────────────────────
  function onListingChange(id: string) {
    const listing = leadMachineListings.find((l) => l.id === id)
    if (!listing) return
    setForm((prev) => ({
      ...prev,
      listingId:    listing.id,
      campaignName: `${listing.projectName} — ${prev.objective === 'LEAD_GENERATION' ? 'Lead Gen' : 'Traffic'}`,
      primaryText:  `${listing.projectName} — starting from AED ${listing.startingPrice?.toLocaleString() ?? '—'}. ${listing.paymentPlan ?? ''}`.trim(),
      headline:     listing.projectName,
      landingUrl:   `https://freeholdproperty.ae/off-plan/${listing.projectId}`,
      imageUrl:     listing.imageUrl,
    }))
  }

  // ── Launch ─────────────────────────────────────────────────────────────────
  async function handleLaunch() {
    setLoading(true)
    setApiError(null)

    const listing = leadMachineListings.find((l) => l.id === form.listingId)
    const interests = UAE_INTERESTS.filter((i) => form.interestIds.includes(i.id))

    const payload: LaunchCampaignPayload = {
      campaignName:   form.campaignName,
      objective:      form.objective,
      listingId:      form.listingId,
      listingName:    listing?.projectName ?? form.campaignName,
      dailyBudgetAED: form.dailyBudgetAED,
      targeting: {
        countries:          ['AE'],
        cityKeys:           form.cityKeys,
        ageMin:             form.ageMin,
        ageMax:             form.ageMax,
        publisherPlatforms: form.publisherPlatforms,
        interests,
      },
      creative: {
        primaryText: form.primaryText,
        headline:    form.headline,
        description: form.description,
        landingUrl:  form.landingUrl,
        cta:         form.cta,
        imageUrl:    form.imageUrl || undefined,
      },
      launchStatus: form.launchStatus,
    }

    try {
      const res = await fetch('/api/meta/launch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error ?? 'Launch failed. Check your Meta credentials and try again.')
        setLoading(false)
        return
      }

      setLaunched({ campaignId: data.campaignId, status: data.status })
    } catch {
      setApiError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (launched) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-32 pt-14 text-center sm:px-6">
        <CheckCircle2 className="mx-auto h-14 w-14 text-[#D4AF37]" />
        <h1 className="mt-6 text-[32px] font-semibold text-white">Campaign created</h1>
        <p className="mt-3 text-[16px] text-white/55">
          {launched.status === 'ACTIVE'
            ? 'Your campaign is now live on Meta and Instagram.'
            : 'Your campaign was created in paused state. Activate it from the campaign dashboard.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/freehold-intelligence/lead-machine/campaigns/${launched.campaignId}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE]"
          >
            Open campaign dashboard
          </Link>
          <Link
            href="/freehold-intelligence/lead-machine/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.07]"
          >
            All campaigns
          </Link>
        </div>
      </div>
    )
  }

  const selectedListing = leadMachineListings.find((l) => l.id === form.listingId)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/lead-machine/campaigns" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
      </Link>

      <div className="mt-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Megaphone className="h-3.5 w-3.5" /> New Meta Campaign
        </div>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-white sm:text-[40px]">
          Launch a campaign
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-0">
        {STEPS.map((s, i) => {
          const active  = step === s.n
          const done    = step > s.n
          const Icon    = s.icon
          return (
            <div key={s.n} className="flex flex-1 items-center">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition ${
                done    ? 'border-emerald-400/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                : active ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#D4AF37]'
                : 'border-white/[0.08] bg-white/[0.04] text-white/30'
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </div>
              <span className={`ml-2 hidden text-[13px] font-medium sm:block ${active ? 'text-white' : done ? 'text-[#D4AF37]/70' : 'text-white/25'}`}>{s.label}</span>
              {i < STEPS.length - 1 && (
                <div className={`mx-3 h-px flex-1 ${done ? 'bg-[#D4AF37]/30' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-10 rounded-[24px] border border-white/[0.08] bg-[#131B2B] p-6 sm:p-8">

        {/* ── Step 1: Campaign ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">Choose listing & objective</h2>

            <div>
              <Label>Listing</Label>
              <select
                className={inputCls()}
                value={form.listingId}
                onChange={(e) => onListingChange(e.target.value)}
              >
                {leadMachineListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.projectName} · {l.area}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Campaign objective</Label>
              <div className="space-y-2">
                {OBJECTIVES.map((obj) => (
                  <button
                    key={obj.value}
                    type="button"
                    onClick={() => update('objective', obj.value)}
                    className={`w-full rounded-[14px] border p-4 text-left transition ${
                      form.objective === obj.value
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.06]'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${form.objective === obj.value ? 'border-[#D4AF37] bg-[#D4AF37]' : 'border-white/25'}`} />
                      <div>
                        <div className="text-[14px] font-semibold text-white">{obj.label}</div>
                        <p className="mt-0.5 text-[12px] text-white/45">{obj.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Campaign name</Label>
              <input
                className={inputCls()}
                value={form.campaignName}
                onChange={(e) => update('campaignName', e.target.value)}
                placeholder="e.g. Palm Jumeirah — Lead Gen Q2"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Targeting ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">Budget & targeting</h2>

            <div>
              <Label>Daily budget (AED) — minimum AED 50</Label>
              <input
                type="number"
                min="50"
                className={inputCls(form.dailyBudgetAED < 50)}
                value={form.dailyBudgetAED}
                onChange={(e) => update('dailyBudgetAED', Math.max(50, parseInt(e.target.value) || 50))}
              />
              <p className="mt-1 text-[13px] text-white/35">≈ AED {(form.dailyBudgetAED * 30).toLocaleString()} / month at this rate</p>
            </div>

            <div>
              <Label>Target cities (UAE)</Label>
              <div className="flex flex-wrap gap-2">
                {UAE_CITIES.map((city) => {
                  const selected = form.cityKeys.includes(city.key)
                  return (
                    <button
                      key={city.key}
                      type="button"
                      onClick={() =>
                        update('cityKeys',
                          selected
                            ? form.cityKeys.filter((k) => k !== city.key)
                            : [...form.cityKeys, city.key],
                        )
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition ${
                        selected
                          ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/15'
                      }`}
                    >
                      {city.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min age</Label>
                <input
                  type="number" min="18" max="65"
                  className={inputCls()}
                  value={form.ageMin}
                  onChange={(e) => update('ageMin', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label>Max age</Label>
                <input
                  type="number" min="18" max="65"
                  className={inputCls()}
                  value={form.ageMax}
                  onChange={(e) => update('ageMax', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>Interests</Label>
              <div className="flex flex-wrap gap-2">
                {UAE_INTERESTS.map((int) => {
                  const selected = form.interestIds.includes(int.id)
                  return (
                    <button
                      key={int.id}
                      type="button"
                      onClick={() =>
                        update('interestIds',
                          selected
                            ? form.interestIds.filter((i) => i !== int.id)
                            : [...form.interestIds, int.id],
                        )
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition ${
                        selected
                          ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/15'
                      }`}
                    >
                      {int.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>Publisher platforms</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'facebook',  label: 'Facebook' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'audience_network', label: 'Audience Network' },
                ].map((p) => {
                  const selected = form.publisherPlatforms.includes(p.value)
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        update('publisherPlatforms',
                          selected
                            ? form.publisherPlatforms.filter((v) => v !== p.value)
                            : [...form.publisherPlatforms, p.value],
                        )
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition ${
                        selected
                          ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/15'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Creative ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-[18px] font-semibold text-white">Ad creative</h2>

            <div>
              <Label>Primary text (shown above the ad)</Label>
              <textarea
                rows={4}
                className={`${inputCls(!form.primaryText)} resize-none`}
                value={form.primaryText}
                onChange={(e) => update('primaryText', e.target.value)}
                placeholder="The investor pitch — 2–3 sentences that lead with the strongest signal."
              />
              <p className="mt-1 text-[13px] text-white/35">{form.primaryText.length}/500 · Aim for under 125 characters for mobile preview.</p>
            </div>

            <div>
              <Label>Headline</Label>
              <input
                className={inputCls(!form.headline)}
                value={form.headline}
                onChange={(e) => update('headline', e.target.value)}
                placeholder="e.g. Palm Jumeirah — AED 3.2M, 5.8% yield"
              />
            </div>

            <div>
              <Label>Description (optional — shown under headline on some placements)</Label>
              <input
                className={inputCls()}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="e.g. Request the investor summary now."
              />
            </div>

            <div>
              <Label>Landing page URL</Label>
              <input
                className={inputCls(!form.landingUrl)}
                value={form.landingUrl}
                onChange={(e) => update('landingUrl', e.target.value)}
                placeholder="https://freeholdproperty.ae/…"
              />
            </div>

            <div>
              <Label>Image URL (optional — leave blank to let Meta use link preview)</Label>
              <input
                className={inputCls()}
                value={form.imageUrl}
                onChange={(e) => update('imageUrl', e.target.value)}
                placeholder="https://cdn.freeholdproperty.ae/images/…"
              />
            </div>

            <div>
              <Label>Call to action</Label>
              <select
                className={inputCls()}
                value={form.cta}
                onChange={(e) => update('cta', e.target.value as MetaCta)}
              >
                {CTA_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Launch ───────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">Review & launch</h2>

            {/* Summary tiles */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Listing',     value: selectedListing?.projectName ?? form.listingId },
                { label: 'Objective',   value: OBJECTIVES.find((o) => o.value === form.objective)?.label ?? form.objective },
                { label: 'Daily budget', value: `AED ${form.dailyBudgetAED.toLocaleString()}` },
                { label: 'Audience',    value: `Ages ${form.ageMin}–${form.ageMax} · UAE` },
                { label: 'Platforms',   value: form.publisherPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ') },
                { label: 'CTA',         value: CTA_OPTIONS.find((c) => c.value === form.cta)?.label ?? form.cta },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">{item.label}</div>
                  <div className="mt-1 text-[14px] font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Creative preview */}
            <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35 mb-3">Creative preview</div>
              <div className="text-[12px] leading-relaxed text-white/60 mb-2">{form.primaryText}</div>
              <div className="text-[14px] font-semibold text-white">{form.headline}</div>
              <div className="text-[12px] text-white/45 mt-0.5">{form.description}</div>
              <div className="mt-2 inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[12px] text-[#D4AF37]">
                {CTA_OPTIONS.find((c) => c.value === form.cta)?.label}
              </div>
            </div>

            {/* Launch mode toggle */}
            <div>
              <Label>Launch mode</Label>
              <div className="flex gap-3">
                {[
                  { value: 'PAUSED', label: 'Create paused', desc: 'Review in Meta Business Manager before going live.' },
                  { value: 'ACTIVE', label: 'Launch now', desc: 'Campaign goes live immediately on Meta and Instagram.' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('launchStatus', opt.value as 'ACTIVE' | 'PAUSED')}
                    className={`flex-1 rounded-[14px] border p-4 text-left transition ${
                      form.launchStatus === opt.value
                        ? opt.value === 'ACTIVE'
                          ? 'border-emerald-400/30 bg-[#D4AF37]/[0.06]'
                          : 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.06]'
                        : 'border-white/[0.08] hover:border-white/10'
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-white">{opt.label}</div>
                    <p className="mt-1 text-[13px] text-white/40">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {apiError && (
              <div className="flex items-start gap-3 rounded-[14px] border border-red-400/20 bg-red-400/[0.05] p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-[13px] text-white/70">{apiError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as WizardStep)}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.07]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            disabled={
              (step === 1 && (!form.listingId || !form.campaignName)) ||
              (step === 2 && form.dailyBudgetAED < 50) ||
              (step === 3 && (!form.primaryText || !form.headline || !form.landingUrl))
            }
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-6 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE] disabled:opacity-60"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Launching…</>
              : <><Rocket className="h-4 w-4" /> {form.launchStatus === 'ACTIVE' ? 'Launch now' : 'Create paused'}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
