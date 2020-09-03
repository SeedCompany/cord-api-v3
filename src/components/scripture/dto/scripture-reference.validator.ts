import { ValidationArguments, ValidationOptions } from 'class-validator';
import { ValidateBy } from '../../../common/validators/validateBy';
import { validateChapter, validateVerse } from '../reference';
import { ScriptureReference } from './scripture-reference.dto';

export const IsValidChapter = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isValidChapter',
      validator: {
        validate: (value, args: ValidationArguments) => {
          const bookName = (args.object as ScriptureReference).book;
          return validateChapter(bookName, value);
        },
        defaultMessage: () => 'No chapter matched',
      },
    },
    validationOptions
  );

export const IsValidVerse = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isValidVerse',
      validator: {
        validate: (value, args: ValidationArguments) => {
          const bookName = (args.object as ScriptureReference).book;
          const chapterNumber = (args.object as ScriptureReference).chapter;
          // validateVerse has no meaning if validateChapter is false
          return validateChapter(bookName, chapterNumber)
            ? validateVerse(bookName, chapterNumber, value)
            : true;
        },
        defaultMessage: () => 'No verse matched',
      },
    },
    validationOptions
  );
