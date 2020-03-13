import { ArgsType, Field } from '@nestjs/graphql';
import { IsEmail } from '../../../common';

@ArgsType()
export abstract class CheckEmailArgs {
  @Field()
  @IsEmail()
  readonly email: string;
}
