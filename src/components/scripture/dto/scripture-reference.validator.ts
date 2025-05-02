import { applyDecorators } from '@nestjs/common';
import { Book, Chapter } from '@seedcompany/scripture';
import { type ValidationArguments } from 'class-validator';
import type { Merge } from 'type-fest';
import { createValidationDecorator } from '~/common/validators/validateBy';
import { NormalizeBook } from './book.transformer';
import { type ScriptureReference } from './scripture-reference.dto';
import { type UnspecifiedScripturePortionInput } from './unspecified-scripture-portion.dto';

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
    validate: (val) => !!Book.namedMaybe(val),
    defaultMessage: () => 'Not a valid Bible book',
  },
});

export const IsValidChapter = createValidationDecorator({
  name: 'ScriptureChapter',
  validator: {
    validate: (value, { object: ref }: ValidationArgs) => {
      try {
        return !!Book.fromRef(ref).chapterMaybe(ref.chapter);
      } catch {
        return true; // ignore if the book has already failed
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
        return !!Chapter.fromRef(ref).verseMaybe(ref.verse);
      } catch {
        return true; // ignore if the book or chapter has already failed
      }
    },
    defaultMessage: ({ object: ref }: ValidationArgs) =>
      `${Chapter.fromRef(ref).label} does not have verse ${ref.verse}`,
  },
});

export const IsValidVerseTotal = createValidationDecorator({
  name: 'IsValidVerseTotal',
  validator: {
    validate: (value, args) => {
      try {
        const obj = args?.object as UnspecifiedScripturePortionInput | null;
        const book = Book.named(obj?.book ?? '');
        return book.totalVerses > value;
      } catch (e) {
        return true; // Let book field fail validation
      }
    },
    defaultMessage: (args) => {
      const bookName = (args!.object as UnspecifiedScripturePortionInput).book;
      const totalVerses = Book.named(bookName).totalVerses;
      return totalVerses === args!.value
        ? `${totalVerses} verses of ${bookName} is the full book. Set as a known scripture reference instead.`
        : `${bookName} only has ${totalVerses} verses`;
    },
  },
});
