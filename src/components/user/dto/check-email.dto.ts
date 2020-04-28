import { Field, InputType } from 'type-graphql';
import { IsEmail } from '../../../common';

@InputType()
export abstract class UserEmailInput {
  @Field()
  @IsEmail()
  readonly email: string;
}
