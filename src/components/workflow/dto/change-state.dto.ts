import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType } from 'type-graphql';

@InputType()
export abstract class ChangeCurrentState {
  @Field(() => ID)
  readonly newStateId: string;

  @Field(() => ID)
  readonly workflowId: string;

  @Field()
  readonly commnet: string;
}

@InputType()
export abstract class ChangeCurrentStateInput {
  @Field()
  @Type(() => ChangeCurrentState)
  @ValidateNested()
  readonly state: ChangeCurrentState;
}
