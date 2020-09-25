import { InternalRole, Role } from '../dto';
import { BaseNodeType } from './BaseNodeType';

// permissions are the intersection of a role and a base node type.
// each role will have a unique collection of read and write
// permissions on each type of base node.
// the Admin role SHALL have all properties on a base node

export function getRolePermissions(
  role: Role | InternalRole,
  baseNodeType: BaseNodeType
): {
  read: string[];
  edit: string[];
} {
  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Project) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'estimatedSubmission',
        'step',
        'name',
        'status',
        'deptId',
        'mouStart',
        'mouEnd',
        'rootDirectory',
        'member',
        'locations',
        'engagement',
        'partnership',
        'budget',
        'modifiedAt',
        'organization',
      ],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Budget) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'status',
        'budget',
        'record',
        'universalTemplateFile',
        'organization',
      ],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.BudgetRecord
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['fiscalYear', 'amount', 'record', 'partnership', 'organization'],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.Partnership
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'mou',
        'agreement',
        'agreementStatus',
        'mouStatus',
        'mouStart',
        'mouEnd',
        'mouStartOverride',
        'mouEndOverride',
        'types',
        'comment',
        'partnership',
        'organization',
        'financialReportingType',
      ],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.BudgetRecord
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['fiscalYear', 'amount', 'record', 'partnership', 'organization'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Ceremony) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['planned', 'actualDate', 'estimatedDate', 'type', 'ceremony'],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.LanguageEngagement
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'status',
        'completeDate',
        'disbursementCompleteDate',
        'communicationsCompleteDate',
        'initialEndDate',
        'startDate',
        'endDate',
        'startDateOverride',
        'endDateOverride',
        'updatedAt',
        'lastReactivatedAt',
        'lastSuspendedAt',
        'modifiedAt',
        'product',
        'ceremony',
        'language',
        'paraTextRegistryId',
        'projectEngagementTag',
        'ceremonyPlanned',
        'sentPrinting',
        'lukePartnership',
        'firstScripture',
      ],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.InternshipEngagement
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'status',
        'completeDate',
        'disbursementCompleteDate',
        'communicationsCompleteDate',
        'initialEndDate',
        'startDate',
        'endDate',
        'startDateOverride',
        'endDateOverride',
        'updatedAt',
        'lastReactivatedAt',
        'lastSuspendedAt',
        'modifiedAt',
        'position',
        'methodologies',
        'intern',
        'mentor',
        'ceremony',
        'countryOfOrigin',
        'language',
        'growthPlan',
      ],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Film) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'scriptureReferences', 'produces'],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.FundingAccount
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Language) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'name',
        'displayName',
        'sensitivity',
        'isDialect',
        'populationOverride',
        'registryOfDialectsCode',
        'leastOfThese',
        'leastOfTheseReason',
        'displayNamePronunciation',
        'isSignLanguage',
        'signLanguageCode',
        'sponsorEstimatedEndDate',
        'ethnologue',
      ],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.EthnologueLanguage
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['code', 'provisionalCode', 'name', 'population'],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.LiteracyMaterial
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'scriptureReferences', 'produces'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Zone) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'director', 'zone'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Region) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'director', 'zone', 'region'],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.Organization
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'organization', 'organizations'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Partner) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'pointOfContact',
        'organization',
        'type',
        'financialReportingType',
      ],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Product) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'scriptureReferences',
        'scriptureReferencesOverride',
        'mediums',
        'purposes',
        'methodology',
        'produces',
        'engagement',
        'isOverriding',
      ],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Song) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'scriptureReferences', 'produces'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Story) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['name', 'scriptureReferences', 'produces'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.User) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
        'email',
        'education',
        'organization',
        'unavailablity',
        'phone',
        'timezone',
        'bio',
        'status',
        'roles',
        'title',
      ],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.Unavailability
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['description', 'start', 'end', 'unavailability'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Education) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['degree', 'major', 'institution', 'education'],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.ProjectMember
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['roles', 'member', 'user', 'modifiedAt'],
    };
  }

  if (
    role === InternalRole.AdminViewOfProjectMember &&
    baseNodeType === BaseNodeType.User
  ) {
    return {
      read: ['displayFirstName', 'displayLastName', 'email'],
      edit: [],
    };
  }

  if (role === Role.Translator && baseNodeType === BaseNodeType.Project) {
    return {
      // these were just place holders for testing, not impl yet
      read: ['mouStart', 'mouEnd'],
      edit: ['name'],
    };
  }

  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Country) {
    return {
      // these were just place holders for testing, not impl yet
      read: [],
      edit: ['name'],
    };
  }

  return {
    read: [],
    edit: [],
  };
}
