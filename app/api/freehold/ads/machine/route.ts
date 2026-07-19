import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { buildMachinePlan } from '@/lib/freehold/ads-machine-planner'
import { createMachine, listMachines, logActivity } from '@/lib/freehold/ads-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ads Machine — collection route. Creating a machine builds and persists the
// PLAN only (status 'planning'); nothing launches until the operator starts it.

const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const machines = await listMachines()
  return NextResponse.json({ machines })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res

  let body: { name?: unknown; projectSlugs?: unknown; dailyCapAed?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const projectSlugs = Array.isArray(body.projectSlugs)
    ? body.projectSlugs.filter((s): s is string => typeof s === 'string' && !!s.trim())
    : []
  const dailyCapAed = Number(body.dailyCapAed)

  if (!name) return NextResponse.json({ error: 'A machine name is required' }, { status: 400 })
  if (!projectSlugs.length) return NextResponse.json({ error: 'Pick at least one project' }, { status: 400 })
  if (!Number.isFinite(dailyCapAed) || dailyCapAed <= 0) {
    return NextResponse.json({ error: 'dailyCapAed must be a positive number' }, { status: 400 })
  }

  // Plan FIRST — an unviable cap/project combination is a 400 with the honest
  // reason, and no orphan machine row is ever created.
  const plan = await buildMachinePlan(projectSlugs, dailyCapAed, { machineName: name })
  if (!plan.viable) {
    return NextResponse.json({ error: plan.reason, reason: plan.reason }, { status: 400 })
  }

  const machine = await createMachine({
    name,
    projectSlugs,
    dailyCapAed: Math.floor(dailyCapAed),
    plan,
    createdBy: auth.user.email,
  })
  const trialCount = plan.projects.reduce((n, p) => n + p.trials.length, 0)
  await logActivity({
    machineId: machine.id,
    kind: 'planned',
    detail: `Planned ${trialCount} Meta trial(s) + ${plan.projects.length} Google draft(s) across ${plan.projects.length} project(s) under a hard cap of AED ${machine.dailyCapAed}/day. Nothing launches until the machine is started.`,
    data: {
      projects: plan.projects.map((p) => ({
        slug: p.slug,
        dailyBudgetAed: p.dailyBudgetAed,
        trials: p.trials.map((t) => ({ id: t.id, label: t.label, source: t.source, dailyBudgetAed: t.dailyBudgetAed })),
      })),
    },
  })

  return NextResponse.json({ machine }, { status: 201 })
}
