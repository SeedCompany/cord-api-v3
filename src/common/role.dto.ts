import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum } from '@seedcompany/nest';
import { SecuredEnumList } from '~/common/secured-property';
import type { ResourcesGranter } from '../components/authorization';

export type Role = EnumType<typeof Role>;
export const Role = makeEnum({
  name: 'Role',
  values: [
    'Administrator',
    'BetaTester',
    'BibleTranslationLiaison',
    'Consultant',
    'ConsultantManager',
    'Controller',
    'ExperienceOperations',
    'FieldOperationsDirector',
    'FieldPartner',
    'FinancialAnalyst',
    'Fundraising',
    'Intern',
    'LeadFinancialAnalyst',
    'Leadership',
    'Liaison',
    'Marketing',
    'Mentor',
    'MultiplicationFinanceApprover',
    'ProjectManager',
    'RegionalCommunicationsCoordinator',
    'RegionalDirector',
    'StaffMember',
    'Translator',
  ],
  extra: (role) => {
    type Role = EnumType<typeof role>;
    return {
      /**
       * A helper to grant roles to be assignable in a more readable way.
       * This should be used within a Policy.
       */
      assignable: (resources: ResourcesGranter, roles: readonly Role[]) =>
        resources.AssignableRoles.grant(roles),
    };
  },
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('roles'),
})
export abstract class SecuredRoles extends SecuredEnumList(Role) {}
