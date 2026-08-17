'use client'

/**
 * THE CAMPAIGNS NOBODY IS BEING BILLED FOR.
 *
 * The settlement job charges a campaign only when a wallet is attached to it,
 * and that attachment is written by our launch route. Everything built by hand
 * in Ads Manager has none — on this account, 8 campaigns and AED 39,332 of
 * delivered spend that no balance ever reflected and the funding brake could
 * never act on.
 *
 * ── THE THING THIS SCREEN HAS TO GET RIGHT ───────────────────────────────
 *
 * Billing is a high-water mark, so attaching a wallet to a campaign with a
 * history is one dropdown away from taking thousands out of a broker's wallet
 * on the next hourly run — for spend that happened before anybody decided they
 * were paying for it.
 *
 * So the safe option is the default and the dangerous one states its price in
 * dirhams, in the option itself, before it is chosen. Not in a tooltip and not
 * in a confirmation afterwards: at the moment of choosing, in the words being
 * chosen between.
 */
import { useEffect, useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { Panel, PanelHeader, Button, fieldClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { cashText } from '@/lib/freehold/credits-shared'
import type { BillingStart } from '@/lib/freehold/campaign-attribution'

interface Row {
  campaignId: string
  name: string
  status: string
  spendAed: number
  chargeIfFromBeginning: number
}

export function AttributionPanel({ onNote }: {
  onNote: (n: { tone: 'ok' | 'bad'; text: string }) => void
}) {
  const t = useT()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [totalAed, setTotalAed] = useState(0)
  const [broker, setBroker] = useState<Record<string, string>>({})
  const [start, setStart] = useState<Record<string, BillingStart>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    fetch('/api/freehold/ads/attribution')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setRows(d.campaigns ?? [])
        setTotalAed(Number(d.unattributedAed ?? 0))
      })
      .catch(() => setRows([]))
  }
  useEffect(load, [])

  async function attach(row: Row) {
    const brokerId = (broker[row.campaignId] ?? '').trim()
    if (!brokerId) return
    setBusy(row.campaignId)
    try {
      const res = await fetch('/api/freehold/ads/attribution', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignId: row.campaignId, brokerId,
          start: start[row.campaignId] ?? 'now',
        }),
      })
      const d = (await res.json().catch(() => ({}))) as { refusal?: string; chargeOnNextRun?: number }
      if (!res.ok) {
        onNote({ tone: 'bad', text: t(`attr.refusal.${d.refusal ?? 'no_such_campaign'}`) })
        return
      }
      onNote({ tone: 'ok', text: t('attr.attached', {
        name: row.name,
        charge: cashText(Number(d.chargeOnNextRun ?? 0)),
      }) })
      load()
    } finally { setBusy(null) }
  }

  // Nothing unattributed is the goal state, not an empty screen — say so.
  if (rows && rows.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t('attr.title')} icon={<Wallet className="h-4 w-4" />} />
        <p className="p-5 text-sm text-slate-500">{t('attr.allAttached')}</p>
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader title={t('attr.title')} icon={<Wallet className="h-4 w-4" />} />
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-400">{t('attr.sub')}</p>
        {rows && (
          <p className="text-sm text-amber-300">
            {t('attr.total', { n: rows.length, aed: cashText(totalAed) })}
          </p>
        )}

        {rows === null && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}

        {(rows ?? []).map((row) => {
          const chosen = start[row.campaignId] ?? 'now'
          return (
            <div key={row.campaignId} className="rounded-[12px] border border-white/10 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-white">{row.name}</span>
                <span className="text-xs text-slate-500">
                  {t('attr.spent', { aed: cashText(row.spendAed) })}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className={fieldClass()}
                  placeholder={t('attr.brokerPlaceholder')}
                  value={broker[row.campaignId] ?? ''}
                  onChange={(e) => setBroker((b) => ({ ...b, [row.campaignId]: e.target.value }))}
                />
                <Button
                  disabled={busy !== null || !(broker[row.campaignId] ?? '').trim()}
                  onClick={() => attach(row)}
                >
                  {busy === row.campaignId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : t('attr.attach')}
                </Button>
              </div>

              {/* THE PRICE IS IN THE OPTION. A person choosing "from the
                  beginning" reads what it will take before they choose it,
                  not in a confirmation after. */}
              <div className="mt-3 space-y-1.5">
                {(['now', 'beginning'] as BillingStart[]).map((opt) => (
                  <label key={opt} className="flex items-start gap-2 text-xs text-slate-400">
                    <input
                      type="radio"
                      className="mt-0.5"
                      checked={chosen === opt}
                      onChange={() => setStart((s) => ({ ...s, [row.campaignId]: opt }))}
                    />
                    <span>
                      {opt === 'now'
                        ? t('attr.start.now')
                        : t('attr.start.beginning', { aed: cashText(row.chargeIfFromBeginning) })}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
