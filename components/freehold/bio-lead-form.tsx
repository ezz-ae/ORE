'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'

/** Lead-capture form on an agent's public bio page. Posts to the public,
 *  rate-limited capture endpoint which assigns the lead to that agent. */
export function BioLeadForm({ handle, agentName }: { handle: string; agentName: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError('Please add your name and a phone or email.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/public/agent/${encodeURIComponent(handle)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || 'Could not submit right now.')
        return
      }
      setDone(true)
    } catch {
      setError('Could not submit right now.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-6 py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        <div className="text-base font-semibold text-white">Thank you!</div>
        <p className="text-sm text-slate-300">{agentName} will be in touch shortly.</p>
      </div>
    )
  }

  const input = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40'

  return (
    <div className="space-y-3">
      <input className={input} placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={input} placeholder="Phone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      <input className={input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      <textarea className={`${input} min-h-[84px] resize-none`} placeholder="What are you looking for?" value={message} onChange={(e) => setMessage(e.target.value)} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Request a callback
      </button>
    </div>
  )
}
