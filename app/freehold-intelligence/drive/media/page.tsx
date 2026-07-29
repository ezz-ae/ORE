'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ImageIcon, FileText, Video, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// Media Editor — the room's three editors as standalone apps. Image editor and
// Brochure editor start something new on click (a blank canvas / a brochure doc)
// and open their editor; the Video editor opens your library to pick a clip.
export default function MediaEditorPage() {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'image' | 'brochure'>(null)

  // A blank canvas at the square preset → the image editor (sizing/colors/text).
  async function newImage() {
    if (busy) return
    setBusy('image')
    try {
      const c = document.createElement('canvas')
      c.width = 1080; c.height = 1080
      const ctx = c.getContext('2d')
      if (ctx) { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, c.width, c.height) }
      const dataUrl = c.toDataURL('image/png')
      const res = await fetch('/api/freehold/drive/save-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t('med.newImage'), dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.item?.id) { toast.error(t('med.failed')); return }
      router.push(`/freehold-intelligence/drive/editor/image/${d.item.id}`)
    } catch { toast.error(t('med.failed')) } finally { setBusy(null) }
  }

  // A blank document → the doc editor (which offers a brochure template).
  async function newBrochure() {
    if (busy) return
    setBusy('brochure')
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'note', title: t('med.newBrochure'), content: '' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.item?.id) { toast.error(t('med.failed')); return }
      router.push(`/freehold-intelligence/drive/editor/doc/${d.item.id}`)
    } catch { toast.error(t('med.failed')) } finally { setBusy(null) }
  }

  const Card = ({ onClick, href, Icon, accent, appKey, loading }: {
    onClick?: () => void; href?: string; Icon: React.ElementType; accent: string; appKey: string; loading?: boolean
  }) => {
    const inner = (
      <>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${accent}`}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
            {t(`med.app.${appKey}.title`)}
            <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-slate-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:-scale-x-100" />
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-slate-500">{t(`med.app.${appKey}.desc`)}</span>
        </span>
      </>
    )
    const cls = 'group flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-3 text-left transition hover:border-line-strong hover:bg-surface-2'
    return href
      ? <Link href={href} className={cls}>{inner}</Link>
      : <button type="button" onClick={onClick} disabled={!!busy} className={`${cls} disabled:opacity-60`}>{inner}</button>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/drive" className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t('drive.rooms.title')}
      </Link>
      <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('med.title')}</h1>
      <p className="mb-5 mt-0.5 text-xs text-slate-500">{t('med.subtitle')}</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card onClick={newImage} Icon={ImageIcon} accent="text-violet-300 border-violet-400/25 bg-violet-400/[0.06]" appKey="image" loading={busy === 'image'} />
        <Card onClick={newBrochure} Icon={FileText} accent="text-gold border-gold/25 bg-gold/[0.06]" appKey="brochure" loading={busy === 'brochure'} />
        <Card href="/freehold-intelligence/drive/editor/video/new" Icon={Video} accent="text-teal-300 border-teal-400/25 bg-teal-400/[0.06]" appKey="video" />
      </div>
    </div>
  )
}
