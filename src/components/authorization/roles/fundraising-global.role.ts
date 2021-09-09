import { Sensitivity } from '../../../common';
import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import { DbInternshipEngagement, DbLanguageEngagement } from '../../engagement/model';
import { DbFieldRegion } from '../../field-region/model';
import { DbFieldZone } from '../../field-zone/model';
import { DbDirectory, DbFile } from '../../file/model';
import { DbFileVersion } from '../../file/model/file-version.model.db';
import { DbFilm } from '../../film/model';
import { DbFundingAccount } from '../../funding-account/model';
import { DbEthnologueLanguage, DbLanguage } from '../../language/model';
import { DbLiteracyMaterial } from '../../literacy-material/model';
import { DbLocation } from '../../location/model';
import { DbOrganization } from '../../organization/model';
import { DbPartner } from '../../partner/model';
import { DbPartnership } from '../../partnership/model';
import { DbPeriodicReport } from '../../periodic-report/model';
import { DbPost } from '../../post/model';
import { StepProgress } from '../../product-progress/dto';
import { DbProduct } from '../../product/model';
import { DbProjectChangeRequest } from '../../project-change-request/model';
/* eslint-disable @typescript-eslint/naming-convention */
import { DbProject } from '../../project/model';
import { DbProjectMember } from '../../project/project-member/model';
import { DbSong } from '../../song/model';
import { DbStory } from '../../story/model';
import { DbEducation, DbUnavailability, DbUser } from '../../user/model';
import { Role } from '../dto';
import { Powers } from '../dto/powers';
import { DbBaseNodeGrant, DbRole } from '../model';

// do not auto format this file
// turned off prettier for role files to prevent auto-format making this file huge

const read = true;
const write = true;

