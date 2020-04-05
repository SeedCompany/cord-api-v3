import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Workflow } from './workflow.dto';

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

// @ObjectType({
//   implements: [Resource],
// })
// export class State extends Resource {
//   @Field()
//   readonly stateName: string;
// }

@ObjectType()
export abstract class AddStateOutput {
  @Field()
  @Type(() => Workflow)
  @ValidateNested()
  readonly state: Workflow;
}
