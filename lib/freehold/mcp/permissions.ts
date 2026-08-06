// lib/freehold/mcp/permissions.ts

import { Role } from '@/types/freehold-mcp';

/** Does the caller hold any of the roles a tool requires? */
export const userHasRole = (userRoles: Role[], requiredRoles: Role[]): boolean => {
  return requiredRoles.some(role => userRoles.includes(role));
};

/**
 * Roles that may approve a tool marked `requiresApproval`.
 *
 * Those tools are the ones that spend money or speak to a client on the
 * company's behalf: campaign launch, Meta launch, Google budget, HubSpot write,
 * WhatsApp send. Approval therefore belongs to the roles that answer for both.
 */
export const APPROVER_ROLES: Role[] = ['owner', 'admin'];

/**
 * May this caller approve a gated action?
 *
 * This previously read `userRoles.includes('admin')` with a note saying "for
 * now, let's assume 'admin' can approve" — which locked out 'owner', the
 * highest role in this vocabulary and the account that pays for the system.
 * The owner could not launch a campaign or send a WhatsApp message through the
 * tool layer, while an admin could. The lower role outranked the higher one.
 */
export const isActionApproved = (requiresApproval: boolean, userRoles: Role[]): boolean => {
  if (!requiresApproval) return true;
  return userHasRole(userRoles, APPROVER_ROLES);
};
