import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';

@InputType()
export abstract class UpdateState {
  @IdField()
  readonly stateId: ID;

  @IdField()
  readonly workflowId: ID;

  @Field()
  readonly stateName?: string;
}

@InputType()
export abstract class UpdateStateInput {
  @Field()
  @Type(() => UpdateState)
  @ValidateNested()
  readonly state: UpdateState;
}
