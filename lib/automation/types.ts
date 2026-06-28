/**
 * Automation & Rules — shared types for the Lead Machine / Ads configurability
 * layer. Client-safe (no DB imports) so settings UIs can import these directly.
 *
 * Everything is scoped by `workspaceId` so the same engine serves multiple
 * companies later; today there is a single 'default' workspace.
 */

export const DEFAULT_WORKSPACE = 'default'

// ── Rule triggers (events the engine reacts to) ──────────────────────────────
export const RULE_TRIGGERS = [
  'lead.created',
  'lead.updated',
  'lead.status_changed',
  'lead.unattended',     // time-based — fired by the SLA cron
  'deal.stage_changed',
  'campaign.cpl_exceeded',
] as const
export type RuleTrigger = (typeof RULE_TRIGGERS)[number]

export const TRIGGER_LABELS: Record<RuleTrigger, string> = {
  'lead.created': 'When a lead is created',
  'lead.updated': 'When a lead is updated',
  'lead.status_changed': 'When a lead status changes',
  'lead.unattended': 'When a lead is left unattended (SLA)',
  'deal.stage_changed': 'When a deal changes stage',
  'campaign.cpl_exceeded': 'When a campaign CPL exceeds target',
}

// ── Condition fields (left-hand side of IF) ──────────────────────────────────
export const CONDITION_FIELDS = [
  'lead.source',
  'lead.status',
  'lead.priority',
  'lead.country',
  'lead.budget_aed',
  'lead.project_slug',
  'lead.landing_slug',
  'lead.assigned_broker_id',
  'lead.hours_since_created',
  'lead.hours_since_contact',
  'campaign.cpl',
  'deal.stage',
] as const
export type ConditionField = (typeof CONDITION_FIELDS)[number]

export const FIELD_LABELS: Record<ConditionField, string> = {
  'lead.source': 'Lead source',
  'lead.status': 'Lead status',
  'lead.priority': 'Lead priority',
  'lead.country': 'Lead country',
  'lead.budget_aed': 'Lead budget (AED)',
  'lead.project_slug': 'Lead project',
  'lead.landing_slug': 'Lead landing page',
  'lead.assigned_broker_id': 'Assigned agent',
  'lead.hours_since_created': 'Hours since created',
  'lead.hours_since_contact': 'Hours since last contact',
  'campaign.cpl': 'Campaign CPL',
  'deal.stage': 'Deal stage',
}

/** Fields whose values are numeric (drive which operators/inputs to show). */
export const NUMERIC_FIELDS: ConditionField[] = [
  'lead.budget_aed',
  'lead.hours_since_created',
  'lead.hours_since_contact',
  'campaign.cpl',
]

// ── Operators ────────────────────────────────────────────────────────────────
export const OPERATORS = [
  'eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte',
  'contains', 'is_empty', 'is_not_empty',
] as const
export type Operator = (typeof OPERATORS)[number]

export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  not_in: 'is not one of',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

export const NUMERIC_OPERATORS: Operator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']
export const TEXT_OPERATORS: Operator[] = ['eq', 'neq', 'in', 'not_in', 'contains', 'is_empty', 'is_not_empty']

export interface Condition {
  field: ConditionField
  operator: Operator
  /** string for text ops, number for numeric, string[] for in/not_in. Ignored for is_empty/is_not_empty. */
  value?: string | number | string[]
}

export type Combinator = 'all' | 'any'   // AND / OR

// ── Actions (right-hand side of THEN) ────────────────────────────────────────
export const ACTION_TYPES = [
  'assign_to_agent',
  'assign_round_robin',
  'assign_load_balanced',
  'set_priority',
  'set_status',
  'snooze',
  'notify',
  'require_approval',
  'pause_campaign',
] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export const ACTION_LABELS: Record<ActionType, string> = {
  assign_to_agent: 'Assign to a specific agent',
  assign_round_robin: 'Distribute round-robin to a pool',
  assign_load_balanced: 'Assign to the least-loaded agent',
  set_priority: 'Set priority',
  set_status: 'Set status',
  snooze: 'Snooze / schedule follow-up',
  notify: 'Notify',
  require_approval: 'Require approval',
  pause_campaign: 'Pause campaign',
}

export interface Action {
  type: ActionType
  /** brokerId for assign_to_agent */
  brokerId?: string
  /** pool of brokerIds for round-robin / load-balanced (empty = all brokers) */
  pool?: string[]
  /** priority/status value */
  value?: string
  /** hours for snooze */
  hours?: number
  /** notify target: 'management' | 'assigned' | a role | a brokerId */
  target?: string
  /** free-text note for notify */
  message?: string
}

