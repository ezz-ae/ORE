import { Lock, ShieldAlert, UserCheck } from 'lucide-react'
import { currentServerUser, getRoleScope } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

export default function SecurityPage() {
  const scope = getRoleScope(currentServerUser.role)

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Lock className="h-3.5 w-3.5" /> Security
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          The server only answers
          <br />
          <span className="text-white/40">in your scope.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          The AI is role-aware. Anything outside your scope is silently filtered, with the option to suggest an approver. Production middleware is the final hardening before wider exposure.
        </p>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about access, roles, audit, scope…"
          suggestions={[
            'Who can approve external writes?',
            'Show last 24h audit events.',
            'What can an Admin not do?',
          ]}
        />
      </section>

      <section className="mt-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Current session</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-400/15 bg-red-500/[0.04] p-5">
            <ShieldAlert className="h-5 w-5 text-red-300" />
            <div className="mt-5 text-base font-semibold text-white">Auth middleware required</div>
            <p className="mt-1.5 text-[13px] leading-snug text-white/55">The private shell is isolated, but production route protection still needs to be finalized.</p>
          </div>
          <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-5">
            <UserCheck className="h-5 w-5 text-[#D4AF37]" />
            <div className="mt-5 text-base font-semibold capitalize text-white">{currentServerUser.role.replace('_', ' ')}</div>
            <p className="mt-1.5 text-[13px] leading-snug text-white/55">Account level: {currentServerUser.accountLevel}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
            <Lock className="h-5 w-5 text-[#D4AF37]" />
            <div className="mt-5 text-base font-semibold text-white">Permission-aware AI</div>
            <p className="mt-1.5 text-[13px] leading-snug text-white/55">Restricted questions return scoped answers and suggest an approver path.</p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">AI scope for this role</div>
        <div className="mt-5 flex flex-wrap gap-2">
          {scope.map((s) => (
            <span key={s} className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-white/65">
              {s}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
