import { type Role } from '~/common';

type AuthScope = 'global' | 'project';

export type ScopedRole = `${AuthScope}:${Role}` | 'member:true';

// A helper to create a bunch of scoped roles for a given scope
export const rolesForScope =
  (scope: AuthScope) =>
  (role: Role): ScopedRole =>
    `${scope}:${role}` as const;

export const withoutScope = (role: ScopedRole): Role => splitScope(role)[1];

export const splitScope = (role: ScopedRole) =>
  role.split(':') as [AuthScope, Role];
