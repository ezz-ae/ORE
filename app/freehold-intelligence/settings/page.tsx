import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Server settings</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Placeholder settings surface for auth, AI action approvals, notification routing, CRM connection and Notebook memory controls.</p>
      </section>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {["AI action approval", "Notebook memory", "CRM source mapping", "Lead Machine requirements"].map((item) => (
          <div key={item} className="border border-white/10 bg-white/[0.03] p-4">
            <Settings className="h-5 w-5 text-[#D4AF37]" />
            <h2 className="mt-4 text-lg font-semibold text-white">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">Configuration model reserved for production backend wiring.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
