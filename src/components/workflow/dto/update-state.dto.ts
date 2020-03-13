import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

@InputType()
export abstract class UpdateState {
  @Field(() => ID)
  readonly stateId: string;

  @Field(() => ID)
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
