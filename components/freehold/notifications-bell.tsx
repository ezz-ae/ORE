'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Row = { id: string; type: string; meta: Record<string, unknown>; href: string | null; read: boolean; created_at: string }

/**
 * The real "today" feed — a bell with an unread badge, opening a bottom sheet
 * (mobile-first) listing this user's notifications. Rows render through i18n
 * from stored type+meta so the feed is trilingual. Opening marks all read.
 */
export function NotificationsBell() {
  const t = useT()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/notifications', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.notifications)) { setRows(d.notifications); setUnread(d.unread ?? 0) } })
      .catch(() => {})
  }, [])

  function openFeed() {
    setOpen(true)
    if (unread > 0) {
      setUnread(0)
      fetch('/api/freehold/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      }).catch(() => {})
    }
  }

  const label = (r: Row) => {
    const name = String(r.meta?.name ?? r.meta?.lead ?? r.meta?.id ?? '')
    if (r.type === 'lead_new') return t('notif.leadNew', { name })
    if (r.type === 'lead_assigned') return t('notif.leadAssigned')
    if (r.type === 'deal_approved') return t('notif.dealApproved')
    return r.type
  }
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <button type="button" onClick={openFeed} aria-label={t('notif.title')}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-slate-300 transition hover:text-white">
        <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-gold px-1 py-0.5 text-[10px] font-bold leading-none text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-white">{t('notif.title')}</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {!rows || rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">{t('notif.empty')}</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {rows.map((r) => {
                  const inner = (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.read ? 'bg-slate-600' : 'bg-gold'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-200">{label(r)}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{when(r.created_at)}</div>
                      </div>
                    </div>
                  )
                  return r.href ? (
                    <Link key={r.id} href={r.href} onClick={() => setOpen(false)} className="block transition hover:bg-white/[0.03]">{inner}</Link>
                  ) : (
                    <div key={r.id}>{inner}</div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
