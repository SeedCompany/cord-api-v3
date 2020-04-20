import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';

@InputType()
export abstract class ConsistencyUserChecker {
  @Field(() => ID)
  readonly id: string;

  // @Field()
  // @IsEmail()
  // readonly email: string;

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
}

@InputType()
export abstract class ConsistencyUserCheckerInput {
  @Field()
  @Type(() => ConsistencyUserChecker)
  @ValidateNested()
  readonly user: ConsistencyUserChecker;
}

@ObjectType()
export abstract class ConsistencyUserCheckerOutput {
  @Field()
  readonly validate: boolean;
}
