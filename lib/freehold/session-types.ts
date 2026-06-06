/**
 * Shared session types — safe to import from anywhere (client, server, edge).
 * Contains no secrets and no runtime logic.
 */

export type Role = 'admin' | 'broker'

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
