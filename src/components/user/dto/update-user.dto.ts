import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { User } from './user.dto';

@InputType()
export abstract class UpdateUser {
  @Field(() => ID)
  readonly id: string;

  // TODO Allow email to be changed? Implications?

  @Field({ nullable: true })
  @MinLength(2)
  readonly realFirstName?: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly realLastName?: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly displayFirstName?: string;

  @Field( {nullable: true})
  @MinLength(2)
  readonly displayLastName?: string;

  @Field({ nullable: true })
  readonly phone?: string;

  @Field({ nullable: true })
  readonly timezone?: string;

  @Field({ nullable: true })
  readonly bio?: string;
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
