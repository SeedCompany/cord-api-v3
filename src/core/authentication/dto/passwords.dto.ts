import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { EmailField } from '~/common';
import type { LinkTo } from '~/core/resources';

@ArgsType()
export abstract class RequestPasswordReset {
  @EmailField()
  readonly email: string;
}

@ObjectType()
export abstract class PasswordResetRequested {
  @EmailField()
  readonly email: string;
}

@ArgsType()
export abstract class ResetPassword {
  @Field()
  readonly token: string;

  @Field()
  readonly password: string;
}

@ArgsType()
export abstract class ChangePassword {
  @Field()
  readonly oldPassword: string;

  @Field()
  @MinLength(6)
  readonly newPassword: string;
}

@ObjectType()
export abstract class PasswordUpdated {
  user: LinkTo<'User'>;
}
