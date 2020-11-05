import { inArray, Query } from 'cypher-query-builder';
import { propMatch } from '../project';
import { LanguageFilters } from './dto';

export function languageListFilter(query: Query, filter: LanguageFilters) {
  query
    .call((q) =>
      filter.sensitivity
        ? q
            .match(propMatch('sensitivity'))
            .where({ sensitivity: { value: inArray(filter.sensitivity) } })
        : q
    )
    .call((q) =>
      filter.leastOfThese
        ? q
            .match(propMatch('leastOfThese'))
            .where({ leastOfThese: { value: true } })
        : q
    )
    .call((q) =>
      filter.isSignLanguage
        ? q
            .match(propMatch('isSignLanguage'))
            .where({ isSignLanguage: { value: true } })
        : q
    )
    .call((q) =>
      filter.isDialect
        ? q.match(propMatch('isDialect')).where({ isDialect: { value: true } })
        : q
    );
}
