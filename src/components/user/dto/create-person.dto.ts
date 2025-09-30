import { Field, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { EmailField, IsIanaTimezone, NameField, Role } from '~/common';
import { CreateDefinedFileVersionInput } from '../../../components/file/dto';
import { Gender } from './gender.enum';
import { UserStatus } from './user-status.enum';

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
  readonly status?: UserStatus = 'Active';

  @Field(() => [Role], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly roles?: readonly Role[];

  @Field(() => String, { nullable: true })
  readonly title?: string | null;

  @Field(() => Gender, { nullable: true })
  readonly gender?: Gender;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly photo?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class CreatePersonInput {
  @Field()
  @Type(() => CreatePerson)
  @ValidateNested()
  readonly person: CreatePerson;
}
