'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Sparkles, ArrowLeft, Check, Image, Save } from 'lucide-react'

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Commercial']
const STATUSES = ['Off Plan', 'Ready', 'Under Construction', 'Coming Soon', 'Sold Out']

export default function NewListingPage() {
  const [state, setState] = useState<{ generating: boolean; generated: boolean }>({
    generating: false,
    generated: false,
  })

  function handleGenerate() {
    setState({ generating: true, generated: false })
    setTimeout(() => {
      setState({ generating: false, generated: true })
    }, 1200)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Back + Header */}
      <Link
        href="/freehold-intelligence/ai-manager/listings"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Listings
      </Link>

      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-slate-400/80 mb-3">
        <Sparkles className="h-3.5 w-3.5" />
        AI Manager · New Listing
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Create New Listing
      </h1>

      {/* Step 1 */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-slate-400">1</span>
          <h2 className="text-sm font-semibold text-slate-100">Property Details</h2>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: 'Property Name', placeholder: 'e.g. Emaar Beachfront Tower 3' },
              { label: 'Area', placeholder: 'e.g. Dubai Marina' },
              { label: 'Developer', placeholder: 'e.g. Emaar' },
              { label: 'Starting Price (AED)', placeholder: 'e.g. 1,200,000' },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{field.label}</label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Type</label>
              <select className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-300 focus:border-rose-500/40 focus:outline-none">
                <option value="">Select type…</option>
                {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Status</label>
              <select className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-300 focus:border-rose-500/40 focus:outline-none">
                <option value="">Select status…</option>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Bedrooms</label>
              <input
                type="text"
                placeholder="e.g. 1–3"
                className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500/40 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-slate-400">2</span>
          <h2 className="text-sm font-semibold text-slate-100">AI Generate Content</h2>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 space-y-5">
          <button
            onClick={handleGenerate}
            disabled={state.generating}
            className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
          >
            {state.generating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400/30 border-t-rose-400" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate from Details
              </>
            )}
          </button>

          {state.generated && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 text-xs text-[#D4AF37]">
                <Check className="h-3.5 w-3.5" />
                Content generated successfully
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Description</label>
                <textarea
                  rows={5}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-3 text-sm text-slate-100 focus:border-rose-500/40 focus:outline-none resize-none"
                  defaultValue="Discover an exceptional collection of residences offering unrivalled views across the Dubai skyline. This landmark development blends sophisticated architecture with resort-style amenities, positioned in one of the emirate's most sought-after waterfront locations. Residents enjoy access to private beach, infinity pools, and direct marina access — setting a new benchmark for luxury living in Dubai."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Key Features</label>
                <textarea
                  rows={4}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-3 text-sm text-slate-100 focus:border-rose-500/40 focus:outline-none resize-none"
                  defaultValue="- Direct waterfront access and private beach&#10;- Panoramic views of the Arabian Gulf&#10;- World-class amenities including infinity pool and spa&#10;- Flexible payment plans with post-handover options&#10;- Golden Visa eligibility from AED 2M+"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  SEO Meta Description
                  <span className="ml-1 text-slate-500">(160 char limit)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={160}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-3 text-sm text-slate-100 focus:border-rose-500/40 focus:outline-none resize-none"
                  defaultValue="Luxury waterfront residences in Dubai — stunning views, world-class amenities &amp; flexible payment plans. Golden Visa eligible. Enquire now."
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Step 3 */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-slate-400">3</span>
          <h2 className="text-sm font-semibold text-slate-100">Images &amp; Media</h2>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-slate-800/40 py-10 gap-3">
            <Image className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">Drag and drop images here, or click to upload</p>
            <button className="rounded-lg border border-white/[0.10] bg-slate-800/40 px-4 py-2 text-xs text-slate-400 hover:text-slate-100 transition">
              Choose Files
            </button>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Image Count</label>
            <input
              type="number"
              placeholder="0"
              className="w-28 rounded-xl border border-slate-800 bg-slate-800/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500/40 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-slate-800/40 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white">
          <Save className="h-4 w-4" />
          Save as Draft
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-500/80">
          <Check className="h-4 w-4" />
          Publish
        </button>
      </div>

    </div>
  )
}
