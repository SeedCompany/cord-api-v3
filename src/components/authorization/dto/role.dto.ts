import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

export enum Role {
  Administrator = 'Administrator',
  BetaTester = 'BetaTester',
  BibleTranslationLiaison = 'BibleTranslationLiaison',
  Consultant = 'Consultant',
  ConsultantManager = 'ConsultantManager',
  Controller = 'Controller',
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
export abstract class SecuredRoles extends SecuredEnumList(Role) {}

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

export type InternalRole =
  | 'AdministratorRole'
  | 'BetaTesterRole'
  | 'BibleTranslationLiaisonRole'
  | 'ConsultantRole'
  | 'ConsultantManagerRole'
  | 'ControllerRole'
  | 'FieldOperationsDirectorRole'
  | 'FieldPartnerRole'
  | 'FinancialAnalystOnGlobalRole'
  | 'FinancialAnalystOnProjectRole'
  | 'FundraisingRole'
  | 'InternRole'
  | 'LeadFinancialAnalystRole'
  | 'LeadershipRole'
  | 'LiaisonRole'
  | 'MarketingRole'
  | 'MentorRole'
  | 'ProjectManagerGlobalRole'
  | 'ProjectManagerOnProjectRole'
  | 'RegionalCommunicationsCoordinatorRole'
  | 'RegionalDirectorGlobalRole'
  | 'RegionalDirectorOnProjectRole'
  | 'StaffMemberRole'
  | 'TranslatorRole';
