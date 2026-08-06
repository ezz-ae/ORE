'use client'

/**
 * Teams — the org chart the fairness rules read.
 *
 * Why this screen had to exist. `team_leader` shipped as a complete role: the
 * proxy admits it, the guards honour it, the reassignment rules compute against
 * it, and a leader's reach is defined as "the people on their team". But
 * nothing in the product could CREATE a team. `teamMemberIds()` therefore
 * returned empty for every real account, so a leader saw only themselves and
 * the whole role did nothing. The API existed; the door did not.
 *
 * Membership itself is set per person on their Profile tab (team + reports to),
 * because that is where the rest of someone's record lives. This screen owns
 * the two things that are about the TEAM: what it is called, and who leads it.
 *
 * Management writes; a leader reads. That is "anyone else is account with
 * limitations" applied consistently — a leader runs the work, they do not
 * decide who reports to whom.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { UsersRound, Plus, Crown, AlertTriangle, Pencil, Trash2, ArrowRight } from 'lucide-react'
import {
  PageHeader, Panel, EmptyState, Button, Modal, buttonClass, fieldClass,
} from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { MGMT_ROLES } from '@/lib/freehold/apps'
import { load, ROLE_CHIP, type Member } from '../_lib'

interface TeamRow {
  id: string
  name: string
  leaderUserId: string | null
  leaderName: string | null
  memberCount: number
}

export default function TeamsPage() {
  const t = useT()
  const { user } = useSession()
  const canManage = !!user && (MGMT_ROLES as string[]).includes(user.role)

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  // Read failures are named, never rendered as "no teams" — an empty list and a
  // broken list mean opposite things to whoever is looking.
  const [errs, setErrs] = useState<Partial<Record<'teams' | 'members', string>>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TeamRow | null>(null)
  const [confirmDisband, setConfirmDisband] = useState<TeamRow | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [teamRes, memberRes] = await Promise.all([
      load<{ teams: TeamRow[] }>('/api/freehold/team/teams'),
      load<{ members: Member[] }>('/api/freehold/team'),
    ])
    const e: typeof errs = {}
    if (teamRes.ok) setTeams(teamRes.data.teams ?? []); else e.teams = teamRes.error
    if (memberRes.ok) setMembers(memberRes.data.members ?? []); else e.members = memberRes.error
    setErrs(e)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Only a team_leader can lead. Offering every role here would let you build an
  // org chart the authority rules will not honour — decideReassign checks the
  // ROLE, so a "leader" who is a broker is a promise the system then breaks.
  const eligibleLeaders = useMemo(
    () => members.filter((m) => m.dbRole === 'team_leader'),
    [members],
  )

  async function send(method: 'POST' | 'PATCH', body: unknown, okMsg: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/team/teams', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `${res.status}`)
      toast.success(okMsg)
      setCreateOpen(false); setEditing(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('teams.failed'))
    } finally { setBusy(false) }
  }

  async function disband(team: TeamRow) {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/team/teams?teamId=${encodeURIComponent(team.id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `${res.status}`)
      toast.success(t('teams.disbanded', { name: team.name }))
      setConfirmDisband(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('teams.failed'))
    } finally { setBusy(false) }
  }

  const noLeaderYet = eligibleLeaders.length === 0

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
      <PageHeader
        eyebrow={t('teams.eyebrow')}
        title={t('teams.title')}
        subtitle={t('teams.subtitle')}
        actions={canManage ? (
          <Button onClick={() => setCreateOpen(true)} disabled={loading}>
            <Plus className="h-4 w-4" /> {t('teams.create')}
          </Button>
        ) : undefined}
      />

      {/* A team without an eligible leader is the one dead end worth calling out
          up front, because the fix is on a different screen. */}
      {!loading && noLeaderYet && canManage && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="min-w-0 text-sm">
            <div className="font-medium text-amber-100">{t('teams.noLeadersTitle')}</div>
            <p className="mt-0.5 text-xs text-amber-200/80">{t('teams.noLeadersBody')}</p>
            <Link
              href="/freehold-intelligence/settings/team"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-200 underline-offset-2 hover:underline"
            >
              {t('teams.noLeadersCta')} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      {errs.teams && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-red-100">{t('teams.loadFailed')}</div>
            <div className="truncate text-xs text-red-200/80">{errs.teams}</div>
          </div>
          <button onClick={() => void refresh()} className={`${buttonClass('ghost', 'sm')} ms-auto shrink-0`}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
        </div>
      ) : teams.length === 0 && !errs.teams ? (
        <EmptyState
          Icon={UsersRound}
          title={t('teams.emptyTitle')}
          description={t('teams.emptyBody')}
          action={canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('teams.create')}
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <Panel key={team.id}>
              <div className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-400/25 bg-teal-400/10">
                  <UsersRound className="h-4 w-4 text-teal-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{team.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    {team.leaderName ? (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${ROLE_CHIP.team_leader}`}>
                        <Crown className="h-3 w-3" /> {team.leaderName}
                      </span>
                    ) : (
                      // Stated plainly. A team with no leader is not broken, but
                      // it grants nobody any authority, and that should not be
                      // something you have to work out.
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-amber-200">
                        <AlertTriangle className="h-3 w-3" /> {t('teams.noLeader')}
                      </span>
                    )}
                    <span className="text-slate-500">
                      {team.memberCount === 1 ? t('teams.memberOne') : t('teams.memberN', { n: team.memberCount })}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setEditing(team)}
                      className={buttonClass('ghost', 'sm')}
                      aria-label={t('teams.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('teams.edit')}</span>
                    </button>
                    <button
                      onClick={() => setConfirmDisband(team)}
                      className={`${buttonClass('ghost', 'sm')} text-red-300 hover:text-red-200`}
                      aria-label={t('teams.disband')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Where membership is actually changed — said once, in the place
                  someone will look for it. */}
              {canManage && team.memberCount === 0 && (
                <div className="border-t border-line px-4 py-2.5 text-xs text-slate-500">
                  {t('teams.howToAdd')}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {/* ── Create ── */}
      <TeamForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('teams.create')}
        submitLabel={t('teams.create')}
        busy={busy}
        leaders={eligibleLeaders}
        initial={{ name: '', leaderUserId: '' }}
        onSubmit={(v) => send('POST', { name: v.name, leaderUserId: v.leaderUserId || null }, t('teams.created', { name: v.name }))}
        t={t}
      />

      {/* ── Edit ── */}
      <TeamForm
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('teams.edit')}
        submitLabel={t('common.save')}
        busy={busy}
        leaders={eligibleLeaders}
        initial={{ name: editing?.name ?? '', leaderUserId: editing?.leaderUserId ?? '' }}
        onSubmit={(v) => send('PATCH', { teamId: editing?.id, name: v.name, leaderUserId: v.leaderUserId || null }, t('teams.saved'))}
        t={t}
      />

      {/* ── Disband ── */}
      <Modal
        open={!!confirmDisband}
        onClose={() => setConfirmDisband(null)}
        title={t('teams.disbandTitle', { name: confirmDisband?.name ?? '' })}
      >
        <p className="text-sm text-slate-300">{t('teams.disbandBody')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setConfirmDisband(null)} className={buttonClass('ghost')}>
            {t('common.cancel')}
          </button>
          <button
            onClick={() => confirmDisband && void disband(confirmDisband)}
            disabled={busy}
            className={`${buttonClass('primary')} !bg-red-500/90 hover:!bg-red-500`}
          >
            {t('teams.disband')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

/** Create and edit are the same two fields; one component, used twice. */
function TeamForm({
  open, onClose, title, submitLabel, busy, leaders, initial, onSubmit, t,
}: {
  open: boolean
  onClose: () => void
  title: string
  submitLabel: string
  busy: boolean
  leaders: Member[]
  initial: { name: string; leaderUserId: string }
  onSubmit: (v: { name: string; leaderUserId: string }) => void
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  const [name, setName] = useState(initial.name)
  const [leaderUserId, setLeaderUserId] = useState(initial.leaderUserId)

  // Re-seed whenever the dialog opens on a different team.
  useEffect(() => {
    if (open) { setName(initial.name); setLeaderUserId(initial.leaderUserId) }
  }, [open, initial.name, initial.leaderUserId])

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit({ name: name.trim(), leaderUserId }) }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('teams.field.name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('teams.field.namePlaceholder')}
            className={fieldClass()}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('teams.field.leader')}</label>
          <select value={leaderUserId} onChange={(e) => setLeaderUserId(e.target.value)} className={fieldClass()}>
            <option value="">{t('teams.field.noLeader')}</option>
            {leaders.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {leaders.length === 0 ? t('teams.field.leaderNone') : t('teams.field.leaderHint')}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={buttonClass('ghost')}>{t('common.cancel')}</button>
          <button type="submit" disabled={busy || !name.trim()} className={buttonClass('primary')}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
