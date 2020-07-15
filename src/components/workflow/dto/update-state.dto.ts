import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';

@InputType()
export abstract class UpdateState {
  @IdField()
  readonly stateId: string;

  @IdField()
  readonly workflowId: string;

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
