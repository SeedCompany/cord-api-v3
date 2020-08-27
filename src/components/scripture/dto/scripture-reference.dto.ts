import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsPositive } from 'class-validator';
import { IsValidChapter, IsValidVerse } from '../../../common';

@InputType({
  description: 'A reference to a scripture verse',
})
@ObjectType({
  isAbstract: true,
})
// TODO Validate reference is known
export abstract class ScriptureReferenceInput {
  @Field({
    description: 'The code of the Bible book',
  })
  book: string;

  @Field(() => Int, {
    description: 'The chapter number',
  })
  @IsPositive()
  @IsValidChapter('book')
  chapter: number;

  @Field(() => Int, {
    description: 'The verse number',
  })
  @IsPositive()
  @IsValidVerse('book', 'chapter')
  verse: number;
}

@ObjectType({
  description: 'A reference to a scripture verse',
})
export abstract class ScriptureReference extends ScriptureReferenceInput {}
