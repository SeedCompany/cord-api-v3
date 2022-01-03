/* eslint-disable @typescript-eslint/naming-convention */
import got from 'got/dist/source';
import { ID, Sensitivity, UnsecuredDto } from '.';
import {
  CreateEthnologueLanguage,
  CreateLanguage,
  CreateLanguageInput,
  EthnologueLanguage,
  Language,
  TablesEthnologueLanguage,
  TablesLanguage,
} from '../components/language';

const baseUrl = 'http://localhost:8080';
const token =
  'AQvNQRAYpBSLUGSYhax6BpfhQxuY4e97sSijfDfc5eoaASayZ3q5dXpsGQl6Ojih';

export async function getFromCordTables(
  cordTablesPath: string,
  additionalParams = {}
) {
  return await got.post(`${baseUrl}/${cordTablesPath}`, {
    json: {
      token: token,
      responseType: 'json',
      ...additionalParams,
    },
  });
}

// ------------------------------------------------------------------------------------------------
// Transformation functions
//      - Takes the payload from cordtables and maps the props to the cooresponding dto
// ------------------------------------------------------------------------------------------------

export function transformEthnologueDtoToPayload(
  eth: CreateEthnologueLanguage,
  sensitivity: Sensitivity
) {
  return {
    code: eth.code,
    language_name: eth.name,
    population: eth.population,
    provisional_code: eth.provisionalCode,
    sensitivity: sensitivity,
  };
}

export function transformEthnologuePayloadToDto(eth: TablesEthnologueLanguage) {
  return {
    id: eth.id,
    sensitivity: undefined,
    code: eth.code,
    name: eth.language_name,
    population: eth.population,
    provisionalCode: eth.provisional_code,
  };
}

export function transformLanguageDtoToPayload(
  lang: CreateLanguage,
  ethnologueId: ID
) {
  return {
    display_name: lang.displayName,
    display_name_pronunciation: lang.displayNamePronunciation,
    ethnologue: ethnologueId,
    has_external_first_scripture: lang.hasExternalFirstScripture,
    is_dialect: lang.isDialect,
    is_sign_language: lang.isSignLanguage,
    is_least_of_these: lang.leastOfThese,
    least_of_these_reason: lang.leastOfTheseReason,
    name: lang.name,
    population_override: lang.populationOverride,
    registry_of_dialects_code: lang.registryOfDialectsCode,
    sensitivity: lang.sensitivity,
    sign_language_code: lang.signLanguageCode,
    sponsor_estimated_end_date: lang.sponsorEstimatedEndDate,
    tags: lang.tags,
  };
}

export function transformLanguagePayloadToDto(
  tablesLang: TablesLanguage
): UnsecuredDto<Language> {
  // fill in this stuff with a readOne from CordTables API later...
  // probably just make a call to cord tables here and map it to EthnologueLang.
  const eth: UnsecuredDto<EthnologueLanguage> = {
    id: 'id' as ID,
    code: 'string',
    provisionalCode: 'lkj',
    name: 'lkj',
    population: 1234,
    sensitivity: undefined,
    // sensitivity: "High",
  };
  return {
    name: tablesLang.name,
    id: tablesLang.id as ID,
    populationOverride: tablesLang.population_override,
    registryOfDialectsCode: tablesLang.registry_of_dialects_code,
    firstScriptureEngagement: tablesLang.first_scripture_engagement as
      | ID
      | undefined,
    leastOfThese: tablesLang.least_of_these,
    signLanguageCode: tablesLang.sign_language_code,
    sponsorEstimatedEndDate: tablesLang.sponsor_estimated_end_date,
    hasExternalFirstScripture: tablesLang.has_external_first_scripture,
    sensitivity: tablesLang.sensitivity,
    ethnologue: eth,
    displayName: tablesLang.display_name,
    displayNamePronunciation: tablesLang.display_name_pronunciation,
    tags: tablesLang.tags,
    presetInventory: tablesLang.preset_inventory,
    isDialect: tablesLang.is_dialect,
    isSignLanguage: tablesLang.is_sign_language,
    leastOfTheseReason: tablesLang.least_of_these_reason,
    createdAt: tablesLang.created_at,
    effectiveSensitivity: Sensitivity.High, //todo
    pinned: false, //todo
  };
}