export const Fundraising = new DbRole({
  name: `global:${Role.Fundraising}` as const,
  powers: [
    Powers.CreateEducation,
    Powers.CreateUnavailability,
    Powers.CreateUser,
  ],
  grants: [
    new DbBaseNodeGrant<DbBudget>({
      __className: 'DbBudget',
      canList: true,
      properties: [
        { propertyName: 'universalTemplateFile', permission: { read, }, },
        { propertyName: 'records', permission: { read, }, },
        { propertyName: 'status', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbBudgetRecord>({
      __className: 'DbBudgetRecord',
      properties: [
        { propertyName: 'amount', permission: { read, }, },
        { propertyName: 'fiscalYear', permission: { read, }, },
        { propertyName: 'organization', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbCeremony>({
      __className: 'DbCeremony',
      canList: true,
      properties: [
        { propertyName: 'actualDate', permission: { read, }, },
        { propertyName: 'estimatedDate', permission: { read, }, },
        { propertyName: 'planned', permission: { read, }, },
        { propertyName: 'type', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbDirectory>({
      __className: 'DbDirectory',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'createdBy', permission: { read, }, },
        { propertyName: 'parent', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbEducation>({
      __className: 'DbEducation',
      properties: [
        { propertyName: 'degree', permission: { read, }, },
        { propertyName: 'institution', permission: { read, }, },
        { propertyName: 'major', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbEthnologueLanguage>({
      __className: 'DbEthnologueLanguage',
      properties: [
        { propertyName: 'code',            permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'name',            permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'population',      permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'provisionalCode', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbFieldRegion>({
      __className: 'DbFieldRegion',
      properties: [
        { propertyName: 'director', permission: { read, }, },
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'fieldZone', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbFieldZone>({
      __className: 'DbFieldZone',
      properties: [
        { propertyName: 'director', permission: { read, }, },
        { propertyName: 'name', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbFile>({
      __className: 'DbFile',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'createdBy', permission: { read, }, },
        { propertyName: 'parent', permission: { read, }, },
        { propertyName: 'mimeType', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbFileVersion>({
      __className: 'DbFileVersion',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'createdBy', permission: { read, }, },
        { propertyName: 'parent', permission: { read, }, },
        { propertyName: 'mimeType', permission: { read, }, },
        { propertyName: 'size', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbFilm>({
      __className: 'DbFilm',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'scriptureReferences', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbFundingAccount>({
      __className: 'DbFundingAccount',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'accountNumber', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbInternshipEngagement>({
      __className: 'DbInternshipEngagement',
      properties: [
        { propertyName: 'ceremony', permission: { read, }, },
        { propertyName: 'completeDate', permission: { read, }, },
        { propertyName: 'countryOfOrigin', permission: { read, }, },
        { propertyName: 'disbursementCompleteDate', permission: { read, }, },
        { propertyName: 'endDate', permission: { read, }, },
        { propertyName: 'endDateOverride', permission: { read, }, },
        { propertyName: 'growthPlan', permission: { read, }, },
        { propertyName: 'initialEndDate', permission: { read, }, },
        { propertyName: 'intern', permission: { read, }, },
        { propertyName: 'lastReactivatedAt', permission: { read, }, },
        { propertyName: 'lastSuspendedAt', permission: { read, }, },
        { propertyName: 'mentor', permission: { read, }, },
        { propertyName: 'methodologies', permission: { read, }, },
        { propertyName: 'position', permission: { read, }, },
        { propertyName: 'startDate', permission: { read, }, },
        { propertyName: 'startDateOverride', permission: { read, }, },
        { propertyName: 'statusModifiedAt', permission: { read, }, },
        { propertyName: 'modifiedAt', permission: { read, }, },
        { propertyName: 'status', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbLanguage>({
      __className: 'DbLanguage',
      properties: [
        { propertyName: 'displayName', permission: { read, }, },
        { propertyName: 'displayNamePronunciation', permission: { read, }, },
        { propertyName: 'isDialect', permission: { read, }, },
        { propertyName: 'isSignLanguage', permission: { read, }, },
        { propertyName: 'leastOfThese', permission: { read, }, },
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'leastOfTheseReason', permission: { read, }, },
        { propertyName: 'populationOverride', permission: { read, }, },
        { propertyName: 'registryOfDialectsCode', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'signLanguageCode', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'sponsorEstimatedEndDate', permission: { read, }, },
        { propertyName: 'ethnologue', permission: { read, }, },
        { propertyName: 'sensitivity', permission: { read, }, },
        { propertyName: 'hasExternalFirstScripture', permission: { read, }, },
        { propertyName: 'locations', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'tags', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbLanguageEngagement>({
      __className: 'DbLanguageEngagement',
      properties: [
        { propertyName: 'ceremony', permission: { read, }, },
        { propertyName: 'completeDate', permission: { read, }, },
        { propertyName: 'disbursementCompleteDate', permission: { read, }, },
        { propertyName: 'endDate', permission: { read, }, },
        { propertyName: 'endDateOverride', permission: { read, }, },
        { propertyName: 'firstScripture', permission: { read, }, },
        { propertyName: 'initialEndDate', permission: { read, }, },
        { propertyName: 'language', permission: { read, }, },
        { propertyName: 'lastReactivatedAt', permission: { read, }, },
        { propertyName: 'lastSuspendedAt', permission: { read, }, },
        { propertyName: 'lukePartnership', permission: { read, }, },
        { propertyName: 'paratextRegistryId', permission: { read, }, },
        { propertyName: 'pnp', permission: { read, }, },
        { propertyName: 'historicGoal', permission: { read, }, },
        { propertyName: 'sentPrintingDate', permission: { read, }, },
        { propertyName: 'startDate', permission: { read, }, },
        { propertyName: 'startDateOverride', permission: { read, }, },
        { propertyName: 'statusModifiedAt', permission: { read, }, },
        { propertyName: 'modifiedAt', permission: { read, }, },
        { propertyName: 'product', permission: { read, }, },
        { propertyName: 'status', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbLiteracyMaterial>({
      __className: 'DbLiteracyMaterial',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'scriptureReferences', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbLocation>({
      __className: 'DbLocation',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'type', permission: { read, }, },
        { propertyName: 'sensitivity', permission: { read, }, },
        { propertyName: 'isoAlpha3', permission: { read, }, },
        { propertyName: 'fundingAccount', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbOrganization>({
      __className: 'DbOrganization',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'address', permission: { read, }, },
        { propertyName: 'locations', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbPartner>({
      __className: 'DbPartner',
      canList: true,
      properties: [
        { propertyName: 'organization', permission: { read, }, },
        { propertyName: 'pointOfContact', permission: { read, }, },
        { propertyName: 'types', permission: { read, }, },
        { propertyName: 'financialReportingTypes', permission: { read, }, },
        { propertyName: 'pmcEntityCode', permission: { read, }, },
        { propertyName: 'globalInnovationsClient', permission: { read, }, },
        { propertyName: 'active', permission: { read, }, },
        { propertyName: 'address', permission: { read, }, },
        { propertyName: 'modifiedAt', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbPartnership>({
      __className: 'DbPartnership',
      canList: true,
      properties: [
        { propertyName: 'agreement', permission: { read, }, },
        { propertyName: 'agreementStatus', permission: { read, }, },
        { propertyName: 'financialReportingType', permission: { read, }, },
        { propertyName: 'mou', permission: { read, }, },
        { propertyName: 'mouEnd', permission: { read, }, },
        { propertyName: 'mouEndOverride', permission: { read, }, },
        { propertyName: 'mouStart', permission: { read, }, },
        { propertyName: 'mouStartOverride', permission: { read, }, },
        { propertyName: 'mouStatus', permission: { read, }, },
        { propertyName: 'types', permission: { read, }, },
        { propertyName: 'organization', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'partner', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'primary', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbPost>({
      __className: 'DbPost',
      properties: [
        { propertyName: 'body', permission: { read, }, },
        { propertyName: 'creator', permission: { read, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbProduct>({
      __className: 'DbProduct',
      properties: [
        { propertyName: 'mediums', permission: { read, }, },
        { propertyName: 'methodology', permission: { read, }, },
        { propertyName: 'purposes', permission: { read, }, },
        { propertyName: 'steps', permission: { read, }, },
        { propertyName: 'scriptureReferences', permission: { read, }, },
        { propertyName: 'produces', permission: { read, }, },
        { propertyName: 'scriptureReferencesOverride', permission: { read, }, },
        { propertyName: 'isOverriding', permission: { read, }, },
        { propertyName: 'describeCompletion', permission: { read, }, },
        { propertyName: 'progressStepMeasurement', permission: { read, }, },
        { propertyName: 'progressTarget', permission: { read, }, },
        { propertyName: 'title', permission: { read, }, },
        { propertyName: 'description', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbProject>({
      __className: 'DbProject',
      canList: true,
      properties: [
        { propertyName: 'estimatedSubmission', permission: { read, }, },
        { propertyName: 'step', permission: { read, }, },
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'status', permission: { read, }, },
        { propertyName: 'departmentId', permission: { read, }, },
        { propertyName: 'mouStart', permission: { read, }, },
        { propertyName: 'mouEnd', permission: { read, }, },
        { propertyName: 'initialMouEnd', permission: { read, }, },
        { propertyName: 'stepChangedAt', permission: { read, }, },
        { propertyName: 'rootDirectory', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'member', permission: { read, }, },
        { propertyName: 'otherLocations', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'primaryLocation', permission: { read, sensitivityAccess: Sensitivity.Medium }, },
        { propertyName: 'marketingLocation', permission: { read, }, },
        { propertyName: 'partnership', permission: { read, }, },
        { propertyName: 'budget', permission: { read, }, },
        { propertyName: 'modifiedAt', permission: { read, }, },
        { propertyName: 'fieldRegion', permission: { read, }, },
        { propertyName: 'engagement', permission: { read, }, },
        { propertyName: 'sensitivity', permission: { read, }, },
        { propertyName: 'tags', permission: { read, }, },
        { propertyName: 'financialReportReceivedAt', permission: { read, }, },
        { propertyName: 'owningOrganization', permission: { read, }, },
        { propertyName: 'posts', permission: { read, write, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbProjectMember>({
      __className: 'DbProjectMember',
      canList: true,
      properties: [
        { propertyName: 'roles', permission: { read, }, },
        { propertyName: 'user', permission: { read, }, },
        { propertyName: 'modifiedAt', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbPeriodicReport>({
      __className: 'DbPeriodicReport',
      properties: [
        { propertyName: 'type', permission: { read, }, },
        { propertyName: 'start', permission: { read, }, },
        { propertyName: 'end', permission: { read, }, },
        { propertyName: 'receivedDate', permission: { read, }, },
        { propertyName: 'reportFile', permission: { read, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbUser>({
      __className: 'DbUser',
      properties: [
        { propertyName: 'about', permission: { read, }, },
        { propertyName: 'displayFirstName', permission: { read, }, },
        { propertyName: 'displayLastName', permission: { read, }, },
        { propertyName: 'email', permission: { read, }, },
        { propertyName: 'phone', permission: { read, }, },
        { propertyName: 'realFirstName', permission: { read, }, },
        { propertyName: 'realLastName', permission: { read, }, },
        { propertyName: 'roles', permission: { read, }, },
        { propertyName: 'status', permission: { read, }, },
        { propertyName: 'timezone', permission: { read, }, },
        { propertyName: 'title', permission: { read, }, },
        { propertyName: 'education', permission: { read, }, },
        { propertyName: 'organization', permission: { read, }, },
        { propertyName: 'unavailability', permission: { read, }, },
        { propertyName: 'locations', permission: { read, }, },
        { propertyName: 'knownLanguage', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbUnavailability>({
      __className: 'DbUnavailability',
      properties: [
        { propertyName: 'description', permission: { read, }, },
        { propertyName: 'end', permission: { read, }, },
        { propertyName: 'start', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbSong>({
      __className: 'DbSong',
      properties: [
        { propertyName: 'name', permission: { read, }, },
        { propertyName: 'scriptureReferences', permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbStory>({
      __className: 'DbStory',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'scriptureReferences',        permission: { read, }, },
      ],
      canDelete: false,
    }),
    new DbBaseNodeGrant<DbProjectChangeRequest>({
      __className: 'DbProjectChangeRequest',
      properties: [
        { propertyName: 'types',                       permission: { read, }, },
        { propertyName: 'summary',                     permission: { read, }, },
        { propertyName: 'status',                      permission: { read, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<StepProgress>({
      __className: 'DbStepProgress',
      properties: [
        {
          propertyName: 'completed', permission: { read },
        }
      ],
      canDelete: false,
    }),
  ],
});
