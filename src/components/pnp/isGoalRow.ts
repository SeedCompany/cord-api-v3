import { Book, parseScripture, Range, Verse } from '@seedcompany/scripture';
import { Cell } from '~/common/xlsx.util';
import { ScriptureRange } from '../scripture/dto';
import { PnpExtractionResult, PnpProblemType } from './extraction-result';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';

export const isGoalRow = (
  cell: Cell<PlanningSheet | ProgressSheet>,
  result?: PnpExtractionResult,
) => {
  if (cell.sheet.isOBS()) {
    return !!cell.sheet.storyName(cell.row);
  }
  if (!cell.sheet.isWritten()) {
    return false;
  }

  const bookCell = cell.sheet.bookName(cell.row);
  const versesCell = cell.sheet.totalVerses(cell.row);
  const rawBook = bookCell.asString;
  const versesToTranslate = versesCell.asNumber ?? 0;

  if (versesToTranslate <= 0) {
    return false;
  }

  if (!rawBook) {
    result?.addProblem(NoBook, cell, {
      bookRef: bookCell.ref,
      verseVal: versesToTranslate,
      verseRef: versesCell.ref,
    });
    return false;
  }

  // Try as book name first since it is faster than parsing scripture string
  // And ensure total verses given is plausible
  const maybeBook = Book.namedMaybe(rawBook);
  if (maybeBook) {
    const validVerseCount = versesToTranslate <= maybeBook.totalVerses;
    !validVerseCount &&
      result?.addProblem(InvalidVerseCount, cell, {
        bookVal: maybeBook.name,
        verseVal: versesToTranslate,
        verseRef: versesCell.ref,
      });
    return validVerseCount;
  }

  let parsedRange = true;
  let scriptureRanges: ReadonlyArray<Range<Verse>> = [];
  try {
    scriptureRanges = parseScripture(rawBook);
  } catch {
    parsedRange = false;
  }
  if (!parsedRange || scriptureRanges.length === 0) {
    result?.addProblem(UnknownBookRef, cell, {
      bookVal: rawBook,
      bookRef: bookCell.ref,
    });
    return false;
  }

  // Treat range(s) as valid if the total verses represented
  // equals what has been given in the other column.
  const totalVersesInRange = ScriptureRange.totalVerses(...scriptureRanges);
  const validRange = totalVersesInRange === versesToTranslate;
  if (!validRange) {
    result?.addProblem(MismatchScriptureAndVerseCount, bookCell, {
      bookVal: bookCell.asString,
      actualVerseCount: totalVersesInRange,
      declVerseCount: versesCell.asNumber!,
      verseRef: versesCell.ref,
    });
  }
  return validRange;
};

const NoBook = PnpProblemType.register({
  name: 'NoBook',
  severity: 'Error',
  render:
    (ctx: { bookRef: string; verseVal: number; verseRef: string }) => () => ({
      groups: 'No book name given',
      message: `Ignoring row with no book name \`${ctx.bookRef}\` even though there are **${ctx.verseVal}** verses to translate \`${ctx.verseRef}\``,
    }),
});

const InvalidVerseCount = PnpProblemType.register({
  name: 'InvalidVerseCount',
  severity: 'Error',
  render:
    (ctx: { bookVal: string; verseVal: number; verseRef: string }) => () => ({
      groups: 'The verses to translate exceeds total verses in book',
      message: `Ignoring _${ctx.bookVal}_ because **${ctx.verseVal}** \`${ctx.verseRef}\` verses to translate exceeds the total number of verses in the book`,
    }),
});

const UnknownBookRef = PnpProblemType.register({
  name: 'UnknownBookRef',
  severity: 'Error',
  render: (ctx: { bookVal: string; bookRef: string }) => () => ({
    groups: 'Could not determine book reference',
    message: `"${ctx.bookVal}" \`${ctx.bookRef}\` could not be identified as a book name or scripture reference`,
  }),
});

export const MismatchScriptureAndVerseCount = PnpProblemType.register({
  name: 'MismatchScriptureAndVerseCount',
  severity: 'Error',
  render:
    (ctx: {
      bookVal: string;
      actualVerseCount: number;
      declVerseCount: number;
      verseRef: string;
    }) =>
    ({ source: bookRef }) => ({
      groups:
        'Mismatch between the planned scripture in _Books_ column and the number of verses to translate',
      message: `"${ctx.bookVal}" \`${bookRef}\` is **${ctx.actualVerseCount}** verses, but the goal declares **${ctx.declVerseCount}** verses to translate \`${ctx.verseRef}\``,
    }),
});
