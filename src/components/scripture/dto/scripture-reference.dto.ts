import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  EndChapter,
  EndVerse,
  StartChapter,
  StartVerse,
} from './scripture-reference.transformer';
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
  book: string;

  @Field(() => Int, {
    description: 'The chapter number',
  })
  chapter: number;

  @Field(() => Int, {
    description: 'The verse number',
  })
  verse: number;
}

@ObjectType({
  description: 'A reference to a scripture verse',
})
export abstract class ScriptureReference extends ScriptureReferenceInput {}

@InputType({
  description: 'A reference to a scripture start verse',
})
@ObjectType({
  isAbstract: true,
})
export abstract class ScriptureReferenceStartInput
  implements ScriptureReferenceInput {
  @Field({
    description: 'The code of the Bible book',
  })
  @IsValidBook()
  book: string;

  @StartChapter({
    description: 'The chapter number',
    defaultValue: null,
  })
  @IsValidChapter()
  chapter: number;

  @StartVerse({
    description: 'The verse number',
    defaultValue: null,
  })
  @IsValidVerse()
  verse: number;
}

@InputType({
  description: 'A reference to a scripture end verse',
})
@ObjectType({
  isAbstract: true,
})
export abstract class ScriptureReferenceEndInput
  implements ScriptureReferenceInput {
  @Field({
    description: 'The code of the Bible book',
  })
  @IsValidBook()
  book: string;

  @EndChapter({
    description: 'The chapter number',
    defaultValue: null,
  })
  @IsValidChapter()
  chapter: number;

  @EndVerse({
    description: 'The verse number',
    defaultValue: null,
  })
  @IsValidVerse()
  verse: number;
}
