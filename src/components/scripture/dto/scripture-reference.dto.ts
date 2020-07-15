import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsPositive } from 'class-validator';

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
  // TODO validate code against list
  book: string;

  @Field(() => Int, {
    description: 'The chapter number',
  })
  @IsPositive()
  chapter: number;

  @Field(() => Int, {
    description: 'The verse number',
  })
  @IsPositive()
  verse: number;
}

@ObjectType({
  description: 'A reference to a scripture verse',
})
export abstract class ScriptureReference extends ScriptureReferenceInput {}
