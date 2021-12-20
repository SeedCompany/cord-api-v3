import got from 'got/dist/source';
import { ID, Sensitivity, UnsecuredDto } from '.';
import {
  EthnologueLanguage,
  Language,
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
