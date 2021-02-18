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
import { DbProduct } from '../../product/model';
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

export const ConsultantManager = new DbRole({
  name: Role.ConsultantManager,
  powers: [
    Powers.CreateDirectory,
    Powers.CreateEducation,
    Powers.CreateFile,
    Powers.CreateFileVersion,
    Powers.CreateFilm,
    Powers.CreateLiteracyMaterial,
    Powers.CreateProduct,
    Powers.CreateProjectMember,
    Powers.CreateSong,
    Powers.CreateStory,
    Powers.CreateUnavailability,
    Powers.CreateUser,
  ],
  grants: [
    new DbBaseNodeGrant<DbBudget>({
      __className: 'DbBudget',
      properties: [
        { propertyName: 'universalTemplateFile',      permission: { read,       write: false,  }, },
        { propertyName: 'records',                    permission: { read,       write: false,  }, },
        { propertyName: 'status',                     permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbBudgetRecord>({
      __className: 'DbBudgetRecord',
      properties: [
        { propertyName: 'amount',                     permission: { read,       write: false,  }, },
        { propertyName: 'fiscalYear',                 permission: { read,       write: false,  }, },
        { propertyName: 'organization',               permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbCeremony>({
      __className: 'DbCeremony',
      properties: [
        { propertyName: 'actualDate',                 permission: { read,       write: false,  }, },
        { propertyName: 'estimatedDate',              permission: { read,       write: false,  }, },
        { propertyName: 'planned',                    permission: { read,       write: false,  }, },
        { propertyName: 'type',                       permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbDirectory>({
      __className: 'DbDirectory',
      properties: [
        { propertyName: 'name',                       permission: { read,       write,         }, },
        { propertyName: 'createdBy',                  permission: { read,       write,         }, },
        { propertyName: 'parent',                     permission: { read,       write,         }, },
    ]}),
    new DbBaseNodeGrant<DbEducation>({
      __className: 'DbEducation',
      properties: [
        { propertyName: 'degree',                     permission: { read,       write: false,  }, },
        { propertyName: 'institution',                permission: { read,       write: false,  }, },
        { propertyName: 'major',                      permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbEthnologueLanguage>({
      __className: 'DbEthnologueLanguage',
      properties: [
        { propertyName: 'code',                       permission: { read,       write: false,  }, },
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'population',                 permission: { read,       write: false,  }, },
        { propertyName: 'provisionalCode',            permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbFieldRegion>({
      __className: 'DbFieldRegion',
      properties: [
        { propertyName: 'director',                   permission: { read,       write: false,  }, },
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'fieldZone',                  permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbFieldZone>({
      __className: 'DbFieldZone',
      properties: [
        { propertyName: 'director',                   permission: { read,       write: false,  }, },
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbFile>({
      __className: 'DbFile',
      properties: [
        { propertyName: 'name',                       permission: { read,       write,         }, },
        { propertyName: 'createdBy',                  permission: { read,       write,         }, },
        { propertyName: 'parent',                     permission: { read,       write,         }, },
        { propertyName: 'mimeType',                   permission: { read,       write,         }, },
    ]}),
    new DbBaseNodeGrant<DbFileVersion>({
      __className: 'DbFileVersion',
      properties: [
        { propertyName: 'name',                       permission: { read,       write,         }, },
        { propertyName: 'createdBy',                  permission: { read,       write,         }, },
        { propertyName: 'parent',                     permission: { read,       write,         }, },
        { propertyName: 'mimeType',                   permission: { read,       write,         }, },
        { propertyName: 'size',                       permission: { read,       write,         }, },
    ]}),
    new DbBaseNodeGrant<DbFilm>({
      __className: 'DbFilm',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'scriptureReferences',        permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbFundingAccount>({
      __className: 'DbFundingAccount',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'accountNumber',              permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbInternshipEngagement>({
      __className: 'DbInternshipEngagement',
      properties: [
        { propertyName: 'ceremony',                   permission: { read,       write,         }, },
        { propertyName: 'communicationsCompleteDate', permission: { read,       write,         }, },
        { propertyName: 'completeDate',               permission: { read,       write,         }, },
        { propertyName: 'countryOfOrigin',            permission: { read,       write,         }, },
        { propertyName: 'disbursementCompleteDate',   permission: { read,       write,         }, },
        { propertyName: 'endDate',                    permission: { read,       write,         }, },
        { propertyName: 'endDateOverride',            permission: { read,       write,         }, },
        { propertyName: 'growthPlan',                 permission: { read,       write,         }, },
        { propertyName: 'initialEndDate',             permission: { read,       write,         }, },
        { propertyName: 'intern',                     permission: { read,       write,         }, },
        { propertyName: 'lastReactivatedAt',          permission: { read,       write,         }, },
        { propertyName: 'lastSuspendedAt',            permission: { read,       write,         }, },
        { propertyName: 'mentor',                     permission: { read,       write,         }, },
        { propertyName: 'methodologies',              permission: { read,       write,         }, },
        { propertyName: 'position',                   permission: { read,       write,         }, },
        { propertyName: 'startDate',                  permission: { read,       write,         }, },
        { propertyName: 'startDateOverride',          permission: { read,       write,         }, },
        { propertyName: 'statusModifiedAt',           permission: { read,       write,         }, },
        { propertyName: 'modifiedAt',                 permission: { read,       write,         }, },
        { propertyName: 'status',                     permission: { read,       write,         }, },
    ]}),
    new DbBaseNodeGrant<DbLanguage>({
      __className: 'DbLanguage',
      properties: [
        { propertyName: 'displayName',                permission: { read,       write: false,  }, },
        { propertyName: 'displayNamePronunciation',   permission: { read,       write: false,  }, },
        { propertyName: 'isDialect',                  permission: { read,       write: false,  }, },
        { propertyName: 'isSignLanguage',             permission: { read,       write: false,  }, },
        { propertyName: 'leastOfThese',               permission: { read,       write: false,  }, },
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'leastOfTheseReason',         permission: { read,       write: false,  }, },
        { propertyName: 'populationOverride',         permission: { read,       write: false,  }, },
        { propertyName: 'registryOfDialectsCode',     permission: { read,       write: false,  }, },
        { propertyName: 'signLanguageCode',           permission: { read,       write: false,  }, },
        { propertyName: 'sponsorEstimatedEndDate',    permission: { read,       write: false,  }, },
        { propertyName: 'ethnologue',                 permission: { read,       write: false,  }, },
        { propertyName: 'sensitivity',                permission: { read,       write: false,  }, },
        { propertyName: 'hasExternalFirstScripture',  permission: { read,       write: false,  }, },
        { propertyName: 'locations',                  permission: { read,       write: false,  }, },
        { propertyName: 'tags',                       permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbLanguageEngagement>({
      __className: 'DbLanguageEngagement',
      properties: [
        { propertyName: 'ceremony',                   permission: { read,       write,         }, },
        { propertyName: 'communicationsCompleteDate', permission: { read,       write,         }, },
        { propertyName: 'completeDate',               permission: { read,       write,         }, },
        { propertyName: 'disbursementCompleteDate',   permission: { read,       write,         }, },
        { propertyName: 'endDate',                    permission: { read,       write,         }, },
        { propertyName: 'endDateOverride',            permission: { read,       write,         }, },
        { propertyName: 'firstScripture',             permission: { read,       write,         }, },
        { propertyName: 'initialEndDate',             permission: { read,       write,         }, },
        { propertyName: 'language',                   permission: { read,       write,         }, },
        { propertyName: 'lastReactivatedAt',          permission: { read,       write,         }, },
        { propertyName: 'lastSuspendedAt',            permission: { read,       write,         }, },
        { propertyName: 'lukePartnership',            permission: { read,       write,         }, },
        { propertyName: 'paratextRegistryId',         permission: { read,       write,         }, },
        { propertyName: 'pnp',                        permission: { read,       write,         }, },
        { propertyName: 'historicGoal',               permission: { read,       write,         }, },
        { propertyName: 'sentPrintingDate',           permission: { read,       write,         }, },
        { propertyName: 'startDate',                  permission: { read,       write,         }, },
        { propertyName: 'startDateOverride',          permission: { read,       write,         }, },
        { propertyName: 'statusModifiedAt',           permission: { read,       write,         }, },
        { propertyName: 'modifiedAt',                 permission: { read,       write,         }, },
        { propertyName: 'product',                    permission: { read,       write,         }, },
        { propertyName: 'status',                     permission: { read,       write,         }, },
    ]}),
    new DbBaseNodeGrant<DbLiteracyMaterial>({
      __className: 'DbLiteracyMaterial',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'scriptureReferences',        permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbLocation>({
      __className: 'DbLocation',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'type',                       permission: { read,       write: false,  }, },
        { propertyName: 'sensitivity',                permission: { read,       write: false,  }, },
        { propertyName: 'isoAlpha3',                  permission: { read,       write: false,  }, },
        { propertyName: 'fundingAccount',             permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbOrganization>({
      __className: 'DbOrganization',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'address',                    permission: { read,       write: false,  }, },
        { propertyName: 'locations',                  permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbPartner>({
      __className: 'DbPartner',
      properties: [
        { propertyName: 'organization',               permission: { read,       write: false,  }, },
        { propertyName: 'pointOfContact',             permission: { read,       write: false,  }, },
        { propertyName: 'types',                      permission: { read,       write: false,  }, },
        { propertyName: 'financialReportingTypes',    permission: { read,       write: false,  }, },
        { propertyName: 'pmcEntityCode',              permission: { read,       write: false,  }, },
        { propertyName: 'globalInnovationsClient',    permission: { read,       write: false,  }, },
        { propertyName: 'active',                     permission: { read,       write: false,  }, },
        { propertyName: 'address',                    permission: { read,       write: false,  }, },
        { propertyName: 'modifiedAt',                 permission: { read,       write,         }, },
    ]}),
    new DbBaseNodeGrant<DbPartnership>({
      __className: 'DbPartnership',
      properties: [
        { propertyName: 'agreement',                  permission: { read,       write: false,  }, },
        { propertyName: 'agreementStatus',            permission: { read,       write: false,  }, },
        { propertyName: 'financialReportingType',     permission: { read,       write: false,  }, },
        { propertyName: 'mou',                        permission: { read,       write: false,  }, },
        { propertyName: 'mouEnd',                     permission: { read,       write: false,  }, },
        { propertyName: 'mouEndOverride',             permission: { read,       write: false,  }, },
        { propertyName: 'mouStart',                   permission: { read,       write: false,  }, },
        { propertyName: 'mouStartOverride',           permission: { read,       write: false,  }, },
        { propertyName: 'mouStatus',                  permission: { read,       write: false,  }, },
        { propertyName: 'types',                      permission: { read,       write: false,  }, },
        { propertyName: 'organization',               permission: { read,       write: false,  }, },
        { propertyName: 'partner',                    permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbProduct>({
      __className: 'DbProduct',
      properties: [
        { propertyName: 'mediums',                    permission: { read,       write: false,  }, },
        { propertyName: 'methodology',                permission: { read,       write: false,  }, },
        { propertyName: 'purposes',                   permission: { read,       write: false,  }, },
        { propertyName: 'scriptureReferences',        permission: { read,       write: false,  }, },
        { propertyName: 'produces',                   permission: { read,       write: false,  }, },
        { propertyName: 'scriptureReferencesOverride',permission: { read,       write: false,  }, },
        { propertyName: 'isOverriding',               permission: { read,       write: false,  }, },
      ]}),
    new DbBaseNodeGrant<DbProject>({
      __className: 'DbProject',
      properties: [
        { propertyName: 'estimatedSubmission',        permission: { read,       write,         }, },
        { propertyName: 'step',                       permission: { read,       write,         }, },
        { propertyName: 'name',                       permission: { read,       write,         }, },
        { propertyName: 'status',                     permission: { read,       write,         }, },
        { propertyName: 'departmentId',               permission: { read,       write,         }, },
        { propertyName: 'mouStart',                   permission: { read,       write,         }, },
        { propertyName: 'mouEnd',                     permission: { read,       write,         }, },
        { propertyName: 'initialMouEnd',              permission: { read,       write,         }, },
        { propertyName: 'stepChangedAt',              permission: { read,       write,         }, },
        { propertyName: 'rootDirectory',              permission: { read,       write,         }, },
        { propertyName: 'member',                     permission: { read,       write,         }, },
        { propertyName: 'otherLocations',             permission: { read,       write,         }, },
        { propertyName: 'primaryLocation',            permission: { read,       write,         }, },
        { propertyName: 'marketingLocation',          permission: { read,       write,         }, },
        { propertyName: 'partnership',                permission: { read,       write,         }, },
        { propertyName: 'budget',                     permission: { read,       write,         }, },
        { propertyName: 'modifiedAt',                 permission: { read,       write,         }, },
        { propertyName: 'fieldRegion',                permission: { read,       write,         }, },
        { propertyName: 'engagement',                 permission: { read,       write,         }, },
        { propertyName: 'sensitivity',                permission: { read,       write,         }, },
        { propertyName: 'tags',                       permission: { read,       write,         }, },
        { propertyName: 'financialReportReceivedAt',  permission: { read,       write,         }, },
        { propertyName: 'owningOrganization',         permission: { read,       write,         }, },
      ]}),
    new DbBaseNodeGrant<DbProjectMember>({
      __className: 'DbProjectMember',
      properties: [
        { propertyName: 'roles',                      permission: { read,       write,         }, },
        { propertyName: 'user',                       permission: { read,       write,         }, },
        { propertyName: 'modifiedAt',                 permission: { read,       write,         }, },
        ]}),
    new DbBaseNodeGrant<DbUser>({
      __className: 'DbUser',
      properties: [
        { propertyName: 'about',                      permission: { read,       write: false,  }, },
        { propertyName: 'displayFirstName',           permission: { read,       write: false,  }, },
        { propertyName: 'displayLastName',            permission: { read,       write: false,  }, },
        { propertyName: 'email',                      permission: { read,       write: false,  }, },
        { propertyName: 'phone',                      permission: { read,       write: false,  }, },
        { propertyName: 'realFirstName',              permission: { read,       write: false,  }, },
        { propertyName: 'realLastName',               permission: { read,       write: false,  }, },
        { propertyName: 'roles',                      permission: { read,       write: false,  }, },
        { propertyName: 'status',                     permission: { read,       write: false,  }, },
        { propertyName: 'timezone',                   permission: { read,       write: false,  }, },
        { propertyName: 'title',                      permission: { read,       write: false,  }, },
        { propertyName: 'education',                  permission: { read,       write: false,  }, },
        { propertyName: 'organization',               permission: { read,       write: false,  }, },
        { propertyName: 'unavailability',             permission: { read,       write: false,  }, },
        { propertyName: 'locations',                  permission: { read,       write: false,  }, },
        { propertyName: 'knownLanguage',              permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbUnavailability>({
      __className: 'DbUnavailability',
      properties: [
        { propertyName: 'description',                permission: { read,       write: false,  }, },
        { propertyName: 'end',                        permission: { read,       write: false,  }, },
        { propertyName: 'start',                      permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbSong>({
      __className: 'DbSong',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'scriptureReferences',        permission: { read,       write: false,  }, },
    ]}),
    new DbBaseNodeGrant<DbStory>({
      __className: 'DbStory',
      properties: [
        { propertyName: 'name',                       permission: { read,       write: false,  }, },
        { propertyName: 'scriptureReferences',        permission: { read,       write: false,  }, },
    ]}),
  ],
});
