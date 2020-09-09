import { applyDecorators } from '@nestjs/common';
import { Transform } from '../../../common/transform.decorator';
import { books } from '../books';
import { bookIndexFromName } from '../reference';
import { ScriptureReferenceInput } from './scripture-reference.dto';

export const ScriptureStart = () =>
  applyDecorators(
    Transform((value: ScriptureReferenceInput) => {
      value.chapter = value.chapter == null ? 1 : value.chapter;
      value.verse = value.verse == null ? 1 : value.verse;
      return value;
    })
  );

export const ScriptureEnd = () =>
  applyDecorators(
    Transform((value) => {
      const bookIndex = bookIndexFromName(value.book);
      const lastChapter = books[bookIndex].chapters.length;
      value.chapter =
        value.chapter == null
          ? books[bookIndex].chapters.length
          : value.chapter;
      value.verse =
        value.verse == null
          ? books[bookIndex].chapters[lastChapter - 1]
          : value.verse;
      return value;
    })
  );
