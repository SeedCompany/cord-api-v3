import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Resource } from '../../../common';

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
