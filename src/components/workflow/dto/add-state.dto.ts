import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { State } from './state.dto';

@InputType()
export abstract class AddState {
  @Field(() => ID)
  readonly workflowId: string;

  @Field()
  readonly stateName: string;
}

@InputType()
export abstract class AddStateInput {
  @Field()
  @Type(() => AddState)
  @ValidateNested()
  readonly state: AddState;
}

@ObjectType()
export abstract class AddStateOutput {
  @Field()
  @Type(() => State)
  @ValidateNested()
  readonly state: State;
}
