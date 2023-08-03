import { mergeVerseRanges, Range, Verse } from '@seedcompany/scripture';
import { differenceWith } from 'lodash';
import { ScriptureRange } from './dto';

export const isScriptureEqual = (
  a: readonly ScriptureRange[],
  b: readonly ScriptureRange[],
) => {
  if (
    (a.length !== 0 && b.length === 0) ||
    (a.length === 0 && b.length !== 0)
  ) {
    // If one is empty and the other is not, then we know they aren't equal
    return false;
  }
  const av = mergeVerseRanges(a);
  const bv = mergeVerseRanges(b);
  if (av.length !== bv.length) {
    // If the merged ranges are not the same length, we know they aren't equal
    return false;
  }
  // Otherwise, compare actual verses
  const comparator = (aa: Range<Verse>, bb: Range<Verse>) => {
    return +aa.start === +bb.start && +aa.end === +bb.end;
  };
  return (
    differenceWith(av, bv, comparator).length === 0 &&
    differenceWith(bv, av, comparator).length === 0
  );
};
