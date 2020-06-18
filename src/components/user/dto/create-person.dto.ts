import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { IsEmail } from '../../../common';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class CreatePerson {
  @Field({ nullable: true })
  @IsEmail()
  readonly email?: string;

  @Field()
  @MinLength(2)
  readonly realFirstName: string;

  @Field()
  @MinLength(2)
  readonly realLastName: string;

  @Field()
  @MinLength(2)
  readonly displayFirstName: string;

  @Field()
  @MinLength(2)
  readonly displayLastName: string;

  @Field({ nullable: true })
  readonly phone?: string;

  @Field({ nullable: true })
  readonly timezone?: string;

  @Field({ nullable: true })
  readonly bio?: string;

  @Field(() => UserStatus, { nullable: true })
  readonly status?: UserStatus;
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
