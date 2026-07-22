'use client'

/**
 * White-label vendor console — where YOU (the vendor) mint and review access
 * keys, instead of curling the API. Enter the WL_ADMIN_SECRET once; it's held
 * in memory only and sent as the x-wl-admin header on each request. This page
 * is not part of the prospect flow — it self-gates on the secret, so a demo
 * user who stumbles onto it can do nothing without it.
 */

import { useState } from 'react'
import { WHITE_LABEL } from '@/lib/whitelabel/config'

interface WlKey {
  key: string
  label: string
  status: 'active' | 'redeemed' | 'revoked'
  workspaceId: string | null
  expiresAt: string | null
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  active: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  redeemed: 'text-white/50 border-white/15 bg-white/5',
  revoked: 'text-red-300 border-red-400/30 bg-red-400/10',
}

export default function WlAdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [keys, setKeys] = useState<WlKey[]>([])
  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [minted, setMinted] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!WHITE_LABEL) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] p-6 text-center text-white/70">
        The vendor console is only available on a white-label deployment.
      </div>
    )
  }

  const headers = () => ({ 'Content-Type': 'application/json', 'x-wl-admin': secret })

  const load = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/wl/keys', { headers: headers() })
      if (res.status === 401) { setBusy(false); return setError('Wrong secret.') }
      const data = (await res.json()) as { keys: WlKey[] }
      setKeys(data.keys || [])
      setAuthed(true)
    } catch {
      setError('Could not reach the server.')
    }
    setBusy(false)
  }

  const mint = async () => {
    setError('')
    setMinted([])
    setBusy(true)
    try {
      const res = await fetch('/api/wl/keys', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ count, label: label.trim(), expiresAt: expiresAt || null }),
      })
      if (res.status === 401) { setBusy(false); return setError('Wrong secret.') }
      const data = (await res.json()) as { keys: string[] }
      setMinted(data.keys || [])
      setLabel('')
      await load()
    } catch {
      setError('Mint failed.')
    }
    setBusy(false)
  }

  const copy = (text: string) => { navigator.clipboard?.writeText(text).catch(() => {}) }

  return (
    <div className="min-h-screen bg-[#0a1628] px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 inline-flex items-center rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold tracking-widest text-[#D4AF37]">
          WHITE-LABEL VENDOR CONSOLE
        </div>
        <h1 className="text-3xl font-bold">Access keys</h1>
        <p className="mt-2 text-sm text-white/50">Mint keys to hand to prospects. Each key redeems once into a branded workspace.</p>

        {/* Secret gate */}
        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="mb-1 block text-xs font-medium text-white/60">Admin secret</label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="WL_ADMIN_SECRET"
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 font-mono text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>
          <button onClick={load} disabled={busy || !secret} className="rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">
            {authed ? 'Refresh' : 'Unlock'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        {authed ? (
          <>
            {/* Mint */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 text-sm font-semibold">Mint new keys</div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/60">Count</label>
                  <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))}
                    className="w-24 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1 block text-xs font-medium text-white/60">Label (optional)</label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Skyline demo"
                    className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/60">Expires (optional)</label>
                  <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                    className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]" />
                </div>
                <button onClick={mint} disabled={busy} className="rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
                  Mint
                </button>
              </div>

              {minted.length ? (
                <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-3">
                  <div className="mb-2 text-xs font-semibold text-emerald-300">New keys — copy them now:</div>
                  {minted.map((k) => (
                    <button key={k} onClick={() => copy(k)} title="Click to copy"
                      className="mr-2 mb-2 inline-flex rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-sm hover:bg-white/[0.12]">
                      {k}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* List */}
            <div className="mt-8">
              <div className="mb-3 text-sm font-semibold">All keys ({keys.length})</div>
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
                    <tr>
                      <th className="px-4 py-3">Key</th>
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.key} className="border-t border-white/[0.06]">
                        <td className="px-4 py-3">
                          <button onClick={() => copy(k.key)} title="Click to copy" className="font-mono text-white/80 hover:text-white">{k.key}</button>
                        </td>
                        <td className="px-4 py-3 text-white/60">{k.label || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[k.status] || ''}`}>{k.status}</span>
                        </td>
                        <td className="px-4 py-3 text-white/50">{k.createdAt?.slice(0, 10)}</td>
                        <td className="px-4 py-3 text-white/50">{k.expiresAt ? k.expiresAt.slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                    {keys.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-white/40">No keys yet — mint some above.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
