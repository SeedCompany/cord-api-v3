import { inArray, node, Query } from 'cypher-query-builder';
import { propMatch } from '../project';
import { LanguageFilters } from './dto';

export const languageListFilter = (filter: LanguageFilters) => (query: Query) =>
  filter.sensitivity ||
  filter.leastOfThese ||
  filter.isSignLanguage ||
  filter.isDialect
    ? query
        .match(filter.sensitivity ? propMatch('sensitivity') : [node('node')])
        .match(filter.leastOfThese ? propMatch('leastOfThese') : [node('node')])
        .match(
          filter.isSignLanguage ? propMatch('isSignLanguage') : [node('node')]
        )
        .match(filter.isDialect ? propMatch('isDialect') : [node('node')])
        .where({
          ...(filter.sensitivity
            ? { sensitivity: { value: inArray(filter.sensitivity) } }
            : {}),
          ...(filter.leastOfThese ? { leastOfThese: { value: true } } : {}),
          ...(filter.isSignLanguage ? { isSignLanguage: { value: true } } : {}),
          ...(filter.isDialect ? { isDialect: { value: true } } : {}),
        })
    : query;
