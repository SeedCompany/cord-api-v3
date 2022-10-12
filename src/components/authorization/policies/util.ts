// File exists to simplify imports for policy definitions.
export { Role } from '../dto/role.dto';
export { Policy, inherit, allowAll, allowActions } from '../policy';
export { Policy as BuiltPolicy } from '../policy/policy.factory';
export { any, all } from '../policy/conditions';
export * from './conditions';
