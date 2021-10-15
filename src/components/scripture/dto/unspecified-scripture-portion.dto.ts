import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsPositive } from 'class-validator';
import { SecuredProperty } from '../../../common';
import {
  IsValidBook,
  IsValidVerseTotal,
} from './scripture-reference.validator';

@InputType({
  description:
    'An unspecified range of scripture denoted only by the total number of verses',
})
@ObjectType({
  description:
    'An unspecified range of scripture denoted only by the total number of verses',
  isAbstract: true,
})
export abstract class UnspecifiedScripturePortionInput {
  @Field({
    description: 'The Bible book',
  })
  @IsValidBook()
  book: string;

  @Field(() => Int, {
    description: 'The number of verses',
  })
  @IsPositive()
  @IsValidVerseTotal()
  totalVerses: number;
}

@ObjectType()
export abstract class UnspecifiedScripturePortion extends UnspecifiedScripturePortionInput {}

@ObjectType({
  description: SecuredProperty.descriptionFor('UnspecifiedScripturePortion'),
})
export class SecuredUnspecifiedScripturePortion extends SecuredProperty(
  UnspecifiedScripturePortion,
  { nullable: true }
) {}
