import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

export enum Role {
  Administrator = 'Administrator',
  BibleTranslationLiaison = 'BibleTranslationLiaison',
  Consultant = 'Consultant',
  ConsultantManager = 'ConsultantManager',
  Controller = 'Controller',
  Development = 'Development',
  ExecutiveDevelopmentRepresentative = 'ExecutiveDevelopmentRepresentative',
  ExecutiveLeadership = 'ExecutiveLeadership',
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
  OfficeOfThePresident = 'OfficeOfThePresident',
  ProjectManager = 'ProjectManager',
  RegionalCommunicationsCoordinator = 'RegionalCommunicationsCoordinator',
  RegionalDirector = 'RegionalDirector',
  StaffMember = 'StaffMember',
  SupportingProjectManager = 'SupportingProjectManager',
  Translator = 'Translator',
  Writer = 'Writer',
}

registerEnumType(Role, { name: 'Role' });

@ObjectType({
  description: SecuredEnumList.descriptionFor('roles'),
})
export abstract class SecuredRoles extends SecuredEnumList(Role) {}

export enum InternalRole {
  ReadAll = 'ReadAll',
}
