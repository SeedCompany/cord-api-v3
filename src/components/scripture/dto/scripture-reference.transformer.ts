import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, Int } from '@nestjs/graphql';
import { Transform } from '../../../common/transform.decorator';
import { books } from '../books';
import { bookIndexFromName } from '../reference';

export const StartChapter = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => Int, options),
    Transform((value) => (value == null ? 1 : value))
  );

export const StartVerse = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => Int, options),
    Transform((value) => (value == null ? 1 : value))
  );

export const EndChapter = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => Int, options),
    Transform((value, obj) =>
      value == null ? books[bookIndexFromName(obj.book)].chapters.length : value
    )
  );

export const EndVerse = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => Int, options),
    Transform((value, obj) => {
      const bookIndex = bookIndexFromName(obj.book);
      const lastChapter = books[bookIndex].chapters.length;
      return value == null ? books[bookIndex].chapters[lastChapter - 1] : value;
    })
  );