// ── Rule ─────────────────────────────────────────────────────────────────────
export interface AutomationRule {
  id: string
  workspaceId: string
  name: string
  enabled: boolean
  trigger: RuleTrigger
  combinator: Combinator
  conditions: Condition[]
  actions: Action[]
  sortOrder: number
  /** stop evaluating later rules for this event once this one matches */
  stopOnMatch: boolean
  runCount: number
  lastRunAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

// ── Lead distribution config ─────────────────────────────────────────────────
export const DISTRIBUTION_STRATEGIES = [
  'round_robin',
  'load_balanced',
  'performance',
  'area',
  'source',
] as const
export type DistributionStrategy = (typeof DISTRIBUTION_STRATEGIES)[number]

export const STRATEGY_LABELS: Record<DistributionStrategy, string> = {
  round_robin: 'Round-robin (even rotation)',
  load_balanced: 'Load-balanced (least busy first)',
  performance: 'Performance-weighted (top closers first)',
  area: 'Area / specialty match',
  source: 'Source-based routing',
}

export interface DistributionConfig {
  mode: 'manual' | 'auto'
  strategy: DistributionStrategy
  /** eligible agent brokerIds; empty = all active brokers */
  pool: string[]
  /** max leads assigned to one agent per day (0 = no cap) */
  maxPerAgentPerDay: number
  /** only assign during working hours (Asia/Dubai) */
  respectWorkingHours: boolean
  workingHoursStart: number   // 0-23
  workingHoursEnd: number     // 0-23
  /** fallback agent when no one is eligible */
  fallbackBrokerId: string | null
  /** source → brokerId[] map for the 'source' strategy */
  sourceMap: Record<string, string[]>
  /** area/project keyword → brokerId[] for the 'area' strategy */
  areaMap: Record<string, string[]>
}

// ── Per-surface automation mode ("AI or not" per step) ───────────────────────
export type AutomationMode = 'manual' | 'assisted' | 'auto'

export const AUTOMATION_STEPS = [
  'ad.property',
  'ad.strategy',
  'ad.budget',
  'ad.audience',
  'ad.creative',
  'ad.landing',
  'ad.launch',
  'lm.listings',
  'lm.landings',
  'lm.ad_requests',
  'lm.campaigns',
] as const
export type AutomationStep = (typeof AUTOMATION_STEPS)[number]

export const STEP_LABELS: Record<AutomationStep, string> = {
  'ad.property': 'Ad — property selection',
  'ad.strategy': 'Ad — strategy / angle',
  'ad.budget': 'Ad — budget & channel split',
  'ad.audience': 'Ad — audience / targeting',
  'ad.creative': 'Ad — creative (copy & visuals)',
  'ad.landing': 'Ad — landing page',
  'ad.launch': 'Ad — launch',
  'lm.listings': 'Lead Machine — listings',
  'lm.landings': 'Lead Machine — landing pages',
  'lm.ad_requests': 'Lead Machine — ad requests',
  'lm.campaigns': 'Lead Machine — campaigns',
}

export type DifficultyLevel = 'beginner' | 'standard' | 'expert'

export interface ApprovalConfig {
  /** approval steps required for launching ads / publishing */
  adLaunch: 0 | 1 | 2
  landingPublish: 0 | 1 | 2
  leadReassign: 0 | 1
  /** budget over this AED amount needs approval (0 = never) */
  budgetApprovalThreshold: number
}

export interface WorkspaceAutomationConfig {
  difficulty: DifficultyLevel
  /** whether AI may use internal system data (leads, performance, inventory) */
  useInternalData: boolean
  steps: Record<AutomationStep, AutomationMode>
  approvals: ApprovalConfig
  distribution: DistributionConfig
}

// ── Sensible defaults ────────────────────────────────────────────────────────
export function defaultStepsForDifficulty(d: DifficultyLevel): Record<AutomationStep, AutomationMode> {
  const mode: AutomationMode = d === 'beginner' ? 'auto' : d === 'expert' ? 'manual' : 'assisted'
  return AUTOMATION_STEPS.reduce((acc, s) => {
    // launch always defaults to a safer mode than the rest
    acc[s] = s === 'ad.launch' && d !== 'expert' ? 'assisted' : mode
    return acc
  }, {} as Record<AutomationStep, AutomationMode>)
}

export function defaultConfig(): WorkspaceAutomationConfig {
  return {
    difficulty: 'standard',
    useInternalData: true,
    steps: defaultStepsForDifficulty('standard'),
    approvals: {
      adLaunch: 1,
      landingPublish: 1,
      leadReassign: 0,
      budgetApprovalThreshold: 50000,
    },
    distribution: {
      mode: 'manual',
      strategy: 'round_robin',
      pool: [],
      maxPerAgentPerDay: 0,
      respectWorkingHours: false,
      workingHoursStart: 9,
      workingHoursEnd: 19,
      fallbackBrokerId: null,
      sourceMap: {},
      areaMap: {},
    },
  }
}
