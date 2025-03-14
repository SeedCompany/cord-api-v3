import { applyDecorators } from '@nestjs/common';
import { Book } from '@seedcompany/scripture';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Writable as Mutable } from 'type-fest';
import { ScriptureReferenceInput } from './scripture-reference.dto';

class ScriptureReferenceStartInput extends ScriptureReferenceInput {
  chapter = 1;
  verse = 1;
}

class ScriptureReferenceEndInput extends ScriptureReferenceInput {
  get book() {
    return super.book;
  }
  protected set book(name: string) {
    super.book = name;

    // When the book is set, default the chapter & verse to last.
    // If they are also given on input, then they will just be overridden
    // after this. Also ignoring errors, as the validator reports better.
    try {
      const book = Book.named(name);
      (this as Mutable<this>).chapter = book.lastChapter.index;
      (this as Mutable<this>).verse = book.lastChapter.lastVerse.index;
    } catch (e) {
      // let validator will throw error
    }
  }
}

export const ScriptureStart = () =>
  applyDecorators(
    ValidateNested(),
    // @Transform doesn't work with nested validators, so using a custom class instead.
    Type(() => ScriptureReferenceStartInput)!,
  );

export const ScriptureEnd = () =>
  applyDecorators(
    ValidateNested(),
    // @Transform doesn't work with nested validators, so using a custom class instead.
    Type(() => ScriptureReferenceEndInput)!,
  );
