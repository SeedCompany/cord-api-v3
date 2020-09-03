import { ValidationArguments } from 'class-validator';
import { Merge } from 'type-fest';
import { createValidationDecorator } from '../../../common/validators/validateBy';
import { validateBook, validateChapter, validateVerse } from '../reference';
import { ScriptureReference } from './scripture-reference.dto';

// We assume this is only used on the ScriptureReference object
type ValidationArgs = Merge<
  ValidationArguments,
  { object: ScriptureReference }
>;

export const IsValidBook = createValidationDecorator({
  name: 'ScriptureBook',
  validator: {
    validate: (value) => validateBook(value),
    defaultMessage: () => 'Not a valid Bible book',
  },
});

export const IsValidChapter = createValidationDecorator({
  name: 'ScriptureChapter',
  validator: {
    validate: (value, { object: ref }: ValidationArgs) => {
      if (!validateBook(ref.book)) {
        return true; // ignore if book has already failed
      }
      return validateChapter(ref.book, value);
    },
    defaultMessage: () => 'No chapter matched',
  },
});

export const IsValidVerse = createValidationDecorator({
  name: 'ScriptureVerse',
  validator: {
    validate: (value, { object: ref }: ValidationArgs) => {
      if (!validateBook(ref.book) || !validateChapter(ref.book, ref.chapter)) {
        return true; // ignore if book or chapter have already failed
      }
      return validateVerse(ref.book, ref.chapter, value);
    },
    defaultMessage: () => 'No verse matched',
  },
});
