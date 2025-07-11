import { asNonEmptyArray } from '@seedcompany/common';
import { parseScripture, tryParseScripture } from '@seedcompany/scripture';
import { type Row } from '~/common/xlsx.util';
import { ScriptureRange } from '../scripture/dto';
import { type PnpExtractionResult, PnpProblemType } from './extraction-result';
import { MismatchScriptureAndVerseCount } from './isGoalRow';
import { type WrittenScripturePlanningSheet } from './planning-sheet';

export const extractScripture = (
  row: Row<WrittenScripturePlanningSheet>,
  result: PnpExtractionResult,
) => {
  const sheet = row.sheet;

  const totalVersesCell = sheet.totalVerses(row)!;
  const totalVerses = totalVersesCell.asNumber!;

  const bookCell = sheet.bookName(row);
  const scriptureFromBookCol = asNonEmptyArray(
    parseScripture(bookCell.asString),
  )!; // empty list only when input is empty, which we've confirmed not.
  const book = scriptureFromBookCol[0].start.book;

  const common = {
    bookName: book.name,
    totalVerses,
  };
  let mismatchError = false;

  // If scripture from book column matches total count, use it.
  const totalVersesInBookCol = ScriptureRange.totalVerses(
    ...scriptureFromBookCol,
  );
  if (totalVersesInBookCol === totalVerses) {
    return {
      ...common,
      scripture: scriptureFromBookCol.map(ScriptureRange.fromVerses),
    };
    // If it is more than just the book name (aka not just the book name) then
    // the verse count will be less and if it doesn't match the total, there is a problem
  } else if (totalVersesInBookCol < book.totalVerses) {
    mismatchError = true;
    // TODO I think this is a redundant check.
    // I don't think we will ever get here because the row is filtered out with
    // the isGoalRow function.
    result.addProblem(MismatchScriptureAndVerseCount, bookCell, {
      bookVal: bookCell.asString!,
      actualVerseCount: totalVersesInBookCol,
      declVerseCount: totalVersesCell.asNumber!,
      verseRef: totalVersesCell.ref,
    });
  }

  // Otherwise, if note column has scripture that matches the total count use it.
  const noteCell = sheet.myNote(row);
  const scriptureFromNoteCol = tryParseScripture(noteCell.asString);
  if (scriptureFromNoteCol) {
    const totalVersesFromNoteCol = ScriptureRange.totalVerses(
      ...scriptureFromNoteCol,
    );
    if (totalVersesFromNoteCol === totalVerses) {
      return {
        ...common,
        scripture: scriptureFromNoteCol.map(ScriptureRange.fromVerses),
      };
    }
    mismatchError = true;
    result.addProblem(MismatchedVersesToTranslate, noteCell, {
      noteVal: noteCell.asString!,
      noteVerseCount: totalVersesFromNoteCol,
      declVerseCount: totalVerses,
      declVerseRef: totalVersesCell.ref,
    });
  }

  // Otherwise, fallback to unspecified scripture.
  !mismatchError &&
    result.addProblem(UnspecifiedScriptureReference, totalVersesCell, {
      bookName: book.name,
      bookRef: bookCell.ref,
    });
  return {
    ...common,
    scripture: [],
    unspecifiedScripture: {
      book: common.bookName,
      totalVerses: totalVerses,
    },
  };
};

const MismatchedVersesToTranslate = PnpProblemType.register({
  name: 'MismatchedVersesToTranslate',
  severity: 'Error',
  render:
    (ctx: {
      noteVal: string;
      noteVerseCount: number;
      declVerseCount: number;
      declVerseRef: string;
    }) =>
    ({ source: noteRef }) => ({
      groups:
        'Mismatch between the planned scripture in _My Notes_ column and the number of verses to translate',
      message: `"${ctx.noteVal}" \`${noteRef}\` is **${ctx.noteVerseCount}** verses, but the goal declares **${ctx.declVerseCount}** verses to translate \`${ctx.declVerseRef}\``,
    }),
});

const UnspecifiedScriptureReference = PnpProblemType.register({
  name: 'UnspecifiedScriptureReference',
  severity: 'Notice',
  render:
    ({ bookName, bookRef }: Record<'bookName' | 'bookRef', string>) =>
    () => ({
      groups: 'Unspecified scripture reference',
      message: `"${bookName}" \`${bookRef}\` does not a have specified scripture reference (either in the _Books_ or _My Notes_ column)`,
    }),
  wiki: 'https://github.com/SeedCompany/cord-docs/wiki/PnP-Extraction-Validation:-Errors-and-Troubleshooting-Steps#1-mismatch-between-the-planned-scripture-in-my-notes-column-and-the-number-of-verses-to-translate',
});
