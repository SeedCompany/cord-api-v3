import { parseScripture, tryParseScripture } from '@seedcompany/scripture';
import { Row } from '~/common/xlsx.util';
import { ScriptureRange } from '../scripture/dto';
import { PnpExtractionResult } from './extraction-result';
import { addProblemMismatchScriptureAndVerseCount } from './isGoalRow';
import { WrittenScripturePlanningSheet } from './planning-sheet';

export const extractScripture = (
  row: Row<WrittenScripturePlanningSheet>,
  result: PnpExtractionResult,
) => {
  const sheet = row.sheet;

  const totalVersesCell = sheet.totalVerses(row)!;
  const totalVerses = totalVersesCell.asNumber!;

  const bookCell = sheet.bookName(row);
  const scriptureFromBookCol = parseScripture(bookCell.asString);
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
    addProblemMismatchScriptureAndVerseCount(
      result,
      totalVersesInBookCol,
      bookCell,
      totalVersesCell,
    );
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
    result.addProblem({
      severity: 'Error',
      groups:
        'Mismatch between the planned scripture in _My Notes_ column and the number of verses to translate',
      message: `"${noteCell.asString!}" \`${
        noteCell.ref
      }\` is **${totalVersesFromNoteCol}** verses, but the goal declares **${totalVerses}** verses to translate \`${
        totalVersesCell.ref
      }\``,
      source: noteCell,
    });
  }

  // Otherwise, fallback to unspecified scripture.
  !mismatchError &&
    result.addProblem({
      severity: 'Warning',
      groups: 'Unspecified scripture reference',
      message: `"${book.name}" \`${bookCell.ref}\` does not a have specified scripture reference (either in the _Books_ or _My Notes_ column)`,
      source: totalVersesCell,
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
