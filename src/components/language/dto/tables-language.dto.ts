/* eslint-disable @typescript-eslint/naming-convention */

import {
  CreateEthnologueLanguage,
  CreateLanguage,
  EthnologueLanguage,
  Language,
} from '.';
import { CalendarDate, ID, Sensitivity, UnsecuredDto } from '../../../common';

export interface TablesLanguages {
  size: number;
  languages: TablesLanguage[];
}

export interface TablesReadLanguage {
  language: TablesLanguage;
}

export interface TablesReadEthnologue {
  ethnologue: TablesEthnologueLanguage;
}

export interface TablesLanguage {
  name: string;
  id: string;
  ethnologue: TablesEthnologueLanguage;
  display_name: string;
  display_name_pronunciation: string;
  first_scripture_engagement: string;
  tags: string[];
  preset_inventory: boolean;
  is_dialect: boolean;
  is_sign_language: boolean;
  population_override: number;
  registry_of_dialects_code: string;
  least_of_these: boolean;
  least_of_these_reason: string;
  sign_language_code: string;
  sponsor_estimated_end_date: CalendarDate;
  sensitivity: Sensitivity;
  has_external_first_scripture: boolean;
  created_at: CalendarDate;
}
export interface TablesEthnologueLanguage {
  id: ID;
  code: string;
  provisional_code: string;
  language_name: string;
  population: number;
  sensitivity: Sensitivity;
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
    sensitivity: lang.sensitivity || Sensitivity.High,
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
