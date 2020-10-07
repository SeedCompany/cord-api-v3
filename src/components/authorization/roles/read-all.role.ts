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
import { InternalRole, Role } from '../dto';
import { Powers } from '../dto/powers';
import { DbBaseNodeGrant, DbRole } from '../model';

// do not auto format this file
// turned off prettier for role files to prevent auto-format making this file huge

const read = true;
const write = true;

export const ReadAll = new DbRole({
  name: InternalRole.ReadAll,
  powers: [Powers.CreateBudget],
  grants: [
    new DbBaseNodeGrant<DbBudget>({
      __className: 'DbBudget',
      properties: [
        { propertyName: 'universalTemplateFile',      permission: { read, }, },
        { propertyName: 'records',                    permission: { read, }, },
        { propertyName: 'status',                     permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbBudgetRecord>({
      __className: 'DbBudgetRecord',
      properties: [
        { propertyName: 'amount',                     permission: { read, }, },
        { propertyName: 'fiscalYear',                 permission: { read, }, },
        { propertyName: 'organization',               permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbCeremony>({
      __className: 'DbCeremony',
      properties: [
        { propertyName: 'actualDate',                 permission: { read, }, },
        { propertyName: 'estimatedDate',              permission: { read, }, },
        { propertyName: 'planned',                    permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbDirectory>({
      __className: 'DbDirectory',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'createdBy',                  permission: { read, }, },
        { propertyName: 'parent',                     permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbEducation>({
      __className: 'DbEducation',
      properties: [
        { propertyName: 'degree',                     permission: { read, }, },
        { propertyName: 'institution',                permission: { read, }, },
        { propertyName: 'major',                      permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbEthnologueLanguage>({
      __className: 'DbEthnologueLanguage',
      properties: [
        { propertyName: 'code',                       permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'population',                 permission: { read, }, },
        { propertyName: 'provisionalCode',            permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbFieldRegion>({
      __className: 'DbFieldRegion',
      properties: [
        { propertyName: 'director',                   permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'fieldZone',                  permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbFieldZone>({
      __className: 'DbFieldZone',
      properties: [
        { propertyName: 'director',                   permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbFile>({
      __className: 'DbFile',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'createdBy',                  permission: { read, }, },
        { propertyName: 'parent',                     permission: { read, }, },
        { propertyName: 'mimeType',                   permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbFileVersion>({
      __className: 'DbFileVersion',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'createdBy',                  permission: { read, }, },
        { propertyName: 'parent',                     permission: { read, }, },
        { propertyName: 'mimeType',                   permission: { read, }, },
        { propertyName: 'size',                       permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbFilm>({
      __className: 'DbFilm',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'scriptureReferences',        permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbFundingAccount>({
      __className: 'DbFundingAccount',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'accountNumber',              permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbInternshipEngagement>({
      __className: 'DbInternshipEngagement',
      properties: [
        { propertyName: 'ceremony',                   permission: { read, }, },
        { propertyName: 'communicationsCompleteDate', permission: { read, }, },
        { propertyName: 'completeDate',               permission: { read, }, },
        { propertyName: 'countryOfOrigin',            permission: { read, }, },
        { propertyName: 'disbursementCompleteDate',   permission: { read, }, },
        { propertyName: 'endDate',                    permission: { read, }, },
        { propertyName: 'endDateOverride',            permission: { read, }, },
        { propertyName: 'growthPlan',                 permission: { read, }, },
        { propertyName: 'initialEndDate',             permission: { read, }, },
        { propertyName: 'intern',                     permission: { read, }, },
        { propertyName: 'lastReactivatedAt',          permission: { read, }, },
        { propertyName: 'lastSuspendedAt',            permission: { read, }, },
        { propertyName: 'mentor',                     permission: { read, }, },
        { propertyName: 'methodologies',              permission: { read, }, },
        { propertyName: 'position',                   permission: { read, }, },
        { propertyName: 'startDate',                  permission: { read, }, },
        { propertyName: 'startDateOverride',          permission: { read, }, },
        { propertyName: 'statusModifiedAt',           permission: { read, }, },
        { propertyName: 'modifiedAt',                 permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbLanguage>({
      __className: 'DbLanguage',
      properties: [
        { propertyName: 'displayName',                permission: { read, }, },
        { propertyName: 'displayNamePronunciation',   permission: { read, }, },
        { propertyName: 'isDialect',                  permission: { read, }, },
        { propertyName: 'isSignLanguage',             permission: { read, }, },
        { propertyName: 'leastOfThese',               permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'leastOfTheseReason',         permission: { read, }, },
        { propertyName: 'populationOverride',         permission: { read, }, },
        { propertyName: 'registryOfDialectsCode',     permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'signLanguageCode',           permission: { read, }, },
        { propertyName: 'sponsorEstimatedEndDate',    permission: { read, }, },
        { propertyName: 'ethnologue',                 permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'sensitivity',                permission: { read, }, },
        { propertyName: 'hasExternalFirstScripture',  permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbLanguageEngagement>({
      __className: 'DbLanguageEngagement',
      properties: [
        { propertyName: 'ceremony',                   permission: { read, }, },
        { propertyName: 'communicationsCompleteDate', permission: { read, }, },
        { propertyName: 'completeDate',               permission: { read, }, },
        { propertyName: 'disbursementCompleteDate',   permission: { read, }, },
        { propertyName: 'endDate',                    permission: { read, }, },
        { propertyName: 'endDateOverride',            permission: { read, }, },
        { propertyName: 'firstScripture',             permission: { read, }, },
        { propertyName: 'initialEndDate',             permission: { read, }, },
        { propertyName: 'language',                   permission: { read, }, },
        { propertyName: 'lastReactivatedAt',          permission: { read, }, },
        { propertyName: 'lastSuspendedAt',            permission: { read, }, },
        { propertyName: 'lukePartnership',            permission: { read, }, },
        { propertyName: 'paraTextRegistryId',         permission: { read, }, },
        { propertyName: 'pnp',                        permission: { read, }, },
        { propertyName: 'sentPrintingDate',           permission: { read, }, },
        { propertyName: 'startDate',                  permission: { read, }, },
        { propertyName: 'startDateOverride',          permission: { read, }, },
        { propertyName: 'statusModifiedAt',           permission: { read, }, },
        { propertyName: 'modifiedAt',                 permission: { read, }, },
        { propertyName: 'product',                    permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbLiteracyMaterial>({
      __className: 'DbLiteracyMaterial',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'scriptureReferences',        permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbLocation>({
      __className: 'DbLocation',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'type',                       permission: { read, }, },
        { propertyName: 'sensitivity',                permission: { read, }, },
        { propertyName: 'iso31663',                   permission: { read, }, },
        { propertyName: 'fundingAccount',             permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbOrganization>({
      __className: 'DbOrganization',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbPartner>({
      __className: 'DbPartner',
      properties: [
        { propertyName: 'organization',               permission: { read, }, },
        { propertyName: 'pointOfContact',             permission: { read, }, },
        { propertyName: 'types',                      permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbPartnership>({
      __className: 'DbPartnership',
      properties: [
        { propertyName: 'agreement',                  permission: { read, }, },
        { propertyName: 'agreementStatus',            permission: { read, }, },
        { propertyName: 'financialReportingType',     permission: { read, }, },
        { propertyName: 'mou',                        permission: { read, }, },
        { propertyName: 'mouEnd',                     permission: { read, }, },
        { propertyName: 'mouEndOverride',             permission: { read, }, },
        { propertyName: 'mouStart',                   permission: { read, }, },
        { propertyName: 'mouStartOverride',           permission: { read, }, },
        { propertyName: 'mouStatus',                  permission: { read, }, },
        { propertyName: 'types',                      permission: { read, }, },
        { propertyName: 'organization',               permission: { read, }, },
        { propertyName: 'partner',                    permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbProduct>({
      __className: 'DbProduct',
      properties: [
        { propertyName: 'mediums',                    permission: { read, }, },
        { propertyName: 'methodology',                permission: { read, }, },
        { propertyName: 'purposes',                   permission: { read, }, },
        { propertyName: 'scriptureReferences',        permission: { read, }, },
        { propertyName: 'produces',                   permission: { read, }, },
        { propertyName: 'scriptureReferencesOverride',permission: { read, }, },
        { propertyName: 'isOverriding',               permission: { read, }, },
      ]}),
    new DbBaseNodeGrant<DbProject>({
      __className: 'DbProject',
      properties: [
        { propertyName: 'estimatedSubmission',        permission: { read, }, },
        { propertyName: 'step',                       permission: { read, }, },
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'status',                     permission: { read, }, },
        { propertyName: 'departmentId',               permission: { read, }, },
        { propertyName: 'mouStart',                   permission: { read, }, },
        { propertyName: 'mouEnd',                     permission: { read, }, },
        { propertyName: 'rootDirectory',              permission: { read, }, },
        { propertyName: 'member',                     permission: { read, }, },
        { propertyName: 'otherLocations',             permission: { read, }, },
        { propertyName: 'primaryLocation',            permission: { read, }, },
        { propertyName: 'marketingLocation',          permission: { read, }, },
        { propertyName: 'partnership',                permission: { read, }, },
        { propertyName: 'budget',                     permission: { read, }, },
        { propertyName: 'modifiedAt',                 permission: { read, }, },
        { propertyName: 'fieldRegion',                permission: { read, }, },
        { propertyName: 'engagement',                 permission: { read, }, },
        { propertyName: 'sensitivity',                permission: { read, }, },
      ]}),
    new DbBaseNodeGrant<DbProjectMember>({
      __className: 'DbProjectMember',
      properties: [
        { propertyName: 'roles',                      permission: { read, }, },
        { propertyName: 'user',                       permission: { read, }, },
        { propertyName: 'modifiedAt',                 permission: { read, }, },
        ]}),
    new DbBaseNodeGrant<DbUser>({
      __className: 'DbUser',
      properties: [
        { propertyName: 'about',                      permission: { read, }, },
        { propertyName: 'displayFirstName',           permission: { read, }, },
        { propertyName: 'displayLastName',            permission: { read, }, },
        { propertyName: 'email',                      permission: { read, }, },
        { propertyName: 'phone',                      permission: { read, }, },
        { propertyName: 'realFirstName',              permission: { read, }, },
        { propertyName: 'realLastName',               permission: { read, }, },
        { propertyName: 'roles',                      permission: { read, }, },
        { propertyName: 'status',                     permission: { read, }, },
        { propertyName: 'timezone',                   permission: { read, }, },
        { propertyName: 'title',                      permission: { read, }, },
        { propertyName: 'education',                  permission: { read, }, },
        { propertyName: 'organization',               permission: { read, }, },
        { propertyName: 'unavailability',             permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbUnavailability>({
      __className: 'DbUnavailability',
      properties: [
        { propertyName: 'description',                permission: { read, }, },
        { propertyName: 'end',                        permission: { read, }, },
        { propertyName: 'start',                      permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbSong>({
      __className: 'DbSong',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'scriptureReferences',        permission: { read, }, },
    ]}),
    new DbBaseNodeGrant<DbStory>({
      __className: 'DbStory',
      properties: [
        { propertyName: 'name',                       permission: { read, }, },
        { propertyName: 'scriptureReferences',        permission: { read, }, },
    ]}),
  ],
});
