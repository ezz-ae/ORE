import { CheckSquare, AlertCircle, Clock, CheckCircle2, User, ArrowUpRight, Sparkles, Plus } from 'lucide-react'
import Link from 'next/link'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type Task = {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'done'
  title: string
  description: string
  owner: string
  assignee: string
  app: string
  appHref?: string
  dueDate?: string
  linkedTo?: string
  convertedFrom?: string
}

const tasks: Task[] = [
  {
    id: 'task_001',
    priority: 'critical',
    status: 'blocked',
    title: 'Assign Meta billing owner and confirm payment method',
    description: 'Ad launch is blocked until the Meta ad account has a valid billing owner attached. This single task unlocks the entire Palm Jumeirah campaign pipeline.',
    owner: 'Owner',
    assignee: 'Owner',
    app: 'Lead Machine',
    appHref: '/freehold-intelligence/lead-machine/listings/lm_palm_001',
    dueDate: 'Today',
    linkedTo: 'Req · req_meta_billing',
    convertedFrom: 'rv_001',
  },
  {
    id: 'task_002',
    priority: 'high',
    status: 'open',
    title: 'Approve or request edits on Palm investor landing',
    description: 'Landing is at 84% completion. Approve to proceed to campaign packaging, or mark specific sections for revision. One decision unblocks the entire Palm launch sequence.',
    owner: 'Owner',
    assignee: 'Owner',
    app: 'Lead Machine',
    appHref: '/freehold-intelligence/lead-machine/landings',
    dueDate: 'Today',
    linkedTo: 'Landing · palm-investor-preview',
  },
  {
    id: 'task_003',
    priority: 'high',
    status: 'in_progress',
    title: 'Confirm Meta pixel lead event and test form submission',
    description: 'Pixel is installed but the Lead conversion event mapping needs confirmation. Test the lead form submission end-to-end in Events Manager and confirm the event fires correctly before campaign launch.',
    owner: 'Marketing',
    assignee: 'MTC',
    app: 'Lead Machine',
    appHref: '/freehold-intelligence/lead-machine/requirements',
    dueDate: '23 May',
    linkedTo: 'Req · req_tracking',
  },
  {
    id: 'task_004',
    priority: 'high',
    status: 'open',
    title: 'Review and approve eight high-intent CRM leads',
    description: 'Eight leads have been scored high-intent by the AI. Three show delayed follow-up (>24h), two show investor intent with no callback. Sales manager action required to unblock agent queue.',
    owner: 'Sales Manager',
    assignee: 'Ahmad K.',
    app: 'CRM',
    appHref: '/freehold-intelligence/crm',
    dueDate: 'Today',
    linkedTo: 'CRM · Today\'s queue',
  },
  {
    id: 'task_005',
    priority: 'high',
    status: 'open',
    title: 'Approve Dubai Hills investor yield campaign angle',
    description: 'Marketing is waiting on angle approval before the ad request can move to "ready to launch". The Dubai Hills family-investor yield corridor angle is the preferred option.',
    owner: 'Owner',
    assignee: 'Owner',
    app: 'Lead Machine',
    appHref: '/freehold-intelligence/lead-machine/ad-requests',
    dueDate: 'Tomorrow',
    linkedTo: 'Ad Request · adreq_hills_001',
  },
  {
    id: 'task_006',
    priority: 'medium',
    status: 'open',
    title: 'Update Palm landing hero CTA to investor comparison',
    description: 'Current hero CTA reads "Check availability". For investor-intent traffic, this should ask for a payment plan comparison. Request copy update from marketing team.',
    owner: 'Marketing',
    assignee: 'Marketing',
    app: 'Lead Machine',
    appHref: '/freehold-intelligence/lead-machine/listings/lm_palm_001',
    dueDate: '23 May',
    linkedTo: 'Review · rv_004',
    convertedFrom: 'rv_004',
  },
  {
    id: 'task_007',
    priority: 'medium',
    status: 'open',
    title: 'Add payment plan data for Business Bay listing',
    description: 'Binghatti payment plan is missing. Listing requires this field before a landing can be generated. Verify with developer and add verified payment schedule to the listing record.',
    owner: 'Data Manager',
    assignee: 'Data Manager',
    app: 'Lead Machine',
    appHref: '/freehold-intelligence/lead-machine/listings/lm_bay_003',
    dueDate: '24 May',
    linkedTo: 'Req · req_payment_plan',
  },
  {
    id: 'task_008',
    priority: 'high',
    status: 'blocked',
    title: 'Wire production auth middleware before widening access',
    description: 'The private shell is visually isolated but route protection is still placeholder. Production auth middleware must be wired before the server is shared beyond the owner account.',
    owner: 'Admin',
    assignee: 'Admin',
    app: 'Security',
    appHref: '/freehold-intelligence/security',
    dueDate: 'Before wider access',
    linkedTo: 'System · security',
  },
]

