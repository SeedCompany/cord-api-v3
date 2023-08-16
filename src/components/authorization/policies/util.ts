import { Role } from '~/common';

// File exists to simplify imports for policy definitions.
export { Role } from '~/common';
export { Policy, inherit, allowAll, allowActions } from '../policy';
export { Policy as BuiltPolicy } from '../policy/policy.factory';
export { any, all } from '../policy/conditions';
export * from './conditions';

export const Hierarchies = {
  Finance: [Role.FinancialAnalyst, Role.LeadFinancialAnalyst, Role.Controller],
  Field: [
    Role.ProjectManager,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
  ],
};
