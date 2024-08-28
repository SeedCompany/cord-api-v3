import { Book, parseScripture, Range, Verse } from '@seedcompany/scripture';
import { Cell } from '~/common/xlsx.util';
import { ScriptureRange } from '../scripture/dto';
import { PnpExtractionResult } from './extraction-result';
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
    result?.addProblem({
      severity: 'Warning',
      groups: 'No book name given',
      message: `Ignoring row with no book name \`${bookCell.ref}\` even though there are **${versesToTranslate}** verses to translate \`${versesCell.ref}\``,
      source: cell,
    });
    return false;
  }

  // Try as book name first since it is faster than parsing scripture string
  // And ensure total verses given is plausible
  const maybeBook = Book.namedMaybe(rawBook);
  if (maybeBook) {
    const validVerseCount = versesToTranslate <= maybeBook.totalVerses;
    !validVerseCount &&
      result?.addProblem({
        severity: 'Error',
        groups: 'The verses to translate exceeds total verses in book',
        message: `Ignoring _${maybeBook.name}_ because **${versesToTranslate}** \`${versesCell.ref}\` verses to translate exceeds the total number of verses in the book`,
        source: cell,
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
    result?.addProblem({
      severity: 'Error',
      groups: 'Could not determine book reference',
      message: `"${rawBook}" \`${bookCell.ref}\` could not be identified as a book name or scripture reference`,
      source: cell,
    });
    return false;
  }

  // Treat range(s) as valid if the total verses represented
  // equals what has been given in the other column.
  const totalVersesInRange = ScriptureRange.totalVerses(...scriptureRanges);
  const validRange = totalVersesInRange === versesToTranslate;
  if (!validRange) {
    addProblemMismatchScriptureAndVerseCount(
      result,
      totalVersesInRange,
      bookCell,
      versesCell,
    );
  }
  return validRange;
};

export function addProblemMismatchScriptureAndVerseCount(
  result: PnpExtractionResult | undefined,
  parsedVerseCount: number,
  book: Cell,
  totalVerses: Cell,
) {
  result?.addProblem({
    severity: 'Error',
    groups:
      'Mismatch between the planned scripture in _Books_ column and the number of verses to translate',
    message: `"${book.asString!}" \`${
      book.ref
    }\` is **${parsedVerseCount}** verses, but the goal declares **${totalVerses.asNumber!}** verses to translate \`${
      totalVerses.ref
    }\``,
    source: book,
  });
}
