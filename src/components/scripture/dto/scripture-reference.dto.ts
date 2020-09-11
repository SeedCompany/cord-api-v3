import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
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
    description: 'The code of the Bible book',
  })
  @IsValidBook()
  book: string;

  @Field(() => Int, {
    description: 'The chapter number',
    defaultValue: null,
  })
  @IsValidChapter()
  chapter: number;

  @Field(() => Int, {
    description: 'The verse number',
    defaultValue: null,
  })
  @IsValidVerse()
  verse: number;
}

@ObjectType({
  description: 'A reference to a scripture verse',
})
export abstract class ScriptureReference extends ScriptureReferenceInput {}
