// lib/freehold/mcp/permissions.ts

import { Role } from '@/types/freehold-mcp';

// Placeholder for future permission-related functions or constants
export const userHasRole = (userRoles: Role[], requiredRoles: Role[]): boolean => {
  return requiredRoles.some(role => userRoles.includes(role));
};

export const isActionApproved = (requiresApproval: boolean, userRoles: Role[]): boolean => {
  if (!requiresApproval) {
    return true; // No approval needed
  }
  // For now, let's assume 'admin' role can approve. Extend this logic as needed.
  return userRoles.includes('admin');
};
