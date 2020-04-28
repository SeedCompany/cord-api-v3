import { ArgsType, Field } from 'type-graphql';
import { IsEmail } from '../../../common';

@ArgsType()
export abstract class CheckEmailArgs {
  @Field()
  @IsEmail()
  readonly email: string;
}
