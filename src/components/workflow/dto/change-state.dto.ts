import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType } from 'type-graphql';

@InputType()
export abstract class ChangeState {
  @Field(() => ID)
  readonly newStateId: string;

  @Field()
  readonly commnet: string;
}

@InputType()
export abstract class ChangeStateInput {
  @Field()
  @Type(() => ChangeState)
  @ValidateNested()
  readonly commentState: ChangeState;
}
