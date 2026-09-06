'use client'

/**
 * THE CONTROL PLANE: CREATE AN ACCOUNT, DESIGN IT, GO.
 *
 * Everything behind this existed — `saas_tenants`, a schema created per
 * tenant, trial dates, brand fields — and there was no screen. Provisioning a
 * customer meant curling an endpoint with a secret header, and changing one
 * meant editing a production table by hand. That is how control planes get
 * damaged: not by a bad design, by a person in a hurry with psql open.
 *
 * ── THE PREVIEW IS THE POINT ─────────────────────────────────────────────
 *
 * The accent drives every gold token in the product. Choosing it from a hex
 * field and finding out after provisioning is a slow, expensive loop, so the
 * swatch and the button here are painted with the value as it is typed. It is
 * not a mock — it is the same colour the tenant will get.
 *
 * ── WHAT CANNOT BE EDITED, AND WHY ───────────────────────────────────────
 *
 * The subdomain. It is the tenant's address and the name of the schema
 * holding their data; changing it here would orphan everything they own while
 * the row still looked healthy. It is shown, never editable, and the server
 * refuses it too.
 */

import { useCallback, useEffect, useState } from 'react'
import { SUBDOMAIN_RE, RESERVED_SUBDOMAINS } from '@/lib/tenancy/reserved'
import { WL_DEFAULT_ACCENT } from '@/lib/whitelabel/config'

export interface SaasTenantRow {
  id: string
  subdomain: string
  schemaName: string
  company: string
  product: string
  accent: string
  logo: string
  status: 'trial' | 'active' | 'suspended'
  trialEndsAt: string | null
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  trial: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  active: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  suspended: 'text-red-300 border-red-400/30 bg-red-400/10',
}

/** Days left on a trial. Null when there is no trial date — which is not the
 *  same as zero, and must not render as "0 days left". */
export function trialDaysLeft(trialEndsAt: string | null, nowMs: number): number | null {
  if (!trialEndsAt) return null
  const t = Date.parse(trialEndsAt)
  if (!Number.isFinite(t)) return null
  return Math.ceil((t - nowMs) / 86_400_000)
}

/**
 * Valid and not reserved — checked with THE SERVER'S OWN RULE.
 *
 * The first version of this carried its own regex, which is how a client says
 * yes and the server says no: two copies of one rule, drifting. SUBDOMAIN_RE
 * and RESERVED_SUBDOMAINS are imported so the answer here is the answer the
 * claim will get, and the error arrives while somebody is typing rather than
 * after a round trip — which matters because the address cannot be changed
 * once the tenant exists.
 */
export const subdomainLooksValid = (s: string): boolean =>
  SUBDOMAIN_RE.test(s) && !RESERVED_SUBDOMAINS.has(s)

const field = 'w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30'

