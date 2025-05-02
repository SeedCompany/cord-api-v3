import {
  Book,
  mergeVerseRanges,
  type Verse,
  type VerseLike,
} from '@seedcompany/scripture';
import { sum } from 'lodash';
import { type Range } from '~/common';
import { difficultyFactorOfBook } from './book-difficulty-factor';
import { ScriptureRange, type UnspecifiedScripturePortion } from './dto';

export const getTotalVerseEquivalents = (
  ...refs: ReadonlyArray<Range<VerseLike>>
) => {
  const verses = mergeVerseRanges(refs)
    .flatMap((range) => [...splitRangeByBook(range)])
    .map((range) => {
      const factor = difficultyFactorOfBook(range.start.book);
      return factor * ScriptureRange.totalVerses(range);
    });
  return sum(verses);
};

export const getVerseEquivalentsFromUnspecified = (
  portion: UnspecifiedScripturePortion,
) => {
  const factor = difficultyFactorOfBook(Book.named(portion.book));
  return factor * portion.totalVerses;
};

export const getTotalVerses = (...refs: readonly ScriptureRange[]) =>
  ScriptureRange.totalVerses(...mergeVerseRanges(refs));

function* splitRangeByBook({ start, end }: Range<Verse>) {
  while (start.book.name !== end.book.name) {
    yield {
      start,
      end: start.book.lastChapter.lastVerse,
    };
    start = start.book.next!.firstChapter.firstVerse;
  }
  yield { start, end };
}
