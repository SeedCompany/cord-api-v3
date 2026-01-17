import { ArgsType, Field, InputType, ObjectType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { EmailField, MutationPlaceholderOutput } from '~/common';

@InputType()
export abstract class ResetPassword {
  @Field()
  readonly token: string;

  @Field()
  readonly password: string;
}

@ObjectType()
export abstract class PasswordReset extends MutationPlaceholderOutput {}

@ArgsType()
export abstract class ChangePasswordArgs {
  @Field()
  readonly oldPassword: string;

  @Field()
  @MinLength(6)
  readonly newPassword: string;
}

@ObjectType()
export abstract class PasswordChanged extends MutationPlaceholderOutput {}

@ArgsType()
export abstract class ForgotPasswordArgs {
  @EmailField()
  readonly email: string;
}

@ObjectType()
export abstract class ForgotPasswordSent extends MutationPlaceholderOutput {}
