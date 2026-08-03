'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileUp, Loader2, Sparkles, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { createListingAndLanding } from '@/lib/freehold/brochure-to-listing'

// Confirm-before-save fields, mirroring what parse-brochure extracts and what
// /api/crm/projects accepts. All strings so the form is trivially editable;
// numeric fields are coerced server-side (toNumber).
type Fields = {
  name: string; slug: string; area: string; developer: string
  priceFrom: string; priceTo: string; roi: string
  handoverDate: string; paymentPlan: string; description: string
}

const FIELD_DEFS: Array<{ key: keyof Fields; labelKey: string; required?: boolean; full?: boolean; area?: boolean }> = [
  { key: 'name', labelKey: 'lm.pdf.f.name', required: true },
  { key: 'slug', labelKey: 'lm.pdf.f.slug', required: true },
  { key: 'area', labelKey: 'lm.pdf.f.area' },
  { key: 'developer', labelKey: 'lm.pdf.f.developer' },
  { key: 'priceFrom', labelKey: 'lm.pdf.f.priceFrom' },
  { key: 'priceTo', labelKey: 'lm.pdf.f.priceTo' },
  { key: 'roi', labelKey: 'lm.pdf.f.roi' },
  { key: 'handoverDate', labelKey: 'lm.pdf.f.handover' },
  { key: 'paymentPlan', labelKey: 'lm.pdf.f.payment', full: true, area: true },
  { key: 'description', labelKey: 'lm.pdf.f.description', full: true, area: true },
]

/**
 * Upload a brochure PDF → parse it → confirm the extracted facts → create a
 * live listing AND its landing page in one flow. Chains three existing,
 * already-compatible endpoints (parse-brochure → crm/projects → landing-pages),
 * with a mandatory confirm step so bad OCR never silently clobbers inventory.
 * Admin-gated (non-broker), matching the landing-pages API.
 */
export function PdfToListing({ onCreated }: { onCreated?: (slug: string) => void }) {
  const t = useT()
  const router = useRouter()
  const { user } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [fields, setFields] = useState<Fields | null>(null)
  const [fileName, setFileName] = useState('')

  if (!user || user.role === 'broker') return null

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error(t('lm.pdf.notPdf')); return }
    // The hosting platform hard-rejects request bodies over ~4.5 MB before our
    // code runs, which surfaced as a mystery "couldn't read" — fail here with
    // the real reason instead.
    if (file.size > 4_300_000) { toast.error(t('lm.pdf.tooLarge')); return }
    setFileName(file.name)
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dashboard/projects/parse-brochure', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error || t('lm.pdf.parseFailed'))
      // The route wraps the extraction as { data: {...} } — reading the flat
      // shape left every field undefined, so even successful parses produced
      // an empty form (the "create listing from brochure does nothing" bug).
      const d = (data.data ?? data) as Record<string, unknown>
      const num = (v: unknown) => (v == null || v === '' ? '' : String(v))
      const str = (v: unknown) => (typeof v === 'string' ? v : '')
      setFields({
        name: str(d.name), slug: str(d.slug), area: str(d.area), developer: str(d.developer),
        priceFrom: num(d.priceFrom), priceTo: num(d.priceTo), roi: num(d.roi),
        handoverDate: str(d.handoverDate), paymentPlan: str(d.paymentPlan), description: str(d.description),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('lm.pdf.parseFailed'))
    } finally {
      setParsing(false)
    }
  }

  async function create() {
    if (!fields) return
    setCreating(true)
    try {
      const res = await createListingAndLanding({ ...fields, name: fields.name.trim() })
      if (!res.ok) {
        toast.error(res.error === 'name-required' ? t('lm.pdf.needName') : t('lm.pdf.listingFailed'))
        return
      }
      toast.success(t('lm.pdf.created', { name: fields.name.trim() }))
      setFields(null)
      onCreated?.(res.slug || '')
      router.refresh() // re-render the server list so the new project/landing appears
    } catch {
      toast.error(t('lm.pdf.listingFailed'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onPick} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
        className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
      >
        {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {parsing ? t('lm.pdf.parsing') : t('lm.pdf.upload')}
      </button>

      {fields && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={() => !creating && setFields(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{t('lm.pdf.confirmTitle')}</h3>
              <button onClick={() => !creating && setFields(null)} aria-label={t('lm.pdf.cancel')} className="text-slate-500 transition hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-400">{t('lm.pdf.confirmSub', { file: fileName })}</p>
            <div className="grid grid-cols-2 gap-3">
              {FIELD_DEFS.map((fd) => (
                <label key={fd.key} className={fd.full ? 'col-span-2' : ''}>
                  <span className="mb-1 block text-[11px] font-medium text-slate-400">
                    {t(fd.labelKey)}{fd.required ? ' *' : ''}
                  </span>
                  {fd.area ? (
                    <textarea
                      value={fields[fd.key]}
                      onChange={(e) => setFields((f) => (f ? { ...f, [fd.key]: e.target.value } : f))}
                      rows={fd.key === 'description' ? 3 : 2}
                      className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
                    />
                  ) : (
                    <input
                      value={fields[fd.key]}
                      onChange={(e) => setFields((f) => (f ? { ...f, [fd.key]: e.target.value } : f))}
                      className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setFields(null)}
                disabled={creating}
                className="rounded-full border border-line px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200 disabled:opacity-60"
              >
                {t('lm.pdf.cancel')}
              </button>
              <button
                onClick={create}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {creating ? t('lm.pdf.creating') : t('lm.pdf.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
