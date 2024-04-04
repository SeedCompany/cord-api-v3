import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { EmailField, IsIanaTimezone, NameField } from '~/common';
import { Role } from '../../authorization';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class CreatePerson {
  @EmailField({ nullable: true })
  readonly email?: string | null;

  @NameField()
  readonly realFirstName: string;

  @NameField()
  readonly realLastName: string;

  @NameField()
  readonly displayFirstName: string;

  @NameField()
  readonly displayLastName: string;

  @Field(() => String, { nullable: true })
  readonly phone?: string | null;

  @Field({ nullable: true })
  @IsIanaTimezone()
  readonly timezone?: string = 'America/Chicago';

  @Field(() => String, { nullable: true })
  readonly about?: string | null;

  @Field(() => UserStatus, { nullable: true })
  readonly status?: UserStatus;

  @Field(() => [Role], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly roles?: readonly Role[];

  @Field(() => String, { nullable: true })
  readonly title?: string | null;
}

@InputType()
export abstract class CreatePersonInput {
  @Field()
  @Type(() => CreatePerson)
  @ValidateNested()
  readonly person: CreatePerson;
}

@ObjectType()
export abstract class CreatePersonOutput {
  @Field()
  readonly user: User; // intentionally user
}
