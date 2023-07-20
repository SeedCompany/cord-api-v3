import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  IsValidBook,
  IsValidChapter,
  IsValidVerse,
} from './scripture-reference.validator';

@InputType({
  description: 'A reference to a scripture verse',
})
@ObjectType({
  isAbstract: true,
})
export abstract class ScriptureReferenceInput {
  @Field({
    description: 'The Bible book',
  })
  @IsValidBook()
  readonly book: string;

  @Field(() => Int, {
    description: stripIndent`
      The chapter number.
      If omitted, its assumed to be the first/last chapter in the book.
    `,
    nullable: true,
  })
  @IsValidChapter()
  readonly chapter: number;

  @Field(() => Int, {
    description: stripIndent`
      The verse number.
      If omitted, its assumed to be the first/last verse in the chapter.
    `,
    nullable: true,
  })
  @IsValidVerse()
  readonly verse: number;
}

@ObjectType({
  description: 'A reference to a scripture verse',
})
export abstract class ScriptureReference extends ScriptureReferenceInput {
  @Field(() => Int, {
    description: `The chapter number.`,
  })
  declare readonly chapter: number;

  @Field(() => Int, {
    description: `The verse number.`,
  })
  declare readonly verse: number;
}
