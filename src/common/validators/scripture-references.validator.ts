import { ValidationArguments, ValidationOptions } from 'class-validator';
import { books } from '../../components/scripture/books';
import { bookIndexFromName } from '../../components/scripture/reference';
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
          const bookIndex = bookIndexFromName(bookName);
          return value <= books[bookIndex].chapters.length;
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
      name: 'isValidChapter',
      constraints: [book, chapter],
      validator: {
        validate: (value, args: ValidationArguments) => {
          const [book, chapter] = args.constraints;
          const bookName = (args.object as any)[book];
          const chapterNumber = (args.object as any)[chapter];
          const bookIndex = bookIndexFromName(bookName);
          if (chapterNumber > books[bookIndex].chapters.length) {
            // chapter is invalid
            return true;
          }
          return value <= books[bookIndex].chapters[chapterNumber - 1];
        },
        defaultMessage: () => 'No verse matched',
      },
    },
    validationOptions
  );
