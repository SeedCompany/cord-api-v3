import { sum, sumBy } from 'lodash';
import { iterate, Range } from '../../common';
import { Book, Verse } from './books';
import {
  BookDifficulty,
  mapRange,
  ScriptureRange,
  UnspecifiedScripturePortion,
} from './dto';
import { mergeScriptureRanges } from './merge-to-minimal-set';

export const getTotalVerseEquivalents = (
  ...refs: readonly ScriptureRange[]
) => {
  const verses = mergeScriptureRanges(refs)
    .map((range) => mapRange(range, Verse.fromRef))
    .flatMap((range) => iterate(splitRangeByBook(range)))
    .map((range) => {
      const factor = factorOfBook(range.start.book);
      return factor * (range.end.id - range.start.id + 1);
    });
  return sum(verses);
};

export const getVerseEquivalentsFromUnspecified = (
  portion: UnspecifiedScripturePortion,
) => {
  const factor = factorOfBook(Book.find(portion.book));
  return factor * portion.totalVerses;
};

export const getTotalVerses = (...refs: readonly ScriptureRange[]) =>
  sumBy(mergeScriptureRanges(refs), (range) => {
    const { start, end } = mapRange(range, Verse.fromRef);
    return end.id - start.id + 1;
  });

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

const factorMap: Record<BookDifficulty, number> = {
  Easy: 0.8,
  Normal: 1,
  Hard: 1.25,
  Hardest: 1.5625,
};
const factorOfBook = (book: Book) => factorMap[book.difficulty];
