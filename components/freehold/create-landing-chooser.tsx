'use client'

/**
 * "Create" on the Landing Pages screen — ask what, then go there.
 *
 * What it replaces was broken in two ways at once, and the report was simply
 * "create landing from brochure on this page is not working":
 *
 *   1. The button rendered <PdfToListing /> with NO `onCreated` callback. The
 *      parse ran, the confirm modal created the record — and the page did
 *      nothing. No navigation, no refresh, no sign anything had happened. The
 *      identical failure as "it says landing created but where, I don't see
 *      it", which is why the Inventory chooser already lands you ON the thing
 *      it just made.
 *
 *   2. It created a PROJECT, not a landing page, on a screen called Landing
 *      Pages. Even when it worked, it did not do the thing the button said.
 *
 * So the button now asks what you are making and takes you where that thing
 * lives. A brochure creates the project and then opens its landing page, which
 * is what someone standing on this screen meant in the first place.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, LayoutTemplate, Loader2, Plus, Package, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { PdfToListing } from '@/components/freehold/pdf-to-listing'

const FI = '/freehold-intelligence'

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
      className="flex w-full flex-col items-start gap-2 rounded-2xl border border-line bg-surface-2 p-4 text-start transition hover:border-gold/40 hover:bg-gold/[0.05] disabled:opacity-60"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-gold" /> : <Icon className="h-4 w-4 text-gold" />}
      </span>
      <span className="text-sm font-semibold text-white">{title}</span>
      <span className="text-xs leading-relaxed text-slate-500">{desc}</span>
    </button>
  )
}

export function CreateLandingChooser({
  /** How many projects have no landing page yet — drives the bulk option. */
  missingCount,
  /** The page's existing bulk action, reused rather than reimplemented. */
  onCreateAllMissing,
  creatingAll,
}: {
  missingCount: number
  onCreateAllMissing: () => void
  creatingAll?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-coach="lm-landing-create"
        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-medium text-ink transition hover:bg-gold-bright"
      >
        <Plus className="h-3.5 w-3.5" /> {t('lm.landings.create.btn')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">{t('lm.landings.create.title')}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{t('lm.landings.create.sub')}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t('common.close')}
                className="rounded-lg p-1 text-slate-500 transition hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Brochure — now wired to LAND on the landing page it produced. */}
              <PdfToListing
                onCreated={(slug) => {
                  setOpen(false)
                  if (slug) router.push(`${FI}/inventory/landings/${encodeURIComponent(slug)}/edit`)
                }}
                renderTrigger={(openPicker, parsing) => (
                  <OptionCard
                    Icon={FileUp}
                    title={t('lm.landings.create.brochure')}
                    desc={t('lm.landings.create.brochureDesc')}
                    onClick={openPicker}
                    busy={parsing}
                  />
                )}
              />

              {/* The bulk action that genuinely belongs to this screen. It is
                  offered only when there is something missing — a button that
                  can only ever say "0 created" is worse than no button. */}
              {missingCount > 0 && (
                <OptionCard
                  Icon={LayoutTemplate}
                  title={t('lm.landings.create.allMissing', { n: missingCount })}
                  desc={t('lm.landings.create.allMissingDesc')}
                  onClick={() => { setOpen(false); onCreateAllMissing() }}
                  busy={creatingAll}
                />
              )}

              {/* A landing page belongs to a project, so "start from scratch"
                  honestly means "pick or add the project first". Saying that
                  out loud beats a blank editor with nothing to attach to. */}
              <OptionCard
                Icon={Package}
                title={t('lm.landings.create.fromProject')}
                desc={t('lm.landings.create.fromProjectDesc')}
                onClick={() => { setOpen(false); router.push(`${FI}/inventory/projects`) }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
