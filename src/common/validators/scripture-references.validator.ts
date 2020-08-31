import { ValidationArguments, ValidationOptions } from 'class-validator';
import { ScriptureReference } from '../../components/scripture';
import {
  validateChapter,
  validateVerse,
} from '../../components/scripture/reference';
import { ValidateBy } from './validateBy';

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
