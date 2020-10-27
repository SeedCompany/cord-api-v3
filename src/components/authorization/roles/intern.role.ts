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

export const Intern = new DbRole({
  name: Role.Intern,
  powers: [
    Powers.CreateDirectory,
    Powers.CreateEducation,
    Powers.CreateFile,
    Powers.CreateFileVersion,
    Powers.CreateUnavailability,
    Powers.CreateUser,
  ],
  grants: [
    new DbBaseNodeGrant<DbBudget>({
      __className: 'DbBudget',
      properties: [
        { propertyName: 'universalTemplateFile',      permission: { read, write, }, },
        { propertyName: 'records',                    permission: { read, write, }, },
        { propertyName: 'status',                     permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbBudgetRecord>({
      __className: 'DbBudgetRecord',
      properties: [
        { propertyName: 'amount',                     permission: { read, write, }, },
        { propertyName: 'fiscalYear',                 permission: { read, write, }, },
        { propertyName: 'organization',               permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbCeremony>({
      __className: 'DbCeremony',
      properties: [
        { propertyName: 'actualDate',                 permission: { read, write, }, },
        { propertyName: 'estimatedDate',              permission: { read, write, }, },
        { propertyName: 'planned',                    permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbDirectory>({
      __className: 'DbDirectory',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'createdBy',                  permission: { read, write, }, },
        { propertyName: 'parent',                     permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbEducation>({
      __className: 'DbEducation',
      properties: [
        { propertyName: 'degree',                     permission: { read, write, }, },
        { propertyName: 'institution',                permission: { read, write, }, },
        { propertyName: 'major',                      permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbEthnologueLanguage>({
      __className: 'DbEthnologueLanguage',
      properties: [
        { propertyName: 'code',                       permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'population',                 permission: { read, write, }, },
        { propertyName: 'provisionalCode',            permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbFieldRegion>({
      __className: 'DbFieldRegion',
      properties: [
        { propertyName: 'director',                   permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'fieldZone',                  permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbFieldZone>({
      __className: 'DbFieldZone',
      properties: [
        { propertyName: 'director',                   permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbFile>({
      __className: 'DbFile',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'createdBy',                  permission: { read, write, }, },
        { propertyName: 'parent',                     permission: { read, write, }, },
        { propertyName: 'mimeType',                   permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbFileVersion>({
      __className: 'DbFileVersion',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'createdBy',                  permission: { read, write, }, },
        { propertyName: 'parent',                     permission: { read, write, }, },
        { propertyName: 'mimeType',                   permission: { read, write, }, },
        { propertyName: 'size',                       permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbFilm>({
      __className: 'DbFilm',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'scriptureReferences',        permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbFundingAccount>({
      __className: 'DbFundingAccount',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'accountNumber',              permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbInternshipEngagement>({
      __className: 'DbInternshipEngagement',
      properties: [
        { propertyName: 'ceremony',                   permission: { read, write, }, },
        { propertyName: 'communicationsCompleteDate', permission: { read, write, }, },
        { propertyName: 'completeDate',               permission: { read, write, }, },
        { propertyName: 'countryOfOrigin',            permission: { read, write, }, },
        { propertyName: 'disbursementCompleteDate',   permission: { read, write, }, },
        { propertyName: 'endDate',                    permission: { read, write, }, },
        { propertyName: 'endDateOverride',            permission: { read, write, }, },
        { propertyName: 'growthPlan',                 permission: { read, write, }, },
        { propertyName: 'initialEndDate',             permission: { read, write, }, },
        { propertyName: 'intern',                     permission: { read, write, }, },
        { propertyName: 'lastReactivatedAt',          permission: { read, write, }, },
        { propertyName: 'lastSuspendedAt',            permission: { read, write, }, },
        { propertyName: 'mentor',                     permission: { read, write, }, },
        { propertyName: 'methodologies',              permission: { read, write, }, },
        { propertyName: 'position',                   permission: { read, write, }, },
        { propertyName: 'startDate',                  permission: { read, write, }, },
        { propertyName: 'startDateOverride',          permission: { read, write, }, },
        { propertyName: 'statusModifiedAt',           permission: { read, write, }, },
        { propertyName: 'modifiedAt',                 permission: { read, write, }, },
        { propertyName: 'status',                     permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbLanguage>({
      __className: 'DbLanguage',
      properties: [
        { propertyName: 'displayName',                permission: { read, write, }, },
        { propertyName: 'displayNamePronunciation',   permission: { read, write, }, },
        { propertyName: 'isDialect',                  permission: { read, write, }, },
        { propertyName: 'isSignLanguage',             permission: { read, write, }, },
        { propertyName: 'leastOfThese',               permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'leastOfTheseReason',         permission: { read, write, }, },
        { propertyName: 'populationOverride',         permission: { read, write, }, },
        { propertyName: 'registryOfDialectsCode',     permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'signLanguageCode',           permission: { read, write, }, },
        { propertyName: 'sponsorEstimatedEndDate',    permission: { read, write, }, },
        { propertyName: 'ethnologue',                 permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'sensitivity',                permission: { read, write, }, },
        { propertyName: 'hasExternalFirstScripture',  permission: { read, write, }, },
        { propertyName: 'locations',                  permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbLanguageEngagement>({
      __className: 'DbLanguageEngagement',
      properties: [
        { propertyName: 'ceremony',                   permission: { read, write, }, },
        { propertyName: 'communicationsCompleteDate', permission: { read, write, }, },
        { propertyName: 'completeDate',               permission: { read, write, }, },
        { propertyName: 'disbursementCompleteDate',   permission: { read, write, }, },
        { propertyName: 'endDate',                    permission: { read, write, }, },
        { propertyName: 'endDateOverride',            permission: { read, write, }, },
        { propertyName: 'firstScripture',             permission: { read, write, }, },
        { propertyName: 'initialEndDate',             permission: { read, write, }, },
        { propertyName: 'language',                   permission: { read, write, }, },
        { propertyName: 'lastReactivatedAt',          permission: { read, write, }, },
        { propertyName: 'lastSuspendedAt',            permission: { read, write, }, },
        { propertyName: 'lukePartnership',            permission: { read, write, }, },
        { propertyName: 'paraTextRegistryId',         permission: { read, write, }, },
        { propertyName: 'pnp',                        permission: { read, write, }, },
        { propertyName: 'sentPrintingDate',           permission: { read, write, }, },
        { propertyName: 'startDate',                  permission: { read, write, }, },
        { propertyName: 'startDateOverride',          permission: { read, write, }, },
        { propertyName: 'statusModifiedAt',           permission: { read, write, }, },
        { propertyName: 'modifiedAt',                 permission: { read, write, }, },
        { propertyName: 'product',                    permission: { read, write, }, },
        { propertyName: 'status',                     permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbLiteracyMaterial>({
      __className: 'DbLiteracyMaterial',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'scriptureReferences',        permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbLocation>({
      __className: 'DbLocation',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'type',                       permission: { read, write, }, },
        { propertyName: 'sensitivity',                permission: { read, write, }, },
        { propertyName: 'isoAlpha3',                  permission: { read, write, }, },
        { propertyName: 'fundingAccount',             permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbOrganization>({
      __className: 'DbOrganization',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'address',                    permission: { read, write, }, },
        { propertyName: 'locations',                  permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbPartner>({
      __className: 'DbPartner',
      properties: [
        { propertyName: 'organization',               permission: { read, write, }, },
        { propertyName: 'pointOfContact',             permission: { read, write, }, },
        { propertyName: 'types',                      permission: { read, write, }, },
        { propertyName: 'financialReportingTypes',    permission: { read, write, }, },
        { propertyName: 'pmcEntityCode',              permission: { read, write, }, },
        { propertyName: 'globalInnovationsClient',    permission: { read, write, }, },
        { propertyName: 'active',                     permission: { read, write, }, },
        { propertyName: 'address',                    permission: { read, write, }, },
        { propertyName: 'modifiedAt',                 permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbPartnership>({
      __className: 'DbPartnership',
      properties: [
        { propertyName: 'agreement',                  permission: { read, write, }, },
        { propertyName: 'agreementStatus',            permission: { read, write, }, },
        { propertyName: 'financialReportingType',     permission: { read, write, }, },
        { propertyName: 'mou',                        permission: { read, write, }, },
        { propertyName: 'mouEnd',                     permission: { read, write, }, },
        { propertyName: 'mouEndOverride',             permission: { read, write, }, },
        { propertyName: 'mouStart',                   permission: { read, write, }, },
        { propertyName: 'mouStartOverride',           permission: { read, write, }, },
        { propertyName: 'mouStatus',                  permission: { read, write, }, },
        { propertyName: 'types',                      permission: { read, write, }, },
        { propertyName: 'organization',               permission: { read, write, }, },
        { propertyName: 'partner',                    permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbProduct>({
      __className: 'DbProduct',
      properties: [
        { propertyName: 'mediums',                    permission: { read, write, }, },
        { propertyName: 'methodology',                permission: { read, write, }, },
        { propertyName: 'purposes',                   permission: { read, write, }, },
        { propertyName: 'scriptureReferences',        permission: { read, write, }, },
        { propertyName: 'produces',                   permission: { read, write, }, },
        { propertyName: 'scriptureReferencesOverride',permission: { read, write, }, },
        { propertyName: 'isOverriding',               permission: { read, write, }, },
      ]}),
    new DbBaseNodeGrant<DbProject>({
      __className: 'DbProject',
      properties: [
        { propertyName: 'estimatedSubmission',        permission: { read, write, }, },
        { propertyName: 'step',                       permission: { read, write, }, },
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'status',                     permission: { read, write, }, },
        { propertyName: 'departmentId',               permission: { read, write, }, },
        { propertyName: 'mouStart',                   permission: { read, write, }, },
        { propertyName: 'mouEnd',                     permission: { read, write, }, },
        { propertyName: 'initialMouEnd',              permission: { read, write, }, },
        { propertyName: 'stepChangedAt',              permission: { read, write, }, },
        { propertyName: 'rootDirectory',              permission: { read, write, }, },
        { propertyName: 'member',                     permission: { read, write, }, },
        { propertyName: 'otherLocations',             permission: { read, write, }, },
        { propertyName: 'primaryLocation',            permission: { read, write, }, },
        { propertyName: 'marketingLocation',          permission: { read, write, }, },
        { propertyName: 'partnership',                permission: { read, write, }, },
        { propertyName: 'budget',                     permission: { read, write, }, },
        { propertyName: 'modifiedAt',                 permission: { read, write, }, },
        { propertyName: 'fieldRegion',                permission: { read, write, }, },
        { propertyName: 'engagement',                 permission: { read, write, }, },
        { propertyName: 'sensitivity',                permission: { read, write, }, },
      ]}),
    new DbBaseNodeGrant<DbProjectMember>({
      __className: 'DbProjectMember',
      properties: [
        { propertyName: 'roles',                      permission: { read, write, }, },
        { propertyName: 'user',                       permission: { read, write, }, },
        { propertyName: 'modifiedAt',                 permission: { read, write, }, },
        ]}),
    new DbBaseNodeGrant<DbUser>({
      __className: 'DbUser',
      properties: [
        { propertyName: 'about',                      permission: { read, write, }, },
        { propertyName: 'displayFirstName',           permission: { read, write, }, },
        { propertyName: 'displayLastName',            permission: { read, write, }, },
        { propertyName: 'email',                      permission: { read, write, }, },
        { propertyName: 'phone',                      permission: { read, write, }, },
        { propertyName: 'realFirstName',              permission: { read, write, }, },
        { propertyName: 'realLastName',               permission: { read, write, }, },
        { propertyName: 'roles',                      permission: { read, write, }, },
        { propertyName: 'status',                     permission: { read, write, }, },
        { propertyName: 'timezone',                   permission: { read, write, }, },
        { propertyName: 'title',                      permission: { read, write, }, },
        { propertyName: 'education',                  permission: { read, write, }, },
        { propertyName: 'organization',               permission: { read, write, }, },
        { propertyName: 'unavailability',             permission: { read, write, }, },
        { propertyName: 'locations',                  permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbUnavailability>({
      __className: 'DbUnavailability',
      properties: [
        { propertyName: 'description',                permission: { read, write, }, },
        { propertyName: 'end',                        permission: { read, write, }, },
        { propertyName: 'start',                      permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbSong>({
      __className: 'DbSong',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'scriptureReferences',        permission: { read, write, }, },
    ]}),
    new DbBaseNodeGrant<DbStory>({
      __className: 'DbStory',
      properties: [
        { propertyName: 'name',                       permission: { read, write, }, },
        { propertyName: 'scriptureReferences',        permission: { read, write, }, },
    ]}),
  ],
});
