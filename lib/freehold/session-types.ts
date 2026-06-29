/**
 * Shared session types — safe to import from anywhere (client, server, edge).
 * Contains no secrets and no runtime logic.
 */

export type Role = 'broker' | 'admin' | 'sales_manager' | 'director' | 'ceo' | 'marketing'

export const ROLE_LABELS: Record<Role, string> = {
  broker:        'Broker',
  admin:         'Admin',
  sales_manager: 'Sales Manager',
  director:      'Director',
  ceo:           'CEO',
  marketing:     'Marketing',
}

// Brand-aligned role tints (no cold blue — brokers are the bulk of the roster,
// so a blue broker tint made the whole team list read blue).
export const ROLE_COLORS: Record<Role, string> = {
  broker:        '#2DD4BF',
  admin:         '#D4AF37',
  sales_manager: '#34D399',
  director:      '#A78BFA',
  ceo:           '#F472B6',
  marketing:     '#FB923C',
}

/**
 * Roles that can access /freehold-intelligence/management — company-wide,
 * system-level reporting (team, deals, ROI, reports, events).
 * Sales managers are included: they own team performance reporting.
 */
export const MANAGEMENT_ROLES: Role[] = ['admin', 'ceo', 'director', 'sales_manager']

export interface SessionUser {
  email: string
  name: string
  initials: string
  role: Role
  /** Links a broker session to credit / lead data (brokers only). */
  brokerId?: string
  /** Where this role lands after login. */
  home: string
}
