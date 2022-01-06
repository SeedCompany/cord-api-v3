/* eslint-disable @typescript-eslint/naming-convention */

import { CreateEthnologueLanguage } from '.';
import { CalendarDate, ID, Sensitivity } from '../../../common';

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
