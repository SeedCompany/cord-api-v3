import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import {
  EmailField,
  ID,
  IdField,
  IsIanaTimezone,
  NameField,
  OptionalField,
  Role,
} from '~/common';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class UpdateUser {
  @IdField()
  readonly id: ID;

  @EmailField({ nullable: true })
  readonly email?: string | null;

  @NameField({ optional: true })
  readonly realFirstName?: string;

  @NameField({ optional: true })
  readonly realLastName?: string;

  @NameField({ optional: true })
  readonly displayFirstName?: string;

  @NameField({ optional: true })
  readonly displayLastName?: string;

  @Field(() => String, { nullable: true })
  readonly phone?: string | null;

  @OptionalField()
  @IsIanaTimezone()
  readonly timezone?: string;

  @Field(() => String, { nullable: true })
  readonly about?: string | null;

  @OptionalField(() => UserStatus)
  readonly status?: UserStatus;

  @Field(() => [Role], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly roles?: readonly Role[];

  @Field(() => String, { nullable: true })
  readonly title?: string | null;
}

@InputType()
export abstract class UpdateUserInput {
  @Field()
  @Type(() => UpdateUser)
  @ValidateNested()
  readonly user: UpdateUser;
}

@ObjectType()
export abstract class UpdateUserOutput {
  @Field()
  readonly user: User;
}
