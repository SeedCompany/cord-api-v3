import {
  equals,
  inArray,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { identity } from 'rxjs';
import { ACTIVE, path } from '../../core/database/query';
import { propMatch } from '../project';
import { LanguageFilters } from './dto';
import { LanguageRepository } from './language.repository';

export const languageListFilter =
  (filter: LanguageFilters, repo: LanguageRepository) => (query: Query) => {
    const conditions: AndConditions = {};

    if (filter.sensitivity) {
      query.match(propMatch('sensitivity'));
      conditions.sensitivity = { value: inArray(filter.sensitivity) };
    }

    if (filter.leastOfThese != null) {
      conditions.lot = boolProp('leastOfThese', filter.leastOfThese);
    }
    if (filter.isSignLanguage != null) {
      conditions.sign = boolProp('isSignLanguage', filter.isSignLanguage);
    }
    if (filter.isDialect != null) {
      conditions.dialect = boolProp('isDialect', filter.isDialect);
    }
    if (filter.presetInventory != null) {
      query.apply(repo.isPresetInventory()).with('*');
      conditions.presetInventory = (filter.presetInventory ? identity : not)(
        equals('true', true)
      );
    }

    if (Object.keys(conditions).length > 0) {
      query.where(conditions);
    }
  };

const boolProp = (prop: string, val: boolean) =>
  path([
    node('node'),
    relation('out', '', prop, ACTIVE),
    node('', 'Property', { value: val }),
  ]);
