'use client'

import { useState } from 'react'
import { Bell, Mail, MessageSquare, Zap } from 'lucide-react'

type Channel = 'email' | 'whatsapp' | 'in_app'

type NotifRule = {
  id: string
  label: string
  desc: string
  category: string
  channels: Record<Channel, boolean>
}

const INITIAL_RULES: NotifRule[] = [
  { id: 'n1', category: 'Leads',    label: 'New lead assigned',     desc: 'When a lead is routed to an agent',         channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n2', category: 'Leads',    label: 'Lead overdue',          desc: 'No contact after 24h',                      channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n3', category: 'Leads',    label: 'Lead stage advanced',   desc: 'Pipeline stage moves forward',               channels: { email: false, whatsapp: false, in_app: true  } },
  { id: 'n4', category: 'Campaigns',label: 'Campaign paused',       desc: 'Ad account or budget event',                 channels: { email: true,  whatsapp: false, in_app: true  } },
  { id: 'n5', category: 'Campaigns',label: 'Budget 80% reached',    desc: 'Monthly campaign spend threshold',           channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n6', category: 'Campaigns',label: 'New lead from campaign', desc: 'A campaign generates a new conversion',     channels: { email: false, whatsapp: false, in_app: true  } },
  { id: 'n7', category: 'Finance',  label: 'Invoice issued',        desc: 'New invoice from Meta or Google',            channels: { email: true,  whatsapp: false, in_app: true  } },
  { id: 'n8', category: 'Finance',  label: 'Commission processed',  desc: 'Agent commission approved or paid',          channels: { email: true,  whatsapp: true,  in_app: true  } },
  { id: 'n9', category: 'System',   label: 'Data quality alert',    desc: 'Property readiness drops below threshold',   channels: { email: true,  whatsapp: false, in_app: true  } },
  { id: 'n10',category: 'System',   label: 'Integration error',     desc: 'API sync failure or token expiry',           channels: { email: true,  whatsapp: true,  in_app: true  } },
]

const CHANNEL_META: Record<Channel, { Icon: React.ElementType; label: string; color: string }> = {
  email:    { Icon: Mail,          label: 'Email',    color: 'text-sky-400'     },
  whatsapp: { Icon: MessageSquare, label: 'WhatsApp', color: 'text-emerald-400' },
  in_app:   { Icon: Bell,          label: 'In-app',   color: 'text-[#D4AF37]'   },
}

const CATEGORIES = [...new Set(INITIAL_RULES.map((r) => r.category))]

export default function NotificationsPage() {
  const [rules, setRules] = useState<NotifRule[]>(INITIAL_RULES)

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
        <h1 className="text-[20px] font-semibold text-white">Notifications</h1>
        <p className="mt-1 text-[13px] text-white/35">
          Configure when and how the platform notifies you and your team.
        </p>
      </div>

      {/* Channel status */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {(Object.entries(CHANNEL_META) as [Channel, typeof CHANNEL_META[Channel]][]).map(([key, cm]) => (
          <div key={key} className="rounded-[14px] border border-white/[0.06] bg-[#131B2B] px-4 py-3.5 flex items-center gap-3">
            <cm.Icon className={`h-4 w-4 ${cm.color}`} />
            <div>
              <div className={`text-[12px] font-semibold ${cm.color}`}>{cm.label}</div>
              <div className="text-[10px] text-white/25">Connected</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rules by category */}
      {CATEGORIES.map((category) => (
        <div key={category} className="mb-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/25">{category}</div>
          <div className="rounded-[16px] border border-white/[0.07] bg-[#131B2B] divide-y divide-white/[0.04] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 gap-0 px-5 py-2.5 text-[11px] text-white/20">
              <div className="col-span-2">Event</div>
              {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
                const cm = CHANNEL_META[ch]
                return (
                  <div key={ch} className={`flex items-center justify-center gap-1 ${cm.color} font-medium`}>
                    <cm.Icon className="h-3 w-3" />
                    <span className="hidden sm:block">{cm.label}</span>
                  </div>
                )
              })}
            </div>
            {rules.filter((r) => r.category === category).map((rule) => (
              <div key={rule.id} className="grid grid-cols-5 items-center gap-0 px-5 py-3.5">
                <div className="col-span-2 min-w-0 pr-4">
                  <div className="text-[13px] font-medium text-white/80">{rule.label}</div>
                  <div className="mt-0.5 text-[11px] text-white/30 leading-relaxed">{rule.desc}</div>
                </div>
                {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => (
                  <div key={ch} className="flex items-center justify-center">
                    <button
                      onClick={() => toggle(rule.id, ch)}
                      className={`relative h-5 w-9 rounded-full transition ${rule.channels[ch] ? 'bg-[#D4AF37]/80' : 'bg-white/[0.08]'}`}
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
