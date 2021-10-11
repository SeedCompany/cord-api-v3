import { applyDecorators } from '@nestjs/common';
import { ValidationArguments } from 'class-validator';
import { Merge } from 'type-fest';
import { createValidationDecorator } from '../../../common/validators/validateBy';
import { Book, Chapter, Verse } from '../books';
import { NormalizeBook } from './book.transformer';
import { ScriptureReference } from './scripture-reference.dto';

// We assume this is only used on the ScriptureReference object
type ValidationArgs = Merge<
  ValidationArguments,
  { object: ScriptureReference }
>;

export const IsValidBook = () =>
  applyDecorators(NormalizeBook(), IsScriptureBook());

const IsScriptureBook = createValidationDecorator({
  name: 'ScriptureBook',
  validator: {
    validate: Book.isValid,
    defaultMessage: () => 'Not a valid Bible book',
  },
});

export const IsValidChapter = createValidationDecorator({
  name: 'ScriptureChapter',
  validator: {
    validate: (value, { object: ref }: ValidationArgs) => {
      try {
        return Chapter.isValid(Book.fromRef(ref), ref.chapter);
      } catch {
        return true; // ignore if book has already failed
      }
    },
    defaultMessage: ({ object: ref }: ValidationArgs) =>
      `${Book.fromRef(ref).label} does not have chapter ${ref.chapter}`,
  },
});

export const IsValidVerse = createValidationDecorator({
  name: 'ScriptureVerse',
  validator: {
    validate: (value, { object: ref }: ValidationArgs) => {
      try {
        return Verse.isValid(Chapter.fromRef(ref), ref.verse);
      } catch {
        return true; // ignore if book or chapter have already failed
      }
    },
    defaultMessage: ({ object: ref }: ValidationArgs) =>
      `${Chapter.fromRef(ref).label} does not have verse ${ref.verse}`,
  },
});
