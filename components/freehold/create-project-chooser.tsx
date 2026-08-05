'use client'

// The ONE "Create new" entry point on the Inventory list: a chooser popup with
// four sources — brochure PDF, a link, pasted text, or a blank form. Brochure
// reuses the whole PdfToListing flow; link/text go through the parse-source
// API and land in the SAME confirm-fields modal, so every source is reviewed
// by a human before it touches inventory.

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlignLeft, ArrowLeft, FileUp, Link2, Loader2, Plus, Sparkles, SquarePen, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { ConfirmListingModal, PdfToListing, toListingFields, type ListingFields } from '@/components/freehold/pdf-to-listing'

type Mode = 'menu' | 'link' | 'text'

function OptionCard({
  Icon, title, desc, onClick, busy,
}: {
  Icon: typeof FileUp
  title: string
  desc: string
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface-2 p-4 text-start transition hover:border-gold/40 hover:bg-gold/[0.05] disabled:opacity-60"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-gold" /> : <Icon className="h-4 w-4 text-gold" />}
      </span>
      <span className="text-sm font-semibold text-white">{title}</span>
      <span className="text-xs leading-relaxed text-slate-500">{desc}</span>
    </button>
  )
}

export function CreateProjectChooser() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [fields, setFields] = useState<ListingFields | null>(null)
  const [confirmSubtitle, setConfirmSubtitle] = useState('')

  function close() {
    if (parsing) return
    setOpen(false)
    setMode('menu')
  }

  // Link + text share the parse-source route — the non-PDF half of the flow.
  async function parseSource(body: { url: string } | { text: string }) {
    setParsing(true)
    try {
      const res = await fetch('/api/dashboard/projects/parse-source', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.data) throw new Error(data?.error || t('inv.create.parseFailed'))
      setFields(toListingFields(data.data as Record<string, unknown>))
      if ('url' in body) {
        let host = body.url
        try { host = new URL(body.url).hostname } catch { /* keep raw */ }
        setConfirmSubtitle(t('inv.create.confirmFromLink', { host }))
      } else {
        setConfirmSubtitle(t('inv.create.confirmFromText'))
      }
      setOpen(false)
      setMode('menu')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('inv.create.parseFailed'))
    } finally {
      setParsing(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-gold/50'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2 text-sm font-medium text-gold transition hover:bg-gold/20"
      >
        <Plus className="h-3.5 w-3.5" /> {t('inv.create.btn')}
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[15px] font-semibold text-white">{t('inv.create.title')}</div>
              <button type="button" onClick={close} aria-label={t('lm.pdf.cancel')} className="text-slate-500 transition hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('inv.create.sub')}</p>

            {mode === 'menu' && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* From brochure — the entire existing pick → parse → confirm
                    flow, triggered from this card. */}
                <PdfToListing
                  onCreated={() => setOpen(false)}
                  renderTrigger={(openPick, pdfParsing) => (
                    <OptionCard Icon={FileUp} title={t('inv.create.brochure')} desc={t('inv.create.brochure.desc')} onClick={openPick} busy={pdfParsing} />
                  )}
                />
                <OptionCard Icon={Link2} title={t('inv.create.link')} desc={t('inv.create.link.desc')} onClick={() => setMode('link')} />
                <OptionCard Icon={AlignLeft} title={t('inv.create.text')} desc={t('inv.create.text.desc')} onClick={() => setMode('text')} />
                <Link
                  href="/freehold-intelligence/inventory/new"
                  className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface-2 p-4 text-start transition hover:border-gold/40 hover:bg-gold/[0.05]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
                    <SquarePen className="h-4 w-4 text-gold" />
                  </span>
                  <span className="text-sm font-semibold text-white">{t('inv.create.blank')}</span>
                  <span className="text-xs leading-relaxed text-slate-500">{t('inv.create.blank.desc')}</span>
                </Link>
              </div>
            )}

            {(mode === 'link' || mode === 'text') && (
              <div className="mt-4">
                <button type="button" onClick={() => setMode('menu')} disabled={parsing} className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white disabled:opacity-60">
                  <ArrowLeft className="h-3.5 w-3.5" /> {t('inv.create.back')}
                </button>
                {mode === 'link' ? (
                  <>
                    <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('inv.create.urlLabel')}</label>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={t('inv.create.urlPh')}
                      type="url"
                      inputMode="url"
                      className={`${inputCls} mt-1`}
                    />
                  </>
                ) : (
                  <>
                    <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('inv.create.textLabel')}</label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={t('inv.create.textPh')}
                      rows={8}
                      className={`${inputCls} mt-1 resize-none`}
                    />
                  </>
                )}
                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => (mode === 'link' ? parseSource({ url: url.trim() }) : parseSource({ text: text.trim() }))}
                    disabled={parsing || (mode === 'link' ? !url.trim() : !text.trim())}
                    className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                  >
                    {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {parsing ? t('inv.create.parsing') : t('inv.create.parse')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link/text land in the SAME confirm-fields modal the brochure flow uses. */}
      {fields && (
        <ConfirmListingModal
          initialFields={fields}
          subtitle={confirmSubtitle}
          onClose={() => setFields(null)}
        />
      )}
    </>
  )
}
