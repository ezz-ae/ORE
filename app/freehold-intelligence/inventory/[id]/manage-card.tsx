'use client'

/**
 * THE CARD THAT EXISTS SO NOBODY OPENS THE DATABASE AGAIN.
 *
 * Removing one project from the public site used to require production
 * database credentials and a hand-written DELETE. Everybody without them could
 * remove nothing; anybody with them could remove anything; and no record was
 * kept either way.
 *
 * Two buttons, and the difference between them is the whole design:
 *
 *   · TAKE OFF THE WEBSITE is reversible and is what people almost always
 *     mean. Visitors stop seeing it; every lead, deal and campaign pointing at
 *     it keeps resolving.
 *   · DELETE PERMANENTLY destroys the row, so it is management-only, it is
 *     refused whenever somebody else's record points at the listing, and it
 *     asks for the project name to be typed out first.
 *
 * The counts are fetched and shown BEFORE either button is pressed, so the
 * screen can say what will be in the way instead of only reporting it
 * afterwards. A refusal always names the reversible act as the next step —
 * a dead end is what sent people looking for database access.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Archive, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface Attachments { leads: number; deals: number; campaigns: number; landingPages: number; unknown: boolean }

export function ManageCard({
  slug, name, status, canDestroy,
}: { slug: string; name: string; status: string | null; canDestroy: boolean }) {
  const t = useT()
  const router = useRouter()
  const [attachments, setAttachments] = useState<Attachments | null>(null)
  const [busy, setBusy] = useState<'archive' | 'restore' | 'delete' | null>(null)
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  const archived = status === 'archived' || status === 'might_be_sold_out'

  useEffect(() => {
    let live = true
    fetch(`/api/freehold/inventory/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.attachments) setAttachments(d.attachments) })
      .catch(() => {})
    return () => { live = false }
  }, [slug])

  async function run(mode: 'archive' | 'restore' | 'delete') {
    setBusy(mode); setMessage(null); setRefusal(null)
    try {
      const qs = mode === 'delete' ? '' : `?mode=${mode}`
      const res = await fetch(`/api/freehold/inventory/${encodeURIComponent(slug)}${qs}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { refusal?: string }
      if (!res.ok) { setRefusal(data.refusal ?? 'not_found'); return }
      setMessage(t(mode === 'delete' ? 'inv.manage.deleted'
        : mode === 'archive' ? 'inv.manage.archived' : 'inv.manage.restored'))
      // A deleted listing has no page left to stand on.
      if (mode === 'delete') router.push('/freehold-intelligence/inventory')
      else router.refresh()
    } finally { setBusy(null) }
  }

  const nothingAttached = attachments
    && !attachments.unknown
    && attachments.leads + attachments.deals + attachments.campaigns === 0

  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-sm font-medium text-white">{t('inv.manage.title')}</h3>

      {attachments && (
        <p className="mt-2 text-xs text-slate-400">
          {nothingAttached
            ? t('inv.manage.nothingAttached')
            : t('inv.manage.attached', {
                leads: attachments.leads, deals: attachments.deals, campaigns: attachments.campaigns,
              })}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run(archived ? 'restore' : 'archive')}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-[10px] border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
        >
          {busy === 'archive' || busy === 'restore'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          {t(archived ? 'inv.manage.restore' : 'inv.manage.archive')}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t('inv.manage.archiveHint')}</p>

      {/* The irreversible half, kept visually apart and behind a typed name.
          Only shown to a role that could actually complete it — offering a
          button that always refuses is its own kind of dead end. */}
      {canDestroy && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[11px] leading-relaxed text-slate-500">{t('inv.manage.deleteHint')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('inv.manage.deleteConfirm')}
              className="min-w-[220px] flex-1 rounded-[10px] border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => run('delete')}
              disabled={busy !== null || confirm.trim() !== name.trim()}
              className="inline-flex items-center gap-2 rounded-[10px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
            >
              {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t('inv.manage.delete')}
            </button>
          </div>
        </div>
      )}

      {refusal && (
        <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="min-w-0 text-xs leading-relaxed text-amber-100">
            {t(`inv.manage.refusal.${refusal}`)}
          </p>
        </div>
      )}
      {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
    </div>
  )
}
