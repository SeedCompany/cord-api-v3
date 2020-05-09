import { Type } from '@nestjs/common';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { State } from './state.dto';

@ObjectType()
export class Workflow {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Workflow as any) as Type<Workflow>;
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly stateIdentifier: string;

  @Field(() => State)
  @ValidateNested()
  readonly startingState: State;
}
