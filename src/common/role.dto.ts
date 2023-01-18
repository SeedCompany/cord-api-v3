import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '~/common/secured-property';
import type { ResourcesGranter } from '../components/authorization';

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

  export const all = new Set(Object.keys(Role)) as ReadonlySet<Role>;
  Object.defineProperty(Role, 'all', { enumerable: false });
}
