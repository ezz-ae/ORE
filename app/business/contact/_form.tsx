'use client'

/**
 * The vendor's own enquiry form.
 *
 * It posts to the same public lead endpoint the rest of the platform uses, so
 * an enquiry about buying the software lands in a pipeline with an owner and a
 * clock on it rather than in an inbox. Tagged with its own source so these are
 * never confused with a brokerage's property enquiries.
 */

import { useState } from 'react'
import { PRODUCTS } from '@/lib/business/nav'

const INTERESTS = [
  { value: '', label: 'What are you asking about?' },
  ...PRODUCTS.map((p) => ({ value: p.label, label: p.label })),
  { value: 'Dedicated deployment', label: 'A dedicated deployment' },
  { value: 'Something else', label: 'Something else' },
]

const field =
  'w-full rounded-none border border-white/[0.12] bg-[#0C0E11] px-4 py-3 text-[0.9375rem] text-white outline-none transition placeholder:text-[#5C636B] focus:border-[#D4AF37]/60'

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const company = String(data.get('company') ?? '').trim()
    const interest = String(data.get('interest') ?? '').trim()
    const note = String(data.get('message') ?? '').trim()

    if (!name || !phone) {
      setError('A name and a number we can reach you on, please — the rest is optional.')
      return
    }

    setState('sending')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          source: 'entrestate-business',
          interest: interest || 'Entrestate for Business',
          message: [company && `Company: ${company}`, interest && `Asking about: ${interest}`, note]
            .filter(Boolean)
            .join('\n'),
        }),
      })
      if (!res.ok) throw new Error('failed')
      setState('sent')
    } catch {
      setState('idle')
      setError('That did not send. Try again, or write to us directly using the address opposite.')
    }
  }

  if (state === 'sent') {
    return (
      <div className="border border-[#D4AF37]/40 bg-[#0E1013] p-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#D4AF37]">Received</div>
        <p className="mt-4 text-[1.0625rem] leading-[1.65] text-white">
          Thank you — that has reached us.
        </p>
        <p className="mt-3 text-[0.9375rem] leading-[1.7] text-[#9BA1A9]">
          Someone will reply within one working day. If it is urgent, the direct address opposite
          reaches the same people faster than a form ever will.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A9099]">
            Your name
          </label>
          <input id="c-name" name="name" required autoComplete="name" className={field} placeholder="Sara Al Marri" />
        </div>
        <div>
          <label htmlFor="c-company" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A9099]">
            Company
          </label>
          <input id="c-company" name="company" autoComplete="organization" className={field} placeholder="Skyline Properties" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-phone" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A9099]">
            Phone
          </label>
          <input id="c-phone" name="phone" required autoComplete="tel" dir="ltr" className={field} placeholder="+971 50 000 0000" />
        </div>
        <div>
          <label htmlFor="c-email" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A9099]">
            Email
          </label>
          <input id="c-email" name="email" type="email" autoComplete="email" dir="ltr" className={field} placeholder="you@company.ae" />
        </div>
      </div>

      <div>
        <label htmlFor="c-interest" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A9099]">
          Subject
        </label>
        <select id="c-interest" name="interest" className={field} defaultValue="">
          {INTERESTS.map((i) => (
            <option key={i.label} value={i.value} className="bg-[#0C0E11]">
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="c-message" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A9099]">
          Anything useful to know
        </label>
        <textarea
          id="c-message"
          name="message"
          rows={4}
          className={`${field} resize-y`}
          placeholder="How many agents, what you run today, and what is not working about it."
        />
      </div>

      {error ? <p className="text-[0.875rem] text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex items-center gap-2 bg-[#D4AF37] px-6 py-3 text-[0.875rem] font-semibold text-black transition hover:bg-[#E5C351] disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Send'}
        <span aria-hidden>→</span>
      </button>
      <p className="text-[0.8125rem] text-[#6E747C]">
        Your details are used to answer you. They are not sold, and not added to a marketing list.
      </p>
    </form>
  )
}
