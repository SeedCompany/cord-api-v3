import { ValidationArguments, ValidationOptions } from 'class-validator';
import {
  validateChapter,
  validateVerse,
} from '../../components/scripture/reference';
import { ValidateBy } from './validateBy';

export const IsValidChapter = (
  book: string,
  validationOptions?: ValidationOptions
) =>
  ValidateBy(
    {
      name: 'isValidChapter',
      constraints: [book],
      validator: {
        validate: (value, args: ValidationArguments) => {
          const [book] = args.constraints;
          const bookName = (args.object as any)[book];
          return validateChapter(bookName, value);
        },
        defaultMessage: () => 'No chapter matched',
      },
    },
    validationOptions
  );

export const IsValidVerse = (
  book: string,
  chapter: string,
  validationOptions?: ValidationOptions
) =>
  ValidateBy(
    {
      name: 'isValidVerse',
      constraints: [book, chapter],
      validator: {
        validate: (value, args: ValidationArguments) => {
          const [book, chapter] = args.constraints;
          const bookName = (args.object as any)[book];
          const chapterNumber = (args.object as any)[chapter];
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