export default function TenantConsole({ headers }: { headers: () => Record<string, string> }) {
  const [tenants, setTenants] = useState<SaasTenantRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const [subdomain, setSubdomain] = useState('')
  const [company, setCompany] = useState('')
  const [product, setProduct] = useState('')
  // The neutral default, not a client's colour. A new account that opens
  // pre-filled with somebody else's gold is the opposite of brandless, and
  // the operator has to notice and change it every single time.
  const [accent, setAccent] = useState(WL_DEFAULT_ACCENT)
  const [logo, setLogo] = useState('')

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<SaasTenantRow>>({})

  useEffect(() => { setNow(Date.now()) }, [tenants])

  const load = useCallback(async () => {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/wl/tenants', { headers: headers() })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Could not load tenants')
      setTenants(body.tenants ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tenants')
    } finally { setBusy(false) }
  }, [headers])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/wl/tenants', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ subdomain, company, product, accent, logo }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Could not create')
      setSubdomain(''); setCompany(''); setProduct(''); setLogo('')
      // Provisioning is idempotent and non-fatal, so a tenant can exist with
      // its schema unfilled. Saying so beats a green tick that is not true.
      if (body.provisioned === false) {
        setError('Created, but the schema was not fully provisioned — open it once to finish, or re-run.')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create')
    } finally { setBusy(false) }
  }

  const save = async (sub: string) => {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/wl/tenants', {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ subdomain: sub, ...draft }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Could not save')
      setEditing(null); setDraft({})
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally { setBusy(false) }
  }

  const nameOk = company.trim().length > 0
  const subOk = subdomainLooksValid(subdomain)

  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/50">Accounts</h2>

      {/* ── Create ── */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/40">Subdomain</label>
            <input className={field} value={subdomain} placeholder="acme"
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())} />
            {/* Said while they type. The address cannot be changed afterwards,
                so a typo here is a tenant that has to be recreated. */}
            {subdomain && !subOk && (
              <p className="mt-1 text-[11px] text-red-300">
                Letters, numbers and hyphens only — and it cannot be changed later.
              </p>
            )}
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/40">Company</label>
            <input className={field} value={company} placeholder="Acme Properties"
              onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/40">Product word</label>
            <input className={field} value={product} placeholder="Intelligence"
              onChange={(e) => setProduct(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/40">Logo URL</label>
            <input className={field} value={logo} placeholder="https://…"
              onChange={(e) => setLogo(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] uppercase tracking-wide text-white/40">Accent</label>
            <div className="mt-1 flex items-center gap-3">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-white/15 bg-transparent" />
              <input className={field} value={accent} onChange={(e) => setAccent(e.target.value)} />
              {/* THE SAME COLOUR THE TENANT GETS, not an approximation — it
                  drives every gold token in their product. */}
              <button type="button" style={{ background: accent }}
                className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-black/80">
                Preview
              </button>
            </div>
          </div>
        </div>

        <button onClick={create} disabled={busy || !subOk || !nameOk}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">
          {busy ? 'Working…' : 'Create account'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {/* ── The accounts ── */}
      <div className="mt-6 space-y-3">
        {tenants.length === 0 && !busy && (
          <p className="text-sm text-white/40">No accounts yet.</p>
        )}
        {tenants.map((t) => {
          const days = trialDaysLeft(t.trialEndsAt, now)
          const isEditing = editing === t.subdomain
          return (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full border border-white/20"
                  style={{ background: t.accent }} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {t.company} <span className="text-white/40">{t.product}</span>
                  </div>
                  <div className="truncate text-xs text-white/40">{t.subdomain}</div>
                </div>
                <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLE[t.status]}`}>
                  {t.status}
                </span>
                {/* Null is not zero. A tenant with no trial date has no
                    countdown, and rendering "0 days left" would read as
                    expiring today. */}
                {days !== null && (
                  <span className="text-[11px] text-white/40">
                    {days > 0 ? `${days}d left` : 'trial ended'}
                  </span>
                )}
                <button onClick={() => { setEditing(isEditing ? null : t.subdomain); setDraft({}) }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70">
                  {isEditing ? 'Cancel' : 'Design'}
                </button>
              </div>

              {isEditing && (
                <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                  <input className={field} defaultValue={t.company} placeholder="Company"
                    onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))} />
                  <input className={field} defaultValue={t.product} placeholder="Product word"
                    onChange={(e) => setDraft((d) => ({ ...d, product: e.target.value }))} />
                  <input className={field} defaultValue={t.logo} placeholder="Logo URL"
                    onChange={(e) => setDraft((d) => ({ ...d, logo: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <input type="color" defaultValue={t.accent}
                      onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
                      className="h-9 w-12 cursor-pointer rounded border border-white/15 bg-transparent" />
                    <select className={field} defaultValue={t.status}
                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as SaasTenantRow['status'] }))}>
                      <option value="trial">trial</option>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </div>
                  {/* The address is shown and never editable — it names the
                      schema holding their data. */}
                  <p className="text-[11px] text-white/30 sm:col-span-2">
                    {t.subdomain} · schema {t.schemaName} — the address cannot be changed.
                  </p>
                  <button onClick={() => save(t.subdomain)} disabled={busy}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40 sm:col-span-2">
                    Save
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