function priorityTone(p: string) {
  if (p === 'critical') return { ring: 'border-red-400/25', bg: 'bg-red-400/[0.05]', text: 'text-red-300', dot: 'bg-red-400', label: 'Critical' }
  if (p === 'high')     return { ring: 'border-[#D4AF37]/25', bg: 'bg-[#D4AF37]/[0.05]', text: 'text-[#F8E7AE]', dot: 'bg-[#D4AF37]', label: 'High' }
  if (p === 'medium')   return { ring: 'border-sky-400/20', bg: 'bg-sky-400/[0.04]', text: 'text-sky-200', dot: 'bg-sky-400', label: 'Medium' }
  return                       { ring: 'border-white/[0.06]', bg: 'bg-[#0A0D10]', text: 'text-white/50', dot: 'bg-white/30', label: 'Low' }
}

function statusChip(status: string) {
  if (status === 'done')        return { text: 'text-emerald-300', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />, label: 'Done' }
  if (status === 'blocked')     return { text: 'text-red-300', icon: <AlertCircle className="h-3.5 w-3.5 text-red-400" />, label: 'Blocked' }
  if (status === 'in_progress') return { text: 'text-[#F8E7AE]', icon: <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />, label: 'In Progress' }
  return                               { text: 'text-white/55', icon: <Clock className="h-3.5 w-3.5 text-white/30" />, label: 'Open' }
}

const openTasks = tasks.filter(t => t.status !== 'done')
const criticalTasks = tasks.filter(t => t.priority === 'critical')
const blockedTasks = tasks.filter(t => t.status === 'blocked')
const dueTodayTasks = tasks.filter(t => t.dueDate === 'Today')

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'] as const

export default function TasksPage() {
  const sorted = [...tasks].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority]
    const statusOrder = { blocked: 0, open: 1, in_progress: 2, done: 3 }
    return statusOrder[a.status] - statusOrder[b.status]
  })

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <CheckSquare className="h-3.5 w-3.5" /> Tasks
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          {openTasks.length} tasks open.
          <br />
          <span className="text-white/35">{dueTodayTasks.length} due today.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Owned, dated and tracked. Created from review comments, blockers and internal decisions. Resolve critical and blocked items first.
        </p>
      </section>

      {/* Stat tiles */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{openTasks.length}</p>
          <p className="text-[10px] text-white/35 mt-1">Open</p>
        </div>
        <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-red-300">{criticalTasks.length}</p>
          <p className="text-[10px] text-red-400/60 mt-1">Critical</p>
        </div>
        <div className="rounded-[18px] border border-orange-400/20 bg-orange-400/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-orange-300">{blockedTasks.length}</p>
          <p className="text-[10px] text-orange-400/60 mt-1">Blocked</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{dueTodayTasks.length}</p>
          <p className="text-[10px] text-[#D4AF37]/60 mt-1">Due today</p>
        </div>
      </section>

      {/* Task cards */}
      <section className="mt-8 space-y-4">
        {sorted.map(task => {
          const tone = priorityTone(task.priority)
          const st = statusChip(task.status)
          return (
            <div key={task.id} className={`rounded-[22px] border p-6 ${tone.ring} ${tone.bg}`}>
              {/* Top row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.ring} ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                  <span className="text-[11px] text-white/30">{task.app}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px]">
                  {st.icon}
                  <span className={st.text}>{st.label}</span>
                </div>
              </div>

              {/* Title + desc */}
              <h3 className="mt-3 text-[15px] font-semibold text-white">{task.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{task.description}</p>

              {/* Meta row */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                <div className="flex flex-wrap gap-4 text-[12px] text-white/35">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    <span className="text-white/55">{task.assignee}</span>
                  </span>
                  {task.dueDate && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span className={task.dueDate === 'Today' ? 'text-[#D4AF37]' : 'text-white/55'}>{task.dueDate}</span>
                    </span>
                  )}
                  {task.linkedTo && <span>→ <span className="text-white/45">{task.linkedTo}</span></span>}
                </div>

                {task.status !== 'done' && (
                  <button className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-emerald-300 transition hover:border-emerald-400/35 hover:bg-emerald-400/10">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark done
                  </button>
                )}
              </div>

              {/* App link */}
              {task.appHref && (
                <Link
                  href={task.appHref}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] text-white/30 transition hover:text-[#D4AF37]"
                >
                  Open in {task.app} <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )
        })}
      </section>

      {/* Add task */}
      <section className="mt-8 rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
          <Plus className="h-3.5 w-3.5" /> Create a task
        </div>
        <div className="space-y-3">
          <input
            placeholder="Task title"
            className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition"
          />
          <textarea
            placeholder="Describe the task, expected outcome, and what success looks like…"
            rows={3}
            className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition resize-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              placeholder="Assign to…"
              className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition"
            />
            <input
              placeholder="Due date"
              className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition"
            />
            <button className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-white/90">
              Create task
            </button>
          </div>
        </div>
      </section>

      {/* AI take */}
      <section className="mt-8 rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] px-6 py-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80 mb-3">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="text-[15px] font-medium leading-[1.65] text-white/85">
          The two blocked tasks (Meta billing, auth middleware) have the highest downstream impact. Billing unblocks the entire campaign pipeline. After that, the Palm landing approval and the CRM lead review are both achievable today and unlock agent momentum immediately.
        </p>
      </section>

      {/* AI prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Ask about tasks, owners, deadlines, blockers…"
          suggestions={[
            'What is due today?',
            'Show tasks blocked on access.',
            'Which tasks does the owner need to action?',
            'Group tasks by milestone.',
          ]}
        />
      </section>

    </div>
  )
}
