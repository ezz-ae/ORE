import Link from 'next/link'
import { ArrowLeft, UserCog, Shield, Users, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { currentServerUser, getRoleScope, crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const ACCOUNT_LEVELS: Record<string, { label: string; description: string }> = {
  owner:    { label: 'Owner',    description: 'Full access — all modules, all data, all configuration.' },
  admin:    { label: 'Admin',    description: 'Operational access — users, tasks, approvals, configuration.' },
  operator: { label: 'Operator', description: 'Module access — campaigns, CRM, lead machine, content.' },
  agent:    { label: 'Agent',    description: 'Scoped access — assigned leads, client messages, project details.' },
  viewer:   { label: 'Viewer',   description: 'Read-only — approved summaries, reports, public data.' },
}

export default function DashboardProfilePage() {
  const scope = getRoleScope(currentServerUser.role)
  const accountLevel = ACCOUNT_LEVELS[currentServerUser.accountLevel]

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85 flex items-center gap-2">
            <UserCog className="h-3.5 w-3.5" /> Profile & Access
          </div>
          <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-medium text-sky-300">
            In progress — team management coming in V1.1
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Account & permissions<br /><span className="text-white/35">role-gated access.</span>
        </h1>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">

          {/* Account card */}
          <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37]/25 to-[#D4AF37]/5 text-[20px] font-semibold text-[#D4AF37]">
                {currentServerUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[22px] font-semibold text-white">{currentServerUser.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-white/45">
                  <span>{accountLevel?.label}</span>
                  <span className="text-white/20">·</span>
                  <span>{currentServerUser.role.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            <p className="mt-5 text-[14px] leading-relaxed text-white/60">{accountLevel?.description}</p>
          </div>

          {/* Role scope */}
          <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
              <Shield className="h-3 w-3" /> Role scope
            </div>
            <p className="mt-1 text-[12px] text-white/35">Surfaces and data visible to a {currentServerUser.role.replace('_', ' ')}.</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {scope.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-[10px] border border-white/[0.05] bg-white/[0.025] px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                  <span className="text-[12px] text-white/65">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned modules */}
          <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
              <CheckCircle2 className="h-3 w-3" /> Assigned modules
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {currentServerUser.assignedModules.map((mod) => (
                <span key={mod} className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.08] px-3 py-1 text-[12px] font-medium text-[#D4AF37]/80">
                  {mod.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* AI prompt */}
          <AiPrompt
            placeholder="Ask about access, roles, permissions…"
            suggestions={[
              'What can a sales agent see in the system?',
              'How do I add a new team member?',
              'What is the difference between owner and admin access?',
            ]}
          />
        </div>

        {/* Sidebar: team */}
        <aside className="space-y-4">
          <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <div className="flex items-center gap-2 mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
              <Users className="h-3 w-3" /> Sales team
            </div>
            <div className="space-y-3">
              {crmAgentRoster.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-[11px] font-semibold text-[#D4AF37]">
                      {agent.initials}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-white">{agent.name}</div>
                      <div className="text-[10px] text-white/35">{agent.role}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium ${
                    agent.status === 'available' ? 'text-emerald-300' :
                    agent.status === 'overloaded' ? 'text-red-300' : 'text-[#F8E7AE]'
                  }`}>
                    {agent.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/freehold-intelligence/crm/assignment"
              className="mt-4 flex items-center gap-1 text-[11px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
            >
              Manage assignments <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-[20px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">Coming in V1.1</div>
            <div className="mt-3 space-y-2 text-[12px] text-white/55">
              <div>· Invite team members</div>
              <div>· Role assignment interface</div>
              <div>· Module-level permission overrides</div>
              <div>· Session and activity audit</div>
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}
