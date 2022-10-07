import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '~/common';
import { ResourcesGranter } from '../policy';

export enum Role {
  Administrator = 'Administrator',
  BetaTester = 'BetaTester',
  BibleTranslationLiaison = 'BibleTranslationLiaison',
  Consultant = 'Consultant',
  ConsultantManager = 'ConsultantManager',
  Controller = 'Controller',
  ExperienceOperations = 'ExperienceOperations',
  FieldOperationsDirector = 'FieldOperationsDirector',
  FieldPartner = 'FieldPartner',
  FinancialAnalyst = 'FinancialAnalyst',
  Fundraising = 'Fundraising',
  Intern = 'Intern',
  LeadFinancialAnalyst = 'LeadFinancialAnalyst',
  Leadership = 'Leadership',
  Liaison = 'Liaison',
  Marketing = 'Marketing',
  Mentor = 'Mentor',
  ProjectManager = 'ProjectManager',
  RegionalCommunicationsCoordinator = 'RegionalCommunicationsCoordinator',
  RegionalDirector = 'RegionalDirector',
  StaffMember = 'StaffMember',
  Translator = 'Translator',
}

registerEnumType(Role, { name: 'Role' });

@ObjectType({
  description: SecuredEnumList.descriptionFor('roles'),
})
export abstract class SecuredRoles extends SecuredEnumList<Role, Role>(Role) {}

export type ProjectScope = 'project';
export type GlobalScope = 'global';

// Scope for roles. Does this role apply anywhere or only with project membership?
export type AuthScope = GlobalScope | ProjectScope;

export type ProjectScopedRole = `${ProjectScope}:${Role}`;
export type GlobalScopedRole = `${GlobalScope}:${Role}`;

export type ScopedRole = `${AuthScope}:${Role}`;

// A helper to create a bunch of scoped roles for a given scope
export const rolesForScope =
  (scope: AuthScope) =>
  (role: Role): ScopedRole =>
    `${scope}:${role}` as const;

export const withoutScope = (role: ScopedRole): Role => splitScope(role)[1];

export const splitScope = (role: ScopedRole) =>
  role.split(':') as [AuthScope, Role];

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Role {
  /**
   * A helper to grant roles to be assignable in a more readable way.
   * This should be used within a Policy.
   */
  export const assignable = (
    resources: ResourcesGranter,
    roles: readonly Role[]
  ) => resources.AssignableRoles.grant(roles);

  Object.defineProperty(Role, 'assignable', { enumerable: false });
}
