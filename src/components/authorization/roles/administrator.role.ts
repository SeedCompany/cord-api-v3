import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import { DbInternshipEngagement, DbLanguageEngagement } from '../../engagement/model';
import { DbEthnoArt } from '../../ethno-art/model';
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

export const Administrator = new DbRole({
  name: `global:${Role.Administrator}` as const,
  powers: [...(Object.keys(Powers) as Powers[])],
  grants: [
    new DbBaseNodeGrant<DbBudget>({
      __className: 'DbBudget',
      canList: true,
      properties: [
        { propertyName: 'universalTemplateFile', permission: { read, write, }, },
        { propertyName: 'records', permission: { read, write, }, },
        { propertyName: 'status', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbBudgetRecord>({
      __className: 'DbBudgetRecord',
      properties: [
        { propertyName: 'amount', permission: { read, write, }, },
        { propertyName: 'fiscalYear', permission: { read, write, }, },
        { propertyName: 'organization', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbCeremony>({
      __className: 'DbCeremony',
      canList: true,
      properties: [
        { propertyName: 'actualDate', permission: { read, write, }, },
        { propertyName: 'estimatedDate', permission: { read, write, }, },
        { propertyName: 'planned', permission: { read, write, }, },
        { propertyName: 'type', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbDirectory>({
      __className: 'DbDirectory',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'createdBy', permission: { read, write, }, },
        { propertyName: 'parent', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbEducation>({
      __className: 'DbEducation',
      properties: [
        { propertyName: 'degree', permission: { read, write, }, },
        { propertyName: 'institution', permission: { read, write, }, },
        { propertyName: 'major', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbEthnoArt>({
      __className: 'DbEthnoArt',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'scriptureReferences', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbEthnologueLanguage>({
      __className: 'DbEthnologueLanguage',
      properties: [
        { propertyName: 'code', permission: { read, write, }, },
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'population', permission: { read, write, }, },
        { propertyName: 'provisionalCode', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbFieldRegion>({
      __className: 'DbFieldRegion',
      canList: true,
      properties: [
        { propertyName: 'director', permission: { read, write, }, },
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'fieldZone', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbFieldZone>({
      __className: 'DbFieldZone',
      canList: true,
      properties: [
        { propertyName: 'director', permission: { read, write, }, },
        { propertyName: 'name', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbFile>({
      __className: 'DbFile',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'createdBy', permission: { read, write, }, },
        { propertyName: 'parent', permission: { read, write, }, },
        { propertyName: 'mimeType', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbFileVersion>({
      __className: 'DbFileVersion',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'createdBy', permission: { read, write, }, },
        { propertyName: 'parent', permission: { read, write, }, },
        { propertyName: 'mimeType', permission: { read, write, }, },
        { propertyName: 'size', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbFilm>({
      __className: 'DbFilm',
      canList: true,
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'scriptureReferences', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbFundingAccount>({
      __className: 'DbFundingAccount',
      canList: true,
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'accountNumber', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbInternshipEngagement>({
      __className: 'DbInternshipEngagement',
      canList: true,
      properties: [
        { propertyName: 'ceremony', permission: { read, write, }, },
        { propertyName: 'completeDate', permission: { read, write, }, },
        { propertyName: 'countryOfOrigin', permission: { read, write, }, },
        { propertyName: 'disbursementCompleteDate', permission: { read, write, }, },
        { propertyName: 'endDate', permission: { read, write, }, },
        { propertyName: 'endDateOverride', permission: { read, write, }, },
        { propertyName: 'growthPlan', permission: { read, write, }, },
        { propertyName: 'initialEndDate', permission: { read, write, }, },
        { propertyName: 'intern', permission: { read, write, }, },
        { propertyName: 'lastReactivatedAt', permission: { read, write, }, },
        { propertyName: 'lastSuspendedAt', permission: { read, write, }, },
        { propertyName: 'mentor', permission: { read, write, }, },
        { propertyName: 'methodologies', permission: { read, write, }, },
        { propertyName: 'position', permission: { read, write, }, },
        { propertyName: 'startDate', permission: { read, write, }, },
        { propertyName: 'startDateOverride', permission: { read, write, }, },
        { propertyName: 'statusModifiedAt', permission: { read, write, }, },
        { propertyName: 'modifiedAt', permission: { read, write, }, },
        { propertyName: 'status', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbLanguage>({
      __className: 'DbLanguage',
      canList: true,
      properties: [
        { propertyName: 'displayName', permission: { read, write, }, },
        { propertyName: 'displayNamePronunciation', permission: { read, write, }, },
        { propertyName: 'isDialect', permission: { read, write, }, },
        { propertyName: 'isSignLanguage', permission: { read, write, }, },
        { propertyName: 'leastOfThese', permission: { read, write, }, },
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'leastOfTheseReason', permission: { read, write, }, },
        { propertyName: 'populationOverride', permission: { read, write, }, },
        { propertyName: 'registryOfDialectsCode', permission: { read, write, }, },
        { propertyName: 'signLanguageCode', permission: { read, write, }, },
        { propertyName: 'sponsorEstimatedEndDate', permission: { read, write, }, },
        { propertyName: 'ethnologue', permission: { read, write, }, },
        { propertyName: 'sensitivity', permission: { read, write, }, },
        { propertyName: 'hasExternalFirstScripture', permission: { read, write, }, },
        { propertyName: 'locations', permission: { read, write, }, },
        { propertyName: 'tags', permission: { read, write, }, },
        { propertyName: 'presetInventory', permission: { read, write, }, },
        { propertyName: 'posts', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbLanguageEngagement>({
      __className: 'DbLanguageEngagement',
      canList: true,
      properties: [
        { propertyName: 'ceremony', permission: { read, write, }, },
        { propertyName: 'completeDate', permission: { read, write, }, },
        { propertyName: 'disbursementCompleteDate', permission: { read, write, }, },
        { propertyName: 'endDate', permission: { read, write, }, },
        { propertyName: 'endDateOverride', permission: { read, write, }, },
        { propertyName: 'firstScripture', permission: { read, write, }, },
        { propertyName: 'initialEndDate', permission: { read, write, }, },
        { propertyName: 'language', permission: { read, write, }, },
        { propertyName: 'lastReactivatedAt', permission: { read, write, }, },
        { propertyName: 'lastSuspendedAt', permission: { read, write, }, },
        { propertyName: 'lukePartnership', permission: { read, write, }, },
        { propertyName: 'openToInvestorVisit', permission: { read, write }, },
        { propertyName: 'paratextRegistryId', permission: { read, write, }, },
        { propertyName: 'pnp', permission: { read, write, }, },
        { propertyName: 'historicGoal', permission: { read, write, }, },
        { propertyName: 'sentPrintingDate', permission: { read, write, }, },
        { propertyName: 'startDate', permission: { read, write, }, },
        { propertyName: 'startDateOverride', permission: { read, write, }, },
        { propertyName: 'statusModifiedAt', permission: { read, write, }, },
        { propertyName: 'modifiedAt', permission: { read, write, }, },
        { propertyName: 'product', permission: { read, write, }, },
        { propertyName: 'status', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbLiteracyMaterial>({
      __className: 'DbLiteracyMaterial',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'scriptureReferences', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbLocation>({
      __className: 'DbLocation',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'type', permission: { read, write, }, },
        { propertyName: 'sensitivity', permission: { read, write, }, },
        { propertyName: 'isoAlpha3', permission: { read, write, }, },
        { propertyName: 'fundingAccount', permission: { read, write, }, },
        { propertyName: 'defaultFieldRegion', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbOrganization>({
      __className: 'DbOrganization',
      canList: true,
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'address', permission: { read, write, }, },
        { propertyName: 'locations', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbPartner>({
      __className: 'DbPartner',
      canList: true,
      properties: [
        { propertyName: 'organization', permission: { read, write, }, },
        { propertyName: 'pointOfContact', permission: { read, write, }, },
        { propertyName: 'types', permission: { read, write, }, },
        { propertyName: 'financialReportingTypes', permission: { read, write, }, },
        { propertyName: 'pmcEntityCode', permission: { read, write, }, },
        { propertyName: 'globalInnovationsClient', permission: { read, write, }, },
        { propertyName: 'active', permission: { read, write, }, },
        { propertyName: 'address', permission: { read, write, }, },
        { propertyName: 'modifiedAt', permission: { read, write, }, },
        { propertyName: 'posts', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbPartnership>({
      __className: 'DbPartnership',
      canList: true,
      properties: [
        { propertyName: 'agreement', permission: { read, write, }, },
        { propertyName: 'agreementStatus', permission: { read, write, }, },
        { propertyName: 'financialReportingType', permission: { read, write, }, },
        { propertyName: 'mou', permission: { read, write, }, },
        { propertyName: 'mouEnd', permission: { read, write, }, },
        { propertyName: 'mouEndOverride', permission: { read, write, }, },
        { propertyName: 'mouStart', permission: { read, write, }, },
        { propertyName: 'mouStartOverride', permission: { read, write, }, },
        { propertyName: 'mouStatus', permission: { read, write, }, },
        { propertyName: 'types', permission: { read, write, }, },
        { propertyName: 'organization', permission: { read, write, }, },
        { propertyName: 'partner', permission: { read, write, }, },
        { propertyName: 'primary', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbPost>({
      __className: 'DbPost',
      properties: [
        { propertyName: 'body', permission: { read, write, }, },
        { propertyName: 'creator', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbProduct>({
      __className: 'DbProduct',
      properties: [
        { propertyName: 'mediums', permission: { read, write, }, },
        { propertyName: 'methodology', permission: { read, write, }, },
        { propertyName: 'purposes', permission: { read, write, }, },
        { propertyName: 'steps', permission: { read, write, }, },
        { propertyName: 'scriptureReferences', permission: { read, write, }, },
        { propertyName: 'produces', permission: { read, write, }, },
        { propertyName: 'scriptureReferencesOverride', permission: { read, write, }, },
        { propertyName: 'isOverriding', permission: { read, write, }, },
        { propertyName: 'describeCompletion', permission: { read, write, }, },
        { propertyName: 'progressStepMeasurement', permission: { read, write, }, },
        { propertyName: 'progressTarget', permission: { read, write, }, },
        { propertyName: 'title', permission: { read, write, }, },
        { propertyName: 'description', permission: { read, write, }, },
        { propertyName: 'unspecifiedScripture', permission: { read, write, }, },
        { propertyName: 'placeholderDescription', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbProject>({
      __className: 'DbProject',
      canList: true,
      properties: [
        { propertyName: 'estimatedSubmission', permission: { read, write, }, },
        { propertyName: 'step', permission: { read, write, }, },
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'status', permission: { read, write, }, },
        { propertyName: 'departmentId', permission: { read, write, }, },
        { propertyName: 'mouStart', permission: { read, write, }, },
        { propertyName: 'mouEnd', permission: { read, write, }, },
        { propertyName: 'initialMouEnd', permission: { read, write, }, },
        { propertyName: 'stepChangedAt', permission: { read, write, }, },
        { propertyName: 'rootDirectory', permission: { read, }, },
        { propertyName: 'member', permission: { read, write, }, },
        { propertyName: 'otherLocations', permission: { read, write, }, },
        { propertyName: 'primaryLocation', permission: { read, write, }, },
        { propertyName: 'marketingLocation', permission: { read, write, }, },
        { propertyName: 'partnership', permission: { read, write, }, },
        { propertyName: 'budget', permission: { read, write, }, },
        { propertyName: 'modifiedAt', permission: { read, write, }, },
        { propertyName: 'fieldRegion', permission: { read, write, }, },
        { propertyName: 'engagement', permission: { read, write, }, },
        { propertyName: 'sensitivity', permission: { read, write, }, },
        { propertyName: 'tags', permission: { read, write, }, },
        { propertyName: 'financialReportReceivedAt', permission: { read, write, }, },
        { propertyName: 'financialReportPeriod', permission: { read, write, }, },
        { propertyName: 'owningOrganization', permission: { read, write, }, },
        { propertyName: 'posts', permission: { read, write, }, },
        { propertyName: 'presetInventory', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbProjectMember>({
      __className: 'DbProjectMember',
      canList: true,
      properties: [
        { propertyName: 'roles', permission: { read, write, }, },
        { propertyName: 'user', permission: { read, write, }, },
        { propertyName: 'modifiedAt', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbPeriodicReport>({
      __className: 'DbPeriodicReport',
      properties: [
        { propertyName: 'type', permission: { read, write, }, },
        { propertyName: 'start', permission: { read, write, }, },
        { propertyName: 'end', permission: { read, write, }, },
        { propertyName: 'receivedDate', permission: { read, write, }, },
        { propertyName: 'directory', permission: { read, write, }, },
        { propertyName: 'pnp', permission: { read, write, }, },
        { propertyName: 'skippedReason', permission: { read, write }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbUser>({
      __className: 'DbUser',
      canList: true,
      properties: [
        { propertyName: 'about', permission: { read, write, }, },
        { propertyName: 'displayFirstName', permission: { read, write, }, },
        { propertyName: 'displayLastName', permission: { read, write, }, },
        { propertyName: 'email', permission: { read, write, }, },
        { propertyName: 'phone', permission: { read, write, }, },
        { propertyName: 'realFirstName', permission: { read, write, }, },
        { propertyName: 'realLastName', permission: { read, write, }, },
        { propertyName: 'roles', permission: { read, write, }, },
        { propertyName: 'status', permission: { read, write, }, },
        { propertyName: 'timezone', permission: { read, write, }, },
        { propertyName: 'title', permission: { read, write, }, },
        { propertyName: 'education', permission: { read, write, }, },
        { propertyName: 'organization', permission: { read, write, }, },
        { propertyName: 'partner', permission: { read, write, }, },
        { propertyName: 'unavailability', permission: { read, write, }, },
        { propertyName: 'locations', permission: { read, write, }, },
        { propertyName: 'knownLanguage', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbUnavailability>({
      __className: 'DbUnavailability',
      properties: [
        { propertyName: 'description', permission: { read, write, }, },
        { propertyName: 'end', permission: { read, write, }, },
        { propertyName: 'start', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbSong>({
      __className: 'DbSong',
      properties: [
        { propertyName: 'name', permission: { read, write, }, },
        { propertyName: 'scriptureReferences', permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbStory>({
      __className: 'DbStory',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'scriptureReferences',        permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<DbProjectChangeRequest>({
      __className: 'DbProjectChangeRequest',
      properties: [
        { propertyName: 'types',                       permission: { read, write, }, },
        { propertyName: 'summary',                     permission: { read, write, }, },
        { propertyName: 'status',                      permission: { read, write, }, },
      ],
      canDelete: true,
    }),
    new DbBaseNodeGrant<StepProgress>({
      __className: 'DbStepProgress',
      properties: [
        {
          propertyName: 'completed', permission: { read, write },
        }
      ],
      canDelete: false,
    }),
  ],
});
