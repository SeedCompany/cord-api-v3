// File exists to simplify imports for policy definitions.
export { Role } from '~/common';
export { Policy, inherit, allowAll, allowActions } from '../policy';
export { action } from '../policy/builder/perm-granter';
export type { Policy as BuiltPolicy } from '../policy/policy.factory';
export { any, all } from '../policy/conditions';
export * from './conditions';
