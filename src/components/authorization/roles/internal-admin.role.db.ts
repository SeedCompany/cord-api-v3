import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import { DbDirectory, DbFile } from '../../file/model';
import { DbFileVersion } from '../../file/model/file-version.model.db';
import { DbEthnologueLanguage, DbLanguage } from '../../language/model';
/* eslint-disable @typescript-eslint/naming-convention */
import { DbProject } from '../../project/model';
import { DbEducation, DbUnavailability, DbUser } from '../../user/model';
import { Powers } from '../dto/powers';
import { DbBaseNodeGrant, DbRole } from '../model';

// turned off prettier for role files to prevent auto-format making this file huge

const read = true;
const write = true;

export const InternalAdminRole = new DbRole({
  name: 'InternalAdmin',
  powers: [Powers.CreateBudget],
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
    ]}),
    new DbBaseNodeGrant<DbUnavailability>({
      __className: 'DbUnavailability',
      properties: [
        { propertyName: 'description',                permission: { read, write, }, },
        { propertyName: 'end',                        permission: { read, write, }, },
        { propertyName: 'start',                      permission: { read, write, }, },
    ]}),
  ],
});
