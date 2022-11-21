import { Role } from '~/common';

export * from '~/common/role.dto';

export type ProjectScope = 'project';
export type GlobalScope = 'global';

// Scope for roles. Does this role apply anywhere or only with project membership?
export type AuthScope = GlobalScope | ProjectScope;

export type ProjectScopedRole = `${ProjectScope}:${Role}`;
export type GlobalScopedRole = `${GlobalScope}:${Role}`;

export type ScopedRole = `${AuthScope}:${Role}` | 'member:true';

// A helper to create a bunch of scoped roles for a given scope
export const rolesForScope =
  (scope: AuthScope) =>
  (role: Role): ScopedRole =>
    `${scope}:${role}` as const;

export const withoutScope = (role: ScopedRole): Role => splitScope(role)[1];

export const splitScope = (role: ScopedRole) =>
  role.split(':') as [AuthScope, Role];
