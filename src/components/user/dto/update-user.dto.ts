import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, IsIanaTimezone, NameField } from '../../../common';
import { Role } from '../../project/project-member/dto/role.dto';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class UpdateUser {
  @IdField()
  readonly id: string;

  @Field({ nullable: true })
  readonly email?: string;

  @NameField({ nullable: true })
  readonly realFirstName?: string;

  @NameField({ nullable: true })
  readonly realLastName?: string;

  @NameField({ nullable: true })
  readonly displayFirstName?: string;

  @NameField({ nullable: true })
  readonly displayLastName?: string;

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
