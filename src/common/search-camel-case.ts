import Fuzzy from '@leeoniya/ufuzzy';
import { startCase } from 'lodash';

/**
 * Think of this like your IDE symbol lookup with camel case/humps.
 * https://www.jetbrains.com/help/rider/Navigation_and_Search__CamelHumps.html
 * https://learn.microsoft.com/en-us/visualstudio/ide/visual-studio-search?view=vs-2022#search-files-and-code
 *
 * @example
 * // For resources
 * langEng -> LanguageEngagement
 * proj -> Project
 * VarExp -> ProgressReportVarianceExplanation
 *
 * // For Roles
 * admin -> Administrator
 * BTL -> BibleTranslationLiaison
 * rcc -> RegionalCommunicationsCoordinator
 */
export function searchCamelCase<T extends string>(
  items: Iterable<T>,
  needle: string,
) {
  const itemArr = [...items];
  const collator = new Intl.Collator('en');
  const fuzzy = new Fuzzy({
    sort: (info, haystack) => {
      const {
        idx,
        chars,
        terms,
        interLft2,
        interLft1,
        start,
        intraIns,
        interIns,
      } = info;

      return idx
        .map((v, i) => i)
        .sort(
          (ia, ib) =>
            // most contiguous chars matched
            chars[ib] - chars[ia] ||
            // least char intra-fuzz (most contiguous)
            intraIns[ia] - intraIns[ib] ||
            // earliest start of match
            start[ia] - start[ib] ||
            // shortest match first
            haystack[idx[ia]].length - haystack[idx[ib]].length ||
            // most prefix bounds, boosted by full term matches
            terms[ib] +
              interLft2[ib] +
              0.5 * interLft1[ib] -
              (terms[ia] + interLft2[ia] + 0.5 * interLft1[ia]) ||
            // the highest density of match (the least term inter-fuzz)
            interIns[ia] - interIns[ib] ||
            // alphabetic
            collator.compare(haystack[idx[ia]], haystack[idx[ib]]),
        );
    },
  });
  const [indexes, _, order] = fuzzy.search(
    itemArr.map((v) => startCase(v)),
    startCase(needle).replace(/([A-Z])(?=[A-Z])/g, '$1 '),
  );

  // If no matches try again as with the search as the first letters of each camel hump word.
  if (indexes?.length === 0 && needle === needle.toLowerCase()) {
    return searchCamelCase(itemArr, needle.toUpperCase());
  }

  if (!indexes || indexes.length === 0 || !order || order.length === 0) {
    return [];
  }

  const results = order.map((idx) => itemArr[indexes[idx]]);
  return results;
}
