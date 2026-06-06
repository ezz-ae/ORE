'use client'

import { useState, useMemo } from 'react'
import { Lock, ShieldAlert, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { currentServerUser, getRoleScope, crmActivityLog } from '@/src/features/freehold-intelligence/server-session'

const HARDENING_CHECKLIST = [
  { label: 'Private shell isolation',       done: true,  note: 'Intelligence routes separated from public routes.' },
  { label: 'Role-aware AI scope',           done: true,  note: 'AI answers filtered by role — out-of-scope queries silently suppressed.' },
  { label: 'MCP tool gating',              done: true,  note: '9 tools registered; execution requires role validation.' },
  { label: 'Audit event logging',           done: true,  note: 'Actor-tagged action log for critical write operations.' },
  { label: 'Production auth middleware',    done: false, note: 'Route protection still requires final NextAuth/JWT wiring.' },
  { label: 'Session expiry + refresh',      done: false, note: 'Not yet enforced in private shell session model.' },
  { label: 'RBAC database enforcement',     done: false, note: 'Role gates active in UI; database-level RBAC not yet live.' },
  { label: 'Rate limiting on AI endpoints', done: false, note: 'No request throttling on AI routes in current V1.' },
]

const ROLE_MATRIX = [
  { role: 'Owner',         canView: true,  canEdit: true,  canApprove: true,  canAdmin: true,  scope: 'All modules' },
  { role: 'Admin',         canView: true,  canEdit: true,  canApprove: true,  canAdmin: true,  scope: 'Operations, users, tasks' },
  { role: 'Marketing',     canView: true,  canEdit: true,  canApprove: false, canAdmin: false, scope: 'Ads, landings, campaigns' },
  { role: 'Sales Manager', canView: true,  canEdit: true,  canApprove: false, canAdmin: false, scope: 'Leads, CRM, team, follow-ups' },
  { role: 'Sales Agent',   canView: true,  canEdit: false, canApprove: false, canAdmin: false, scope: 'Assigned leads only' },
  { role: 'Data Manager',  canView: true,  canEdit: true,  canApprove: false, canAdmin: false, scope: 'Projects, fields, readiness' },
  { role: 'Viewer',        canView: true,  canEdit: false, canApprove: false, canAdmin: false, scope: 'Read-only, approved content' },
]

const scope = getRoleScope(currentServerUser.role)

const allAuditEvents = [...crmActivityLog]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

const allEventTypes = Array.from(new Set(allAuditEvents.map((e) => e.type)))

type ChecklistFilter = 'All' | 'Done' | 'Pending'

function Check({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
    : <EyeOff className="h-4 w-4 text-slate-600" />
}

export default function SecurityPage() {
  const done  = HARDENING_CHECKLIST.filter((i) => i.done).length
  const total = HARDENING_CHECKLIST.length
  const pct   = Math.round((done / total) * 100)

  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('All')
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('All')

  const filteredChecklist = useMemo(() => {
    if (checklistFilter === 'Done')    return HARDENING_CHECKLIST.filter((i) => i.done)
    if (checklistFilter === 'Pending') return HARDENING_CHECKLIST.filter((i) => !i.done)
    return HARDENING_CHECKLIST
  }, [checklistFilter])

  const filteredAudit = useMemo(() => {
    if (auditTypeFilter === 'All') return allAuditEvents.slice(0, 12)
    return allAuditEvents.filter((e) => e.type === auditTypeFilter).slice(0, 12)
  }, [auditTypeFilter])

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/85">
          <Lock className="h-3.5 w-3.5" /> Security
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Access model<br />
          <span className="text-slate-400">and hardening status.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-[1.6] text-slate-300">
          {done} of {total} hardening steps complete. Production auth middleware is the critical remaining item before wider exposure.
        </p>
      </section>

      {/* Progress bar */}
      <section className="mt-10 rounded-[22px] border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Security readiness</div>
          <span className="text-sm font-semibold text-white">{pct}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/60">
          <div
            className={`h-full rounded-full ${pct >= 70 ? 'bg-[#D4AF37]' : pct >= 40 ? 'bg-[#D4AF37]' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-3 w-3 text-[#D4AF37]" /> {done} complete
          <span className="mx-1">·</span>
          <AlertCircle className="h-3 w-3 text-red-400" /> {total - done} pending
        </div>
      </section>

      {/* Hardening checklist */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hardening checklist</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Production readiness</h2>
          </div>
          <div className="flex items-center gap-2">
            {(['All', 'Done', 'Pending'] as ChecklistFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setChecklistFilter(f)}
                className={[
                  'rounded-full border px-3 py-1 text-sm font-medium transition',
                  checklistFilter === f
                    ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {filteredChecklist.map((item) => (
            <div
              key={item.label}
              className={`flex items-start gap-4 rounded-[18px] border p-5 ${
                item.done
                  ? 'border-emerald-400/10 bg-[#D4AF37]/[0.03]'
                  : 'border-red-400/15 bg-red-400/[0.03]'
              }`}
            >
              {item.done
                ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              }
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <p className="mt-0.5 text-xs text-slate-400">{item.note}</p>
              </div>
              <span className={`shrink-0 text-sm font-medium ${item.done ? 'text-[#D4AF37]' : 'text-red-300'}`}>
                {item.done ? 'Done' : 'Pending'}
              </span>
            </div>
          ))}
          {filteredChecklist.length === 0 && (
            <div className="rounded-[18px] border border-slate-800 px-5 py-10 text-center text-sm text-slate-400">
              No items match this filter.
            </div>
          )}
        </div>
      </section>

      {/* Role matrix */}
      <section className="mt-14">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Access model</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Role permission matrix</h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">View</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Edit</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Approve</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {ROLE_MATRIX.map((row) => (
                <tr
                  key={row.role}
                  className={`transition hover:bg-slate-800/30 ${row.role.toLowerCase().replace(' ', '_') === currentServerUser.role ? 'bg-[#D4AF37]/[0.04]' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{row.role}</span>
                      {row.role.toLowerCase().replace(' ', '_') === currentServerUser.role && (
                        <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-xs font-medium text-[#D4AF37]">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center"><div className="flex justify-center"><Check ok={row.canView} /></div></td>
                  <td className="hidden px-4 py-4 text-center sm:table-cell"><div className="flex justify-center"><Check ok={row.canEdit} /></div></td>
                  <td className="hidden px-4 py-4 text-center md:table-cell"><div className="flex justify-center"><Check ok={row.canApprove} /></div></td>
                  <td className="hidden px-4 py-4 text-center lg:table-cell"><div className="flex justify-center"><Check ok={row.canAdmin} /></div></td>
                  <td className="px-6 py-4 text-xs text-slate-400">{row.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Current session scope */}
      <section className="mt-14">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current session</div>
        <h2 className="mt-2 text-xl font-semibold text-white">AI scope — {currentServerUser.role.replace('_', ' ')}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {scope.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-[#D4AF37]/[0.05] px-3.5 py-1.5 text-xs text-[#D4AF37]/80">
              <Eye className="h-3 w-3" /> {s}
            </span>
          ))}
        </div>
      </section>

      {/* Audit log */}
      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit trail</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Recent actor-tagged events</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['All', ...allEventTypes] as string[]).map((t) => (
              <button
                key={t}
                onClick={() => setAuditTypeFilter(t)}
                className={[
                  'rounded-full border px-3 py-1 text-sm font-medium transition',
                  auditTypeFilter === t
                    ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100',
                ].join(' ')}
              >
                {t === 'All' ? 'All' : t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
          {filteredAudit.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">No audit events match this filter.</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filteredAudit.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-100">{event.actor}</span>
                    <span className="text-slate-600"> · </span>
                    <span className="text-[#D4AF37]/75">{event.type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-600"> · </span>
                    <span className="text-slate-400">{event.leadName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="h-3 w-3" />
                    {new Date(event.createdAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  )
}
