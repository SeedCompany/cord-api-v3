import { EthnologueLanguage } from '.';
import { CalendarDate, Sensitivity, ID, UnsecuredDto } from '../../../common';

export interface TablesLanguages {
  languages: TablesLanguage[];
}
export interface TablesLanguage {
  name: string;
  neo4j_id: string;
  ethnologue: TablesEthnologueLanguage;
  display_name: string;
  display_name_pronunciation: string;
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
  name: string;
  population: number;
  sensitivity?: Sensitivity;
}
