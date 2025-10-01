import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  EmailField,
  type ID,
  IdField,
  IsIanaTimezone,
  ListField,
  NameField,
  OptionalField,
  Role,
} from '~/common';
import { CreateDefinedFileVersionInput } from '../../../components/file/dto';
import { Gender } from './gender.enum';
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

  @ListField(() => Role, { optional: true })
  readonly roles?: readonly Role[];

  @Field(() => String, { nullable: true })
  readonly title?: string | null;

  @OptionalField(() => Gender)
  readonly gender?: Gender;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly photo?: CreateDefinedFileVersionInput;
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
