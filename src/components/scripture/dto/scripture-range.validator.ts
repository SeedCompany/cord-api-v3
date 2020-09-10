import { ValidationArguments } from 'class-validator';
import { Merge } from 'type-fest';
import { createValidationDecorator } from '../../../common/validators/validateBy';
import {
  scriptureToVerseRange,
  validateBook,
  validateChapter,
  validateVerse,
} from '../reference';
import { ScriptureRange } from './scripture-range.dto';

// We assume this is only used on the ScriptureRange object
type ValidationArgs = Merge<ValidationArguments, { object: ScriptureRange }>;

export const IsValidOrder = createValidationDecorator({
  name: 'ScriptureRange',
  validator: {
    validate: (_value, { object: range }: ValidationArgs) => {
      if (
        !validateBook(range.start.book) ||
        !validateChapter(range.start.book, range.start.chapter) ||
        !validateVerse(
          range.start.book,
          range.start.chapter,
          range.start.verse
        ) ||
        !validateBook(range.end.book) ||
        !validateChapter(range.end.book, range.end.chapter) ||
        !validateVerse(range.end.book, range.end.chapter, range.end.verse)
      ) {
        return true;
      }

      const verseRange = scriptureToVerseRange(range);
      return verseRange.start <= verseRange.end;
    },
    defaultMessage: () => {
      return 'Scripture range must end after the starting point';
    },
  },
});
