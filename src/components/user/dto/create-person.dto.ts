import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IsEmail, IsIanaTimezone, NameField } from '../../../common';
import { Role } from '../../project/project-member/dto/role.dto';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class CreatePerson {
  @Field()
  @IsEmail()
  readonly email: string;

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
  readonly timezone?: string;

  @Field({ nullable: true })
  readonly bio?: string;

  @Field(() => UserStatus, { nullable: true })
  readonly status?: UserStatus;

  @Field(() => [Role], { nullable: true })
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
