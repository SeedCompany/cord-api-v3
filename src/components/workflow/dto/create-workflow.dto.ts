import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Workflow } from './workflow.dto';

@InputType()
export abstract class CreateWorkflow {
  @Field(() => ID)
  readonly baseNodeId: string;

  @Field()
  readonly startingStateName: string;

  @Field()
  readonly stateIdentifier: string;
}

@InputType()
export abstract class CreateWorkflowInput {
  @Field()
  @Type(() => CreateWorkflow)
  @ValidateNested()
  readonly workflow: CreateWorkflow;
}

@ObjectType()
export abstract class CreateWorkflowOutput {
  @Field()
  @Type(() => Workflow)
  @ValidateNested()
  readonly workflow: Workflow;
}
