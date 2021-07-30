import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { toLower, uniq } from 'lodash';
import { IsEmail, IsIanaTimezone, NameField } from '../../../common';
import { Role } from '../../authorization';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class CreatePerson {
  @Field(() => String, { nullable: true })
  @IsEmail()
  @Transform(({ value }) => toLower(value))
  readonly email?: string | null;

  @NameField()
  readonly realFirstName: string;

  @NameField()
  readonly realLastName: string;

  @NameField()
  readonly displayFirstName: string;

  @NameField()
  readonly displayLastName: string;

  @Field({ nullable: true })
  readonly phone?: string;

  @Field({ nullable: true })
  @IsIanaTimezone()
  readonly timezone?: string = 'America/Chicago';

  @Field({ nullable: true })
  readonly about?: string;

  @Field(() => UserStatus, { nullable: true })
  readonly status?: UserStatus;

  @Field(() => [Role], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly roles?: Role[];

  @Field({ nullable: true })
  readonly title?: string;
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
