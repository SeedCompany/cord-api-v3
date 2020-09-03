import { ValidationArguments, ValidationOptions } from 'class-validator';
import { Merge } from 'type-fest';
import { ValidateBy } from '../../../common/validators/validateBy';
import { validateChapter, validateVerse } from '../reference';
import { ScriptureReference } from './scripture-reference.dto';

// We assume this is only used on the ScriptureReference object
type ValidationArgs = Merge<
  ValidationArguments,
  { object: ScriptureReference }
>;

export const IsValidChapter = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'ScriptureChapter',
      validator: {
        validate: (value, { object: ref }: ValidationArgs) => {
          return validateChapter(ref.book, value);
        },
        defaultMessage: () => 'No chapter matched',
      },
    },
    validationOptions
  );

export const IsValidVerse = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'ScriptureVerse',
      validator: {
        validate: (value, { object: ref }: ValidationArgs) => {
          // validateVerse has no meaning if validateChapter is false
          return validateChapter(ref.book, ref.chapter)
            ? validateVerse(ref.book, ref.chapter, value)
            : true;
        },
        defaultMessage: () => 'No verse matched',
      },
    },
    validationOptions
  );
