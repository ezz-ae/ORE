'use client'

/**
 * Convert — add a file, get the file you need, same name.
 *
 * Two screens' worth of behaviour in one: drop something in, and the only
 * options shown are conversions that will genuinely happen. A PDF offers
 * nothing here and says why, rather than presenting a "PDF to Word" button
 * that returns the same bytes renamed — which is exactly what the reference
 * tool that prompted this did, while reporting success.
 *
 * Everything runs in the browser. The file is never uploaded, which is the
 * point: converting a client's floor plan should not mean posting it to a
 * stranger's website first.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileDown, Loader2, AlertTriangle, ArrowRight, Repeat, CheckCircle2,
} from 'lucide-react'
import { PageHeader, Panel, Button, buttonClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import {
  kindOf, targetsFor, outputName, caveatFor, type FileKind, type TargetFormat,
} from '@/lib/freehold/convert'
import { convertFile } from '@/lib/freehold/convert-run'
import { pickRecorderMime } from '@/lib/freehold/video-export'
import { saveBlob } from '@/lib/freehold/bundle'
import { formatBytes } from '@/lib/freehold/upload-progress'

interface Done { name: string; blob: Blob; from: number }

export default function ConvertPage() {
  const t = useT()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dropping, setDropping] = useState(false)
  const [busy, setBusy] = useState<TargetFormat | null>(null)
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState<Done | null>(null)

  const kind: FileKind = file ? kindOf(file.name, file.type) : 'unknown'
  const sourceExt = (file?.name.split('.').pop() ?? '').toLowerCase()
  const targets = useMemo(() => (file ? targetsFor(kind, sourceExt) : []), [file, kind, sourceExt])
  // Asked once, at render: what this browser can truly record decides whether
  // MP4 or WebM is honestly on offer.
  const recorderExt = useMemo(() => pickRecorderMime()?.ext ?? null, [])

  const pick = useCallback((f: File) => { setFile(f); setDone(null); setPct(0) }, [])

  async function run(format: TargetFormat) {
    if (!file || busy) return
    setBusy(format)
    setPct(0)
    setDone(null)
    try {
      const blob = await convertFile(file, format, (fraction) => setPct(Math.round(fraction * 100)))
      const name = outputName(file.name, format)
      setDone({ name, blob, from: file.size })
      saveBlob(blob, name)
      toast.success(t('conv.done', { name }))
    } catch (err) {
      // The real reason, not "conversion failed" — the user can act on
      // "this browser records WebM, not MP4"; they cannot act on a shrug.
      toast.error(err instanceof Error ? err.message : t('conv.failed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-6">
      <PageHeader
        eyebrow={t('conv.eyebrow')}
        title={t('conv.title')}
        subtitle={t('conv.subtitle')}
      />

      {/* ── The file ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDropping(true) }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => { e.preventDefault(); setDropping(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f) }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dropping ? 'border-gold bg-gold/5' : 'border-line bg-surface-2/30'
        }`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/10 text-gold">
          <Upload className="h-6 w-6" />
        </span>
        {file ? (
          <>
            <p className="max-w-full truncate text-sm font-semibold text-white">{file.name}</p>
            <p className="text-xs text-slate-500">
              {formatBytes(file.size)} · {t(`conv.kind.${kind}`)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-white">{dropping ? t('conv.dropHere') : t('conv.dropTitle')}</p>
            <p className="text-xs text-slate-500">{t('conv.dropHint')}</p>
          </>
        )}
        <button type="button" onClick={() => fileRef.current?.click()} className={buttonClass('primary', 'sm')}>
          {file ? t('conv.chooseAnother') : t('conv.choose')}
        </button>
        <input ref={fileRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
      </div>

      {/* ── What it can become ── */}
      {file && targets.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('conv.convertTo')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {targets.map((target) => {
              const caveat = caveatFor(target.format, recorderExt)
              const blocked = caveat?.blocking === true
              const running = busy === target.format
              return (
                <Panel key={target.format}>
                  <button
                    type="button"
                    onClick={() => void run(target.format)}
                    disabled={blocked || busy !== null}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start transition enabled:hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-[10px] font-bold uppercase text-gold">
                      {target.format}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-100">
                        {sourceExt.toUpperCase()} → {target.format.toUpperCase()}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {/* When it cannot be done, the row says why instead of
                            failing after the click. */}
                        {blocked ? t(caveat.key) : t(target.noteKey)}
                      </span>
                    </span>
                    {running
                      ? <span className="shrink-0 text-xs tabular-nums text-gold">{pct}%</span>
                      : <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 rtl:rotate-180" />}
                  </button>
                  {running && (
                    <div className="h-1 w-full bg-white/[0.06]">
                      <div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </Panel>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Nothing honest to offer ── */}
      {file && targets.length === 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="min-w-0 text-sm">
            <div className="font-medium text-amber-100">{t('conv.noneTitle')}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-200/80">
              {kind === 'pdf' ? t('conv.nonePdf') : t('conv.noneUnknown')}
            </p>
          </div>
        </div>
      )}

      {/* ── The result ── */}
      {done && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-emerald-100">{done.name}</div>
            {/* The real before and after — never a percentage that hides a file
                which grew. */}
            <div className="text-xs text-emerald-200/75">
              {t('conv.sizeChange', { from: formatBytes(done.from), to: formatBytes(done.blob.size) })}
            </div>
          </div>
          <button onClick={() => saveBlob(done.blob, done.name)} className={buttonClass('ghost', 'sm')}>
            <FileDown className="h-3.5 w-3.5" /> {t('conv.saveAgain')}
          </button>
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
        <Repeat className="mt-0.5 h-3 w-3 shrink-0" />
        {t('conv.privacy')}
      </p>
    </div>
  )
}
