import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';

@InputType()
export abstract class ConsistencyCheckerUser {
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

  @Field({ nullable: true })
  @MinLength(2)
  readonly displayLastName?: string;

  @Field({ nullable: true })
  readonly phone?: string;

  @Field({ nullable: true })
  readonly timezone?: string;

  @Field({ nullable: true })
  readonly bio?: string;

  //TODO : Replace above section
  // @Field(() => ID)
  // readonly id: string;

  // @Field()
  // @IsEmail()
  // readonly email: string;

  // @Field()
  // readonly password: string;

  // @Field()
  // @MinLength(2)
  // readonly realFirstName: string;

  // @Field()
  // @MinLength(2)
  // readonly realLastName: string;

  // @Field()
  // @MinLength(2)
  // readonly displayFirstName: string;

  // @Field()
  // @MinLength(2)
  // readonly displayLastName: string;

  // @Field({ nullable: true })
  // readonly phone?: string;

  // @Field({ nullable: true })
  // readonly timezone?: string;

  // @Field({ nullable: true })
  // readonly bio?: string;
}

@InputType()
export abstract class ConsistencyCheckerUserInput {
  @Field()
  @Type(() => ConsistencyCheckerUser)
  @ValidateNested()
  readonly user: ConsistencyCheckerUser;
}

@ObjectType()
export abstract class ConsistencyCheckerUserOutput {
  @Field()
  readonly validate: boolean;
}
