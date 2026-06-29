'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Mail, MessageSquare, Zap } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Channel = 'email' | 'whatsapp' | 'in_app'

type Category = 'leads' | 'campaigns' | 'finance' | 'system'

type NotifRule = {
  id: string
  labelKey: string
  descKey: string
  category: Category
  channels: Record<Channel, boolean>
}

const INITIAL_RULES: NotifRule[] = [
  { id: 'n1', category: 'leads',     labelKey: 'settings.notif.n1.label',  descKey: 'settings.notif.n1.desc',  channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n2', category: 'leads',     labelKey: 'settings.notif.n2.label',  descKey: 'settings.notif.n2.desc',  channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n3', category: 'leads',     labelKey: 'settings.notif.n3.label',  descKey: 'settings.notif.n3.desc',  channels: { email: false, whatsapp: false, in_app: true  } },
  { id: 'n4', category: 'campaigns', labelKey: 'settings.notif.n4.label',  descKey: 'settings.notif.n4.desc',  channels: { email: true,  whatsapp: false, in_app: true  } },
  { id: 'n5', category: 'campaigns', labelKey: 'settings.notif.n5.label',  descKey: 'settings.notif.n5.desc',  channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n6', category: 'campaigns', labelKey: 'settings.notif.n6.label',  descKey: 'settings.notif.n6.desc',  channels: { email: false, whatsapp: false, in_app: true  } },
  { id: 'n7', category: 'finance',   labelKey: 'settings.notif.n7.label',  descKey: 'settings.notif.n7.desc',  channels: { email: true,  whatsapp: false, in_app: true  } },
  { id: 'n8', category: 'finance',   labelKey: 'settings.notif.n8.label',  descKey: 'settings.notif.n8.desc',  channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n9', category: 'system',    labelKey: 'settings.notif.n9.label',  descKey: 'settings.notif.n9.desc',  channels: { email: true,  whatsapp: false, in_app: true  } },
  { id: 'n10',category: 'system',    labelKey: 'settings.notif.n10.label', descKey: 'settings.notif.n10.desc', channels: { email: true,  whatsapp: true,  in_app: true  } },
]

const CHANNEL_META: Record<Channel, { Icon: React.ElementType; labelKey: string; color: string }> = {
  email:    { Icon: Mail,          labelKey: 'settings.notif.channel.email',    color: 'text-teal-400'     },
  whatsapp: { Icon: MessageSquare, labelKey: 'settings.notif.channel.whatsapp', color: 'text-emerald-400' },
  in_app:   { Icon: Bell,          labelKey: 'settings.notif.channel.in_app',   color: 'text-gold'   },
}

const CATEGORY_LABEL_KEY: Record<Category, string> = {
  leads:     'settings.notif.cat.leads',
  campaigns: 'settings.notif.cat.campaigns',
  finance:   'settings.notif.cat.finance',
  system:    'settings.notif.cat.system',
}

const CATEGORIES = [...new Set(INITIAL_RULES.map((r) => r.category))]

export default function NotificationsPage() {
  const t = useT()
  const [rules, setRules] = useState<NotifRule[]>(INITIAL_RULES)
  const loaded = useRef(false)

  // Load saved channel overrides and merge onto the rule set.
  useEffect(() => {
    fetch('/api/freehold/settings', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const saved = d?.settings?.notifRules as Record<string, NotifRule['channels']> | undefined
        if (saved) setRules((prev) => prev.map((r) => saved[r.id] ? { ...r, channels: saved[r.id] } : r))
      })
      .catch(() => {})
      .finally(() => { loaded.current = true })
  }, [])

  // Persist (debounced) whenever rules change after initial load.
  useEffect(() => {
    if (!loaded.current) return
    const map: Record<string, NotifRule['channels']> = {}
    for (const r of rules) map[r.id] = r.channels
    const t = setTimeout(() => {
      fetch('/api/freehold/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifRules: map }),
      }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [rules])

  function toggle(id: string, channel: Channel) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, channels: { ...r.channels, [channel]: !r.channels[channel] } } : r,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">{t('settings.notif.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('settings.notif.subtitle')}
        </p>
      </div>

      {/* Channel legend */}
      <div className="mb-6 flex flex-wrap gap-3">
        {(Object.entries(CHANNEL_META) as [Channel, typeof CHANNEL_META[Channel]][]).map(([key, cm]) => (
          <div key={key} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5">
            <cm.Icon className={`h-3.5 w-3.5 ${cm.color}`} />
            <span className={`text-xs font-medium ${cm.color}`}>{t(cm.labelKey)}</span>
          </div>
        ))}
      </div>

      {/* Rules by category */}
      {CATEGORIES.map((category) => (
        <div key={category} className="mb-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t(CATEGORY_LABEL_KEY[category])}</div>
          <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 gap-0 px-5 py-2.5 text-xs text-slate-600">
              <div className="col-span-2">{t('settings.notif.event')}</div>
              {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
                const cm = CHANNEL_META[ch]
                return (
                  <div key={ch} className={`flex items-center justify-center gap-1 ${cm.color} font-medium`}>
                    <cm.Icon className="h-3 w-3" />
                    <span className="hidden sm:block">{t(cm.labelKey)}</span>
                  </div>
                )
              })}
            </div>
            {rules.filter((r) => r.category === category).map((rule) => (
              <div key={rule.id} className="grid grid-cols-5 items-center gap-0 px-5 py-3.5">
                <div className="col-span-2 min-w-0 pr-4">
                  <div className="text-sm font-medium text-slate-100">{t(rule.labelKey)}</div>
                  <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{t(rule.descKey)}</div>
                </div>
                {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => (
                  <div key={ch} className="flex items-center justify-center">
                    <button
                      onClick={() => toggle(rule.id, ch)}
                      className={`relative h-5 w-9 rounded-full transition ${rule.channels[ch] ? 'bg-gold/80' : 'bg-surface-2'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${rule.channels[ch] ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
