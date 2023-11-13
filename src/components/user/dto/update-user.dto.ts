import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { EmailField, ID, IdField, IsIanaTimezone, NameField } from '~/common';
import { Role } from '../../authorization';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class UpdateUser {
  @IdField()
  readonly id: ID;

  @EmailField({ nullable: true })
  readonly email?: string | null;

  @NameField({ nullable: true })
  readonly realFirstName?: string;

  @NameField({ nullable: true })
  readonly realLastName?: string;

  @NameField({ nullable: true })
  readonly displayFirstName?: string;

  @NameField({ nullable: true })
  readonly displayLastName?: string;

  @Field(() => String, { nullable: true })
  readonly phone?: string | null;

  @Field({ nullable: true })
  @IsIanaTimezone()
  readonly timezone?: string;

  @Field(() => String, { nullable: true })
  readonly about?: string | null;

  @Field(() => UserStatus, { nullable: true })
  readonly status?: UserStatus;

  @Field(() => [Role], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly roles?: Role[];

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
