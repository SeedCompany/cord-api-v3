import { inArray, node, Query, relation } from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { ACTIVE, path } from '../../core/database/query';
import { propMatch } from '../project';
import { LanguageFilters } from './dto';

export const languageListFilter =
  (filter: LanguageFilters) => (query: Query) => {
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
