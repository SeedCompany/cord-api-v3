import { IsEmail } from 'class-validator';
import { Field, InputType } from 'type-graphql';

@InputType()
export abstract class UserEmailInput {
  @Field()
  @IsEmail()
  readonly email: string;
}
