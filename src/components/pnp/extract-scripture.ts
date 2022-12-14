import { Row } from '~/common/xlsx.util';
import {
  parseScripture,
  ScriptureRange,
  tryParseScripture,
} from '../scripture';
import { WrittenScripturePlanningSheet } from './planning-sheet';

export const extractScripture = (row: Row<WrittenScripturePlanningSheet>) => {
  const sheet = row.sheet;
  const totalVerses = sheet.totalVerses(row)!;
  const scriptureFromBookCol = parseScripture(sheet.bookName(row));

  const common = {
    bookName: scriptureFromBookCol[0].start.book,
    totalVerses,
  };

  // If scripture from book column matches total count use it.
  if (ScriptureRange.totalVerses(...scriptureFromBookCol) === totalVerses) {
    return {
      ...common,
      scripture: scriptureFromBookCol,
    };
  }

  // Otherwise, if note column has scripture that matches the total count use it.
  const scriptureFromNoteCol = tryParseScripture(sheet.myNote(row));
  if (
    scriptureFromNoteCol &&
    ScriptureRange.totalVerses(...scriptureFromNoteCol) === totalVerses
  ) {
    return {
      ...common,
      scripture: scriptureFromNoteCol,
    };
  }

  // Otherwise, fallback to unspecified scripture.
  return {
    ...common,
    scripture: [],
    unspecifiedScripture: {
      book: common.bookName,
      totalVerses: totalVerses,
    },
  };
};
