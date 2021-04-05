import { ArgsType, Field } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { toLower } from 'lodash';
import { IsEmail } from '../../../common';

@ArgsType()
export abstract class CheckEmailArgs {
  @Field()
  @IsEmail()
  @Transform(({ value }) => toLower(value))
  readonly email: string;
}
