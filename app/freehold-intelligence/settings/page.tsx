import { Settings as SettingsIcon } from 'lucide-react'

const sections = [
  { title: 'AI action approval', body: 'Define which actions require Owner or Admin sign-off before the AI can execute them externally.' },
  { title: 'Notebook memory',    body: 'Pin reusable context, control retention, and clear long-term memory across conversations.' },
  { title: 'CRM source mapping', body: 'Route HubSpot fields, lead sources and agent ownership into the private intelligence layer.' },
  { title: 'Lead Machine requirements', body: 'Set the minimum readiness to allow landing generation, ad requests and campaign launch.' },
]

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <SettingsIcon className="h-3.5 w-3.5" /> Settings
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          How the server
          <br />
          <span className="text-white/40">behaves for you.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          Configuration model reserved for the production backend wiring. These are the levers that will be live in V1.
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.title} className="rounded-3xl border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/20">
            <SettingsIcon className="h-5 w-5 text-[#D4AF37]" />
            <h2 className="mt-5 text-lg font-semibold tracking-tight text-white">{s.title}</h2>
            <p className="mt-2 text-[14px] leading-[1.6] text-white/55">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
