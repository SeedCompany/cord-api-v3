import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';

@InputType()
export abstract class ChangeCurrentState {
  @IdField()
  readonly newStateId: ID;

  @IdField()
  readonly workflowId: ID;
  // WIP below
  // @Field()
  // readonly commnet: string;
}

@InputType()
export abstract class ChangeCurrentStateInput {
  @Field()
  @Type(() => ChangeCurrentState)
  @ValidateNested()
  readonly state: ChangeCurrentState;
}
