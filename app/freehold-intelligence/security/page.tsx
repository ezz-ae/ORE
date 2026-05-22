import { LockKeyhole, ShieldAlert, UserCheck } from "lucide-react"
import { currentServerUser, getRoleScope } from "@/src/features/freehold-intelligence/server-session"

export default function SecurityPage() {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Security</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Private server access model</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">V1 shows the intended role-aware security behavior. Real production auth middleware and external access approvals still need backend connection before broad exposure.</p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="border border-red-300/25 bg-red-500/10 p-4">
          <ShieldAlert className="h-5 w-5 text-red-200" />
          <div className="mt-4 text-lg font-semibold text-white">Auth middleware required</div>
          <p className="mt-2 text-sm leading-6 text-white/60">The private shell is isolated from public UI, but real route protection must be finalized.</p>
        </div>
        <div className="border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4">
          <UserCheck className="h-5 w-5 text-[#D4AF37]" />
          <div className="mt-4 text-lg font-semibold text-white">{currentServerUser.role.replace("_", " ")}</div>
          <p className="mt-2 text-sm leading-6 text-white/60">Current mock account level: {currentServerUser.accountLevel}</p>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <LockKeyhole className="h-5 w-5 text-[#D4AF37]" />
          <div className="mt-4 text-lg font-semibold text-white">Permission-aware AI</div>
          <p className="mt-2 text-sm leading-6 text-white/60">Restricted questions should return scoped answers and suggest an approver.</p>
        </div>
      </section>

      <section className="mt-5 border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Allowed AI scope</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {getRoleScope(currentServerUser.role).map((scope) => (
            <span key={scope} className="border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/60">{scope}</span>
          ))}
        </div>
      </section>
    </div>
  )
}
