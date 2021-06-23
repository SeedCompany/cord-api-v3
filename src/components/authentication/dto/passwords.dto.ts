import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { MinLength } from 'class-validator';
import { toLower } from 'lodash';
import { IsEmail } from '../../../common';

@InputType()
export abstract class ResetPasswordInput {
  @Field()
  readonly token: string;

  @Field()
  readonly password: string;
}

@ArgsType()
export abstract class ChangePasswordArgs {
  @Field()
  readonly oldPassword: string;

  @Field()
  @MinLength(6)
  readonly newPassword: string;
}

@ArgsType()
export abstract class ForgotPasswordArgs {
  @Field()
  @IsEmail()
  @Transform(({ value }) => toLower(value))
  readonly email: string;
}
