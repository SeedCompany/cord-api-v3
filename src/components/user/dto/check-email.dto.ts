import { Type } from 'class-transformer';
import { IsEmail, ValidateNested } from 'class-validator';
import { Field, InputType } from 'type-graphql';

@InputType()
export abstract class UserEmail {
  @Field()
  @IsEmail()
  readonly email: string;
}
