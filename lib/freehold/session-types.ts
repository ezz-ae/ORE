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

export const ROLE_COLORS: Record<Role, string> = {
  broker:        '#60A5FA',
  admin:         '#D4AF37',
  sales_manager: '#34D399',
  director:      '#A78BFA',
  ceo:           '#F472B6',
  marketing:     '#38BDF8',
}

/** Roles that can access /management. */
export const MANAGEMENT_ROLES: Role[] = ['admin', 'ceo', 'director']

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
